import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Modal from '../components/Modal';

export default function FleaMarketPage({ childId }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const isParent = user.role === 'parent';
  const [days, setDays] = useState([]);
  const [archive, setArchive] = useState([]);
  const [dayModal, setDayModal] = useState(false);
  const [newDay, setNewDay] = useState({ date: '', name: '' });

  useEffect(() => { load(); }, []);
  async function load() {
    const r = await api.get('/flea/days');
    setDays(r.data);
    if (isParent) {
      const items = await api.get('/flea/items?status=unsold');
      // archive is items without a day or unsold
    }
  }
  async function createDay() {
    await api.post('/flea/days', newDay);
    toast('Flohmarkttag erstellt! 🏷️', 'success');
    setNewDay({ date: '', name: '' });
    setDayModal(false);
    load();
  }
  async function deleteDay(id) {
    if (!await confirmDialog('Flohmarkttag wirklich löschen? Alle Artikel dieses Tages werden ebenfalls gelöscht.')) return;
    await api.delete(`/flea/days/${id}`);
    load();
  }

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ margin: 0 }}>🏷️ Flohmarkt</h1>
        {isParent && <button className="btn-primary" style={{ padding: '10px 18px' }} onClick={() => setDayModal(true)}>+ Tag</button>}
      </div>

      {/* Child view: their items */}
      {!isParent && childId && <ChildFleaView childId={childId} />}

      {/* Parent view: days */}
      {isParent && (
        <>
          <div className="flex flex-col gap-3">
            {days.map(day => (
              <div key={day.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold">{day.name}</div>
                    <div className="text-muted text-sm">{new Date(day.date).toLocaleDateString('de-CH')}</div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/flea/day/${day.id}`}>
                      <button className="btn-primary" style={{ padding: '8px 16px' }}>Öffnen</button>
                    </Link>
                    <button style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 10 }}
                      onClick={() => deleteDay(day.id)}>✕</button>
                  </div>
                </div>
              </div>
            ))}
            {days.length === 0 && (
              <div className="card text-center text-muted">
                <p>Noch keine Flohmarkttage angelegt.</p>
                <p className="text-sm mt-1">Erstelle einen Tag und füge Artikel hinzu.</p>
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={dayModal} title="Neuer Flohmarkttag" onClose={() => setDayModal(false)}>
        <div className="flex flex-col gap-3">
          <input type="date" value={newDay.date} onChange={e => setNewDay(d => ({ ...d, date: e.target.value }))} />
          <input placeholder="Name (z.B. Schulflohmarkt)" value={newDay.name}
            onChange={e => setNewDay(d => ({ ...d, name: e.target.value }))} />
          <button className="btn-primary w-full" onClick={createDay}>Erstellen</button>
        </div>
      </Modal>
    </div>
  );
}

function ChildFleaView({ childId }) {
  const [items, setItems] = useState([]);
  const [earnings, setEarnings] = useState(0);

  useEffect(() => {
    api.get(`/flea/items?user_id=${childId}`).then(r => {
      setItems(r.data);
      const sold = r.data.filter(i => i.status === 'sold');
      setEarnings(sold.reduce((s, i) => s + (i.sold_price || 0), 0));
    });
  }, [childId]);

  return (
    <div>
      <div className="card mb-4" style={{ background: 'linear-gradient(135deg,#fff7ed,#fffbeb)' }}>
        <div className="text-muted text-sm">Meine Flohmarkt-Erlöse</div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>CHF {earnings.toFixed(2)}</div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map(item => (
          <div key={item.id} className="card flex justify-between items-center">
            <div>
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-muted">Richtpreis: CHF {item.suggested_price}</div>
            </div>
            <span className={`tag ${item.status === 'sold' ? 'tag-green' : item.status === 'unsold' ? 'tag-red' : 'tag-blue'}`}>
              {item.status === 'sold' ? `✓ CHF ${item.sold_price}` : item.status === 'unsold' ? 'Nicht verkauft' : 'Verfügbar'}
            </span>
          </div>
        ))}
        {items.length === 0 && <div className="card text-center text-muted">Noch keine Artikel erfasst</div>}
      </div>
    </div>
  );
}
