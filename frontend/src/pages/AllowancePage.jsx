import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';

async function resizeImage(file, maxPx = 500) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    };
    img.src = url;
  });
}

const TX_LABELS = {
  allowance: 'Taschengeld',
  manual: 'Manuell',
  expense: 'Ausgabe',
  savings_deposit: 'Sparbüchse',
  point_exchange: 'Punkte-Umtausch',
  interest: 'Zinsen',
};

export default function AllowancePage() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const photoRef = useRef();
  const [children, setChildren] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [configModal, setConfigModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [pay, setPay] = useState({ amount: '', description: '' });
  const [config, setConfig] = useState({ amount: '', interval: 'monthly', interest_rate: '', next_payout_at: '' });
  const [newGoal, setNewGoal] = useState({ name: '', target_amount: '' });
  const [expense, setExpense] = useState({ amount: '', description: '' });
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const r = await api.get('/allowance');
    setChildren(r.data);
  }
  async function loadDetail(child) {
    setSelected(child);
    const r = await api.get(`/allowance/${child.id}`);
    setDetail(r.data);
    setConfig({
      amount: r.data.config?.amount || '',
      interval: r.data.config?.interval || 'monthly',
      interest_rate: r.data.config?.interest_rate || '',
      next_payout_at: r.data.config?.next_payout_at?.slice(0, 10) || '',
    });
  }
  async function doPay() {
    await api.post(`/allowance/${selected.id}/pay`, { amount: Number(pay.amount), description: pay.description || 'Taschengeld', type: 'manual' });
    toast(`CHF ${pay.amount} ausgezahlt! 💰`, 'success');
    setPay({ amount: '', description: '' });
    setPayModal(false);
    loadDetail(selected);
    load();
  }
  async function doConfig() {
    await api.post(`/allowance/${selected.id}/config`, { ...config, amount: Number(config.amount), interest_rate: Number(config.interest_rate) || 0 });
    toast('Konfiguration gespeichert!', 'success');
    setConfigModal(false);
    loadDetail(selected);
  }
  async function addGoal() {
    await api.post(`/allowance/${selected.id}/goals`, { name: newGoal.name, target_amount: Number(newGoal.target_amount) });
    toast('Sparziel hinzugefügt! 🎯', 'success');
    setNewGoal({ name: '', target_amount: '' });
    setGoalModal(false);
    loadDetail(selected);
  }
  async function deleteGoal(gid) {
    if (!await confirmDialog('Sparziel wirklich löschen?')) return;
    await api.delete(`/allowance/${selected.id}/goals/${gid}`);
    loadDetail(selected);
  }

  async function doExpense() {
    if (!expense.amount || !expense.description) return toast('Betrag und Beschreibung angeben', 'error');
    const fd = new FormData();
    fd.append('amount', expense.amount);
    fd.append('description', expense.description);
    if (photoRef.current?.files[0]) {
      const resized = await resizeImage(photoRef.current.files[0]);
      fd.append('photo', resized, 'receipt.jpg');
    }
    await api.post(`/allowance/${selected.id}/expense`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    toast(`CHF ${expense.amount} Ausgabe gespeichert 🧾`, 'success');
    setExpense({ amount: '', description: '' });
    setPhotoPreview(null);
    if (photoRef.current) photoRef.current.value = '';
    setExpenseModal(false);
    loadDetail(selected);
    load();
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) setPhotoPreview(URL.createObjectURL(file));
    else setPhotoPreview(null);
  }

  return (
    <div className="page">
      <h1 className="page-title">💰 Taschengeld</h1>

      {!selected ? (
        <div className="flex flex-col gap-3">
          {children.map(c => (
            <div key={c.id} className="card flex items-center justify-between gap-3" onClick={() => loadDetail(c)} style={{ cursor: 'pointer' }}>
              <div className="flex items-center gap-3">
                <Avatar user={c} size={48} />
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-sm text-muted">CHF {(c.balance || 0).toFixed(2)} Guthaben · {(c.savings_balance || 0).toFixed(2)} Erspartes</div>
                </div>
              </div>
              <span style={{ fontSize: '1.3rem', color: 'var(--muted)' }}>›</span>
            </div>
          ))}
          {children.length === 0 && <div className="card text-center text-muted">Noch keine Kinder angelegt</div>}
        </div>
      ) : (
        <>
          <button className="btn-ghost mb-4" onClick={() => setSelected(null)}>← Zurück</button>

          <div className="flex items-center gap-3 mb-4">
            <Avatar user={selected} size={56} />
            <div>
              <h2 className="font-bold" style={{ fontSize: '1.3rem' }}>{selected.name}</h2>
            </div>
          </div>

          {/* Balances */}
          <div className="grid-2 mb-4">
            <div className="card text-center">
              <div style={{ fontSize: '2rem' }}>💰</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>
                {(detail?.account?.balance || 0).toFixed(2)}
              </div>
              <div className="text-muted text-sm">CHF Guthaben</div>
            </div>
            <div className="card text-center">
              <div style={{ fontSize: '2rem' }}>🐷</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                {(detail?.account?.savings_balance || 0).toFixed(2)}
              </div>
              <div className="text-muted text-sm">CHF Erspartes</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => setPayModal(true)}>💰 Auszahlen</button>
            <button className="w-full" style={{ flex: 1, background: '#fff1f2', color: '#be123c', border: '1.5px solid #fecdd3', borderRadius: 12, padding: '10px', fontWeight: 600 }}
              onClick={() => setExpenseModal(true)}>🧾 Ausgabe</button>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfigModal(true)}>⚙️ Konfig</button>
          </div>

          {/* Config info */}
          {detail?.config?.amount > 0 && (
            <div className="card mb-4" style={{ background: '#f0f7ff' }}>
              <div className="text-sm text-muted">Automatisches Taschengeld</div>
              <div className="font-bold">CHF {detail.config.amount} / {detail.config.interval === 'weekly' ? 'Woche' : 'Monat'}</div>
              {detail.config.interest_rate > 0 && <div className="text-sm text-muted">Zinssatz: {detail.config.interest_rate}%</div>}
              {detail.config.next_payout_at && <div className="text-sm text-muted">Nächste Auszahlung: {new Date(detail.config.next_payout_at).toLocaleDateString('de-CH')}</div>}
            </div>
          )}

          {/* Savings goals */}
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">🎯 Sparziele</h2>
              <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => setGoalModal(true)}>+</button>
            </div>
            {(detail?.goals || []).map(goal => (
              <div key={goal.id} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{goal.name}</span>
                  <div className="flex items-center gap-2">
                    {goal.achieved_at && <span className="tag tag-green">✓</span>}
                    <button style={{ background: 'none', color: 'var(--danger)', fontSize: '1.1rem' }} onClick={() => deleteGoal(goal.id)}>✕</button>
                  </div>
                </div>
                <ProgressBar value={goal.current_amount} max={goal.target_amount} />
                <div className="flex justify-between text-sm text-muted mt-1">
                  <span>CHF {goal.current_amount.toFixed(2)}</span>
                  <span>/ CHF {goal.target_amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {(detail?.goals || []).length === 0 && <p className="text-muted text-sm">Noch keine Sparziele</p>}
          </div>

          {/* Transaction history */}
          <div className="card">
            <h2 className="font-bold mb-3">Einnahmen &amp; Ausgaben</h2>
            <div className="flex flex-col gap-3">
              {(detail?.transactions || []).map(tx => (
                <div key={tx.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                  <div className="flex justify-between items-start gap-2">
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold text-sm">{tx.description}</div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        {TX_LABELS[tx.type] || tx.type} · {new Date(tx.created_at).toLocaleDateString('de-CH')}
                      </div>
                    </div>
                    <span className="font-bold" style={{ color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                      {tx.amount >= 0 ? '+' : ''}CHF {Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                  {tx.receipt_photo && (
                    <a href={tx.receipt_photo} target="_blank" rel="noopener noreferrer">
                      <img src={tx.receipt_photo} alt="Beleg"
                        style={{ marginTop: 8, maxHeight: 120, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} />
                    </a>
                  )}
                </div>
              ))}
              {(detail?.transactions || []).length === 0 && <p className="text-muted text-sm">Noch keine Transaktionen</p>}
            </div>
          </div>
        </>
      )}

      <Modal open={payModal} title="Taschengeld auszahlen" onClose={() => setPayModal(false)}>
        <div className="flex flex-col gap-3">
          <input type="number" placeholder="Betrag (CHF)" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} />
          <input placeholder="Beschreibung" value={pay.description} onChange={e => setPay(p => ({ ...p, description: e.target.value }))} />
          <button className="btn-primary w-full" onClick={doPay}>Auszahlen 💰</button>
        </div>
      </Modal>

      <Modal open={configModal} title="Taschengeld-Konfiguration" onClose={() => setConfigModal(false)}>
        <div className="flex flex-col gap-3">
          <input type="number" placeholder="Betrag (CHF)" value={config.amount} onChange={e => setConfig(c => ({ ...c, amount: e.target.value }))} />
          <select value={config.interval} onChange={e => setConfig(c => ({ ...c, interval: e.target.value }))}>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich</option>
          </select>
          <input type="number" placeholder="Zinssatz (% pro Monat, optional)" value={config.interest_rate}
            onChange={e => setConfig(c => ({ ...c, interest_rate: e.target.value }))} />
          <div>
            <label className="text-sm text-muted">Nächste automatische Auszahlung</label>
            <input type="date" value={config.next_payout_at} onChange={e => setConfig(c => ({ ...c, next_payout_at: e.target.value }))} />
          </div>
          <button className="btn-primary w-full" onClick={doConfig}>Speichern</button>
        </div>
      </Modal>

      <Modal open={expenseModal} title="🧾 Ausgabe erfassen" onClose={() => { setExpenseModal(false); setPhotoPreview(null); }}>
        <div className="flex flex-col gap-3">
          <input type="number" placeholder="Betrag (CHF)" value={expense.amount}
            onChange={e => setExpense(x => ({ ...x, amount: e.target.value }))} />
          <input placeholder="Beschreibung (z.B. Spielzeug Globus)" value={expense.description}
            onChange={e => setExpense(x => ({ ...x, description: e.target.value }))} />
          <div>
            <label className="text-sm text-muted mb-1" style={{ display: 'block' }}>Foto (optional, wird auf 500px verkleinert)</label>
            <input type="file" accept="image/*" ref={photoRef} onChange={handlePhotoChange}
              style={{ padding: '6px 0' }} />
            {photoPreview && (
              <img src={photoPreview} alt="Vorschau"
                style={{ marginTop: 8, maxHeight: 160, borderRadius: 10, objectFit: 'cover', width: '100%' }} />
            )}
          </div>
          <button style={{ background: '#be123c', color: '#fff', borderRadius: 12, padding: '12px', fontWeight: 700 }}
            onClick={doExpense}>
            Ausgabe buchen 🧾
          </button>
        </div>
      </Modal>

      <Modal open={goalModal} title="Neues Sparziel" onClose={() => setGoalModal(false)}>
        <div className="flex flex-col gap-3">
          <input placeholder="Name (z.B. LEGO Set)" value={newGoal.name} onChange={e => setNewGoal(g => ({ ...g, name: e.target.value }))} />
          <input type="number" placeholder="Betrag (CHF)" value={newGoal.target_amount} onChange={e => setNewGoal(g => ({ ...g, target_amount: e.target.value }))} />
          <button className="btn-primary w-full" onClick={addGoal}>Ziel erstellen 🎯</button>
        </div>
      </Modal>
    </div>
  );
}
