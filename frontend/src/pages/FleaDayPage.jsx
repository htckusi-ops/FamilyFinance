import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import BarcodeScanner from '../components/BarcodeScanner';
import Avatar from '../components/Avatar';

const CATEGORIES = ['Spielzeug', 'Kleidung', 'Bücher', 'Elektronik', 'Sport', 'Sonstiges'];
const CONDITIONS = ['neu', 'sehr gut', 'gut', 'akzeptabel'];

export default function FleaDayPage() {
  const { id } = useParams();
  const toast = useToast();
  const [day, setDay] = useState(null);
  const [items, setItems] = useState([]);
  const [children, setChildren] = useState([]);
  const [tab, setTab] = useState('items');
  const [addModal, setAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null); // item being edited
  const [sellModal, setSellModal] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cashierScanning, setCashierScanning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', barcode: '', category: 'Spielzeug', condition: 'gut', suggested_price: '', owners: [] });
  const [soldPrice, setSoldPrice] = useState('');
  const [soldType, setSoldType] = useState('cash');
  const [tauschPartial, setTauschPartial] = useState('');
  const photoRef = useRef();
  const editPhotoRef = useRef();

  useEffect(() => {
    load();
    api.get('/users').then(r => setChildren(r.data));
  }, [id]);

  async function load() {
    const [dayRes, itemsRes] = await Promise.all([
      api.get('/flea/days'),
      api.get(`/flea/items?day_id=${id}`),
    ]);
    setDay(dayRes.data.find(d => String(d.id) === id));
    setItems(itemsRes.data);
  }

  async function loadSummary() {
    const r = await api.get(`/flea/days/${id}/summary`);
    setSummary(r.data);
  }

  async function lookupBarcode(code) {
    setLookupLoading(true);
    try {
      // Try Open Food Facts (food, packaged goods, household products)
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
      const data = await r.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const name = p.product_name_de || p.product_name || '';
        setForm(f => ({ ...f, name, description: p.brands || f.description }));
        if (name) { toast(`Produkt gefunden: ${name} 🎉`, 'success'); return; }
      }
      // Try Open Library for ISBN (978/979 prefix)
      if (code.startsWith('978') || code.startsWith('979')) {
        const r2 = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`);
        const d2 = await r2.json();
        const book = d2[`ISBN:${code}`];
        if (book?.title) {
          const authors = book.authors?.map(a => a.name).join(', ') || '';
          setForm(f => ({ ...f, name: book.title, description: authors, category: 'Bücher' }));
          toast(`Buch gefunden: ${book.title} 📚`, 'success');
          return;
        }
      }
      toast('Barcode erkannt – bitte Name manuell eingeben', 'info');
    } catch {
      toast('Barcode erkannt – bitte Name manuell eingeben', 'info');
    } finally {
      setLookupLoading(false);
    }
  }

  function onScan(code) {
    setScanning(false);
    if (code.startsWith('item:')) {
      toast('Das ist ein Artikel-QR-Code – bitte in der Kasse scannen', 'info');
      return;
    }
    setForm(f => ({ ...f, barcode: code, name: '', description: '' }));
    setAddModal(true);
    lookupBarcode(code);
  }

  function onCashierScan(code) {
    setCashierScanning(false);
    // Accept both our label QR "item:123" and product barcodes stored on items
    let found = null;
    if (code.startsWith('item:')) {
      const itemId = Number(code.replace('item:', ''));
      found = available.find(i => i.id === itemId);
      if (!found) {
        const sold_ = sold.find(i => i.id === itemId);
        if (sold_) { toast(`"${sold_.name}" wurde bereits verkauft`, 'error'); return; }
      }
    } else {
      // product barcode — search available items by stored barcode
      found = available.find(i => i.barcode === code);
    }
    if (found) {
      setSellModal(found);
      setSoldPrice(String(found.suggested_price));
      setSoldType('cash');
    } else {
      toast('Artikel nicht gefunden', 'error');
    }
  }

  async function addItem() {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'owners') fd.append(k, JSON.stringify(v));
      else fd.append(k, v);
    });
    fd.append('day_id', id);
    if (photoRef.current?.files[0]) fd.append('photo', photoRef.current.files[0]);
    await api.post('/flea/items', fd);
    toast('Artikel hinzugefügt! 🏷️', 'success');
    setForm({ name: '', description: '', barcode: '', category: 'Spielzeug', condition: 'gut', suggested_price: '', owners: [] });
    setAddModal(false);
    load();
  }

  async function sellItem() {
    if (soldType === 'cash') {
      await api.post(`/flea/items/${sellModal.id}/sell`, { sold_price: Number(soldPrice), sold_type: 'cash' });
      toast(`Verkauft für CHF ${soldPrice}! 💰`, 'success');
    } else {
      const partial = Number(tauschPartial) || 0;
      await api.post(`/flea/items/${sellModal.id}/sell`, { sold_price: partial, sold_type: 'tausch' });
      const partialNote = partial > 0 ? ` + CHF ${partial.toFixed(2)}` : partial < 0 ? ` − CHF ${Math.abs(partial).toFixed(2)}` : '';
      toast(`Tausch erfasst${partialNote}! 🔄`, 'success');
    }
    setSellModal(null);
    setSoldPrice('');
    setSoldType('cash');
    setTauschPartial('');
    load();
  }

  async function undoSell(item) {
    await api.post(`/flea/items/${item.id}/undo-sell`);
    toast('Verkauf rückgängig gemacht ↩️', 'success');
    load();
  }

  async function markUnsold(item) {
    await api.post(`/flea/items/${item.id}/unsold`);
    load();
  }

  async function deleteItem(item) {
    await api.delete(`/flea/items/${item.id}`);
    load();
  }

  function openEdit(item) {
    const ownerIds = item.owner_ids ? String(item.owner_ids).split(',').map(Number) : [];
    const ownerNames = item.owner_names ? String(item.owner_names).split(',') : [];
    setEditItem({
      ...item,
      owners: ownerIds.map((uid, i) => ({ user_id: uid, name: ownerNames[i] || '' })),
    });
  }

  async function saveEdit() {
    const fd = new FormData();
    ['name','description','barcode','category','condition','suggested_price'].forEach(k => {
      if (editItem[k] !== undefined) fd.append(k, editItem[k]);
    });
    if (editPhotoRef.current?.files[0]) fd.append('photo', editPhotoRef.current.files[0]);
    await api.patch(`/flea/items/${editItem.id}`, fd);
    // update owners: delete all, re-insert
    // handled via separate endpoint not yet needed – just update fields for now
    toast('Artikel aktualisiert ✓', 'success');
    setEditItem(null);
    load();
  }

  function toggleOwner(childId) {
    setForm(f => {
      const has = f.owners.find(o => o.user_id === childId);
      if (has) {
        const rest = f.owners.filter(o => o.user_id !== childId);
        return { ...f, owners: rest.map(o => ({ ...o, share_percent: 100 / rest.length || 100 })) };
      }
      const next = [...f.owners, { user_id: childId, share_percent: 0 }];
      return { ...f, owners: next.map(o => ({ ...o, share_percent: Math.round(100 / next.length) })) };
    });
  }

  const available = items.filter(i => i.status === 'available');
  const sold = items.filter(i => i.status === 'sold');
  const unsold = items.filter(i => i.status === 'unsold');

  function Thumb({ photo, size = 48 }) {
    return photo
      ? <img src={photo} alt="" style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#e5e7eb' }} />
      : <div style={{ width: size, height: size, borderRadius: 8, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: size * 0.45 }}>📦</div>;
  }

  return (
    <div className="page">
      <div className="mb-4">
        <h1 className="font-bold" style={{ fontSize: '1.4rem' }}>{day?.name || 'Flohmarkttag'}</h1>
        <p className="text-muted text-sm">{day ? new Date(day.date).toLocaleDateString('de-CH') : ''}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4" style={{ overflowX: 'auto' }}>
        {['items', 'cashier', 'summary'].map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'summary') loadSummary(); }}
            style={{ padding: '8px 16px', borderRadius: 99, background: tab === t ? 'var(--primary)' : '#e0e7ef', color: tab === t ? '#fff' : 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {t === 'items' ? '📦 Artikel' : t === 'cashier' ? '🛒 Kasse' : '📊 Abschluss'}
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === 'items' && (
        <>
          <div className="flex gap-2 mb-4">
            <button className="btn-primary w-full" onClick={() => setScanning(true)}>📷 Scannen</button>
            <button className="btn-ghost w-full" onClick={() => setAddModal(true)}>+ Manuell</button>
          </div>

          {scanning && (
            <div className="card mb-4">
              <BarcodeScanner onResult={onScan} onClose={() => setScanning(false)} />
            </div>
          )}

          <div className="mb-2 flex gap-2">
            <span className="tag tag-blue">{available.length} verfügbar</span>
            <span className="tag tag-green">{sold.length} verkauft</span>
            <span className="tag tag-red">{unsold.length} nicht verk.</span>
          </div>

          <div className="flex flex-col gap-2">
            {items.map(item => (
              <div key={item.id} className="card">
                <div className="flex justify-between items-start gap-2">
                  <Thumb photo={item.photo} size={52} />
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div className="text-sm text-muted">{item.category} · {item.condition} · {item.owner_names || '—'}</div>
                    <div className="text-sm" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                      CHF {item.suggested_price}
                      {item.status === 'sold' && item.sold_type === 'tausch' && (
                        <span style={{ color: '#7c3aed' }}>
                          {' '}→ 🔄{item.sold_price && item.sold_price !== 0 ? ` ${item.sold_price > 0 ? '+' : ''}CHF ${Number(item.sold_price).toFixed(2)}` : ''}
                        </span>
                      )}
                      {item.status === 'sold' && item.sold_type !== 'tausch' && item.sold_price != null && (
                        <span style={{ color: 'var(--success)' }}> → CHF {Number(item.sold_price).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className={`tag ${item.status === 'sold' ? (item.sold_type === 'tausch' ? 'tag-green' : 'tag-green') : item.status === 'unsold' ? 'tag-red' : 'tag-blue'}`}>
                      {item.status === 'sold' ? (item.sold_type === 'tausch' ? '🔄 Tausch' : '✓ Verkauft') : item.status === 'unsold' ? '✗ Nicht verk.' : 'Verfügbar'}
                    </span>
                    <div className="flex gap-1">
                      <button style={{ background: '#e0e7ef', color: '#374151', padding: '4px 8px', borderRadius: 8, fontSize: '0.75rem' }} onClick={() => openEdit(item)}>✏️</button>
                      {item.status === 'sold' && (
                        <button style={{ background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: 8, fontSize: '0.75rem' }} onClick={() => undoSell(item)}>↩️</button>
                      )}
                      {item.status === 'available' && (
                        <button style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: 8, fontSize: '0.75rem' }} onClick={() => deleteItem(item)}>🗑️</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {available.length > 0 && (
            <button className="btn-primary w-full mt-4" onClick={async () => {
              try {
                const res = await api.get(`/flea/days/${id}/labels.pdf`, { responseType: 'blob' });
                const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                const a = document.createElement('a');
                a.href = url; a.download = `etiketten-${day?.date || id}.pdf`; a.click();
                URL.revokeObjectURL(url);
              } catch { toast('PDF-Fehler', 'error'); }
            }}>🖨️ Etiketten drucken (PDF)</button>
          )}
        </>
      )}

      {/* Cashier tab */}
      {tab === 'cashier' && (
        <div>
          <div className="flex gap-2 mb-4">
            <button className="btn-primary w-full" onClick={() => setCashierScanning(s => !s)}>
              📷 {cashierScanning ? 'Scan beenden' : 'Artikel scannen'}
            </button>
          </div>
          {cashierScanning && (
            <div className="card mb-4">
              <BarcodeScanner onResult={onCashierScan} onClose={() => setCashierScanning(false)} />
            </div>
          )}
          <h2 className="font-bold mb-3">🛒 Verfügbare Artikel</h2>
          <div className="flex flex-col gap-2">
            {available.map(item => (
              <div key={item.id} className="card flex items-center gap-3">
                <Thumb photo={item.photo} size={56} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div className="text-sm text-muted">{item.owner_names}</div>
                  <div className="font-semibold" style={{ color: 'var(--primary)' }}>CHF {item.suggested_price}</div>
                </div>
                <div className="flex flex-col gap-1" style={{ flexShrink: 0 }}>
                  <button className="btn-primary" style={{ padding: '8px 16px' }} onClick={() => { setSellModal(item); setSoldPrice(String(item.suggested_price)); setSoldType('cash'); }}>
                    💰 Verkaufen
                  </button>
                  <button style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem' }} onClick={() => markUnsold(item)}>
                    Nicht verkauft
                  </button>
                </div>
              </div>
            ))}
            {available.length === 0 && <div className="card text-center text-muted">Alle Artikel abgerechnet!</div>}
          </div>
          {sold.length > 0 && (
            <div className="mt-4">
              <h2 className="font-bold mb-3">✓ Bereits verkauft</h2>
              <div className="flex flex-col gap-2">
                {sold.map(item => (
                  <div key={item.id} className="card flex items-center gap-3" style={{ opacity: 0.8 }}>
                    <Thumb photo={item.photo} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div className="font-semibold">
                        {item.sold_type === 'tausch'
                          ? <span style={{ color: '#7c3aed' }}>🔄 Tausch{item.sold_price && item.sold_price !== 0 ? ` ${item.sold_price > 0 ? '+' : ''}CHF ${Number(item.sold_price).toFixed(2)}` : ''}</span>
                          : <span style={{ color: 'var(--success)' }}>CHF {Number(item.sold_price).toFixed(2)}</span>
                        }
                      </div>
                    </div>
                    <button style={{ background: '#fef3c7', color: '#92400e', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }} onClick={() => undoSell(item)}>
                      ↩️ Rückgängig
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary tab */}
      {tab === 'summary' && summary && (
        <div>
          <div className="card mb-4" style={{ background: 'var(--primary)', color: '#fff' }}>
            <div className="text-sm" style={{ opacity: 0.8 }}>Gesamterlös</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>CHF {Number(summary.total).toFixed(2)}</div>
          </div>
          {summary.unownedCount > 0 && (
            <div className="card mb-3" style={{ background: '#fff7ed', borderLeft: '4px solid #f97316' }}>
              <span style={{ color: '#9a3412', fontWeight: 600, fontSize: '0.9rem' }}>
                ⚠️ {summary.unownedCount} Artikel ohne zugewiesenes Kind — Erlös nicht aufgeteilt
              </span>
            </div>
          )}
          {Object.values(summary.byChild).map((child, i) => (
            <div key={i} className="card mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{child.name}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>CHF {child.total.toFixed(2)}</span>
              </div>
              <div className="text-sm text-muted mb-2">
                {child.items.filter(i => i.status === 'sold').length} verkauft · {child.items.filter(i => i.status === 'unsold').length} nicht verkauft
              </div>
              <div className="flex flex-col gap-1">
                {child.items.filter(i => i.status === 'sold').map(item => (
                  <div key={item.id} className="flex justify-between text-sm" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 4 }}>
                    <span>{item.name} <span className="text-muted">({item.category})</span></span>
                    {item.sold_type === 'tausch'
                      ? <span style={{ color: '#7c3aed', fontWeight: 600 }}>🔄 Tausch</span>
                      : <span style={{ color: 'var(--success)', fontWeight: 600 }}>CHF {Number(item.sold_price).toFixed(2)}</span>
                    }
                  </div>
                ))}
                {child.items.filter(i => i.status === 'unsold').map(item => (
                  <div key={item.id} className="flex justify-between text-sm" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 4, opacity: 0.5 }}>
                    <span>{item.name} <span className="text-muted">({item.category})</span></span>
                    <span>nicht verkauft</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add item modal */}
      <Modal open={addModal} title="Artikel hinzufügen" onClose={() => { setAddModal(false); setLookupLoading(false); setForm({ name: '', description: '', barcode: '', category: 'Spielzeug', condition: 'gut', suggested_price: '', owners: [] }); }}>
        <div className="flex flex-col gap-3">
          {form.barcode && (
            <div style={{ background: '#f0f4ff', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>🔢</span>
              <div style={{ flex: 1 }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>Barcode</div>
                <div className="text-sm" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{form.barcode}</div>
              </div>
              {lookupLoading && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>🔍 Suche…</span>}
            </div>
          )}
          <input placeholder="Artikelname *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus={!!form.barcode} />
          <input placeholder="Beschreibung (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Richtpreis (CHF)" value={form.suggested_price}
            onChange={e => setForm(f => ({ ...f, suggested_price: e.target.value }))} />
          <div>
            <label className="text-sm font-semibold mb-1" style={{ display: 'block' }}>Zugewiesen an:</label>
            <div className="flex flex-wrap gap-2">
              {children.map(c => (
                <button key={c.id} onClick={() => toggleOwner(c.id)}
                  style={{ padding: '6px 14px', borderRadius: 99, background: form.owners.find(o => o.user_id === c.id) ? 'var(--primary)' : '#e0e7ef', color: form.owners.find(o => o.user_id === c.id) ? '#fff' : 'var(--text)', fontWeight: 600 }}>
                  {c.name} {form.owners.find(o => o.user_id === c.id) ? `(${form.owners.find(o => o.user_id === c.id).share_percent}%)` : ''}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted">Foto (optional)</label>
            <input type="file" ref={photoRef} accept="image/*" capture="environment" style={{ padding: 8 }} />
          </div>
          <button className="btn-primary w-full" onClick={addItem}>Artikel speichern</button>
        </div>
      </Modal>

      {/* Edit item modal */}
      {editItem && (
        <Modal open title={`✏️ ${editItem.name}`} onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-3">
            <input placeholder="Artikelname" value={editItem.name}
              onChange={e => setEditItem(i => ({ ...i, name: e.target.value }))} />
            <input placeholder="Beschreibung" value={editItem.description || ''}
              onChange={e => setEditItem(i => ({ ...i, description: e.target.value }))} />
            <select value={editItem.category} onChange={e => setEditItem(i => ({ ...i, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={editItem.condition} onChange={e => setEditItem(i => ({ ...i, condition: e.target.value }))}>
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="Richtpreis (CHF)" value={editItem.suggested_price}
              onChange={e => setEditItem(i => ({ ...i, suggested_price: e.target.value }))} />
            {editItem.photo && (
              <img src={editItem.photo} alt="" style={{ width: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'contain', background: '#f3f4f6' }} />
            )}
            <div>
              <label className="text-sm text-muted">Neues Foto (optional)</label>
              <input type="file" ref={editPhotoRef} accept="image/*" capture="environment" style={{ padding: 8 }} />
            </div>
            <button className="btn-primary w-full" onClick={saveEdit}>Speichern</button>
          </div>
        </Modal>
      )}

      {/* Sell modal */}
      {sellModal && (
        <Modal open title={`Verkaufen: ${sellModal.name}`} onClose={() => { setSellModal(null); setSoldType('cash'); setSoldPrice(''); setTauschPartial(''); }}>
          <div className="flex gap-2 mb-4">
            {[['cash', '💰 Preis'], ['tausch', '🔄 Tausch']].map(([val, label]) => (
              <button key={val} onClick={() => setSoldType(val)}
                style={{ flex: 1, padding: '10px', borderRadius: 12, fontWeight: 700,
                  background: soldType === val ? (val === 'tausch' ? '#ede9fe' : 'var(--primary)') : '#e0e7ef',
                  color: soldType === val ? (val === 'tausch' ? '#6d28d9' : '#fff') : 'var(--text)',
                  border: soldType === val && val === 'tausch' ? '2px solid #7c3aed' : '2px solid transparent' }}>
                {label}
              </button>
            ))}
          </div>
          {soldType === 'cash' ? (
            <>
              <div className="text-muted text-sm mb-2">Richtpreis: CHF {sellModal.suggested_price}</div>
              <input type="number" placeholder="Tatsächlicher Verkaufspreis" value={soldPrice}
                onChange={e => setSoldPrice(e.target.value)} autoFocus />
              <button className="btn-primary w-full mt-3" onClick={sellItem} disabled={!soldPrice}>
                💰 Verkauf bestätigen
              </button>
            </>
          ) : (
            <>
              <div style={{ background: '#ede9fe', borderRadius: 10, padding: '10px 14px', color: '#6d28d9', fontSize: '0.88rem', marginBottom: 12 }}>
                Artikel wird als Tausch markiert (zählt als verkauft).
              </div>
              <label className="text-sm font-semibold mb-1" style={{ display: 'block' }}>
                Teilbetrag (optional)
              </label>
              <input type="number" step="0.01"
                placeholder="z.B. +5.00 (erhalten) oder -3.00 (bezahlt)"
                value={tauschPartial}
                onChange={e => setTauschPartial(e.target.value)} />
              {tauschPartial !== '' && Number(tauschPartial) !== 0 && (
                <div style={{ background: Number(tauschPartial) > 0 ? '#f0fff4' : '#fff1f2', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: '0.85rem', color: Number(tauschPartial) > 0 ? 'var(--success)' : '#be123c' }}>
                  {Number(tauschPartial) > 0
                    ? `+ CHF ${Number(tauschPartial).toFixed(2)} wird dem Kind gutgeschrieben`
                    : `− CHF ${Math.abs(Number(tauschPartial)).toFixed(2)} wird vom Guthaben abgezogen`}
                </div>
              )}
              <button style={{ background: '#7c3aed', color: '#fff', borderRadius: 12, padding: '12px', fontWeight: 700, width: '100%', marginTop: 12 }} onClick={sellItem}>
                🔄 Tausch bestätigen
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
