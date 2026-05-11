import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';

export default function BathPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const isParent = user.role === 'parent';
  const [status, setStatus] = useState(null);
  const [allChildren, setAllChildren] = useState([]);
  const [configModal, setConfigModal] = useState(false);
  const [selected, setSelected] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [statusRes, usersRes] = await Promise.all([
      api.get('/bath/status'),
      api.get('/users'),
    ]);
    setStatus(statusRes.data);
    setAllChildren(usersRes.data.filter(u => u.role === 'child'));
    setSelected(statusRes.data.participants.map(p => p.id));
  }

  async function recordTurn(uid) {
    await api.post('/bath/record', { user_id: uid });
    toast('Badetag gespeichert! 🛁', 'success');
    load();
  }

  async function undoLast() {
    if (!await confirmDialog('Letzten Badeintrag wirklich löschen?')) return;
    await api.delete('/bath/last');
    toast('Letzter Eintrag rückgängig gemacht', 'success');
    load();
  }

  async function saveConfig() {
    await api.put('/bath/participants', { user_ids: selected });
    toast('Teilnehmer gespeichert!', 'success');
    setConfigModal(false);
    load();
  }

  if (!status) return <div className="page text-center text-muted mt-4">Lädt...</div>;

  const { participants, turns, next, counts } = status;

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ margin: 0 }}>🛁 Badespass</h1>
        {isParent && (
          <button className="btn-ghost" style={{ padding: '8px 14px' }} onClick={() => setConfigModal(true)}>
            ⚙️
          </button>
        )}
      </div>

      {participants.length === 0 ? (
        <div className="card text-center" style={{ padding: 32 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛁</div>
          <p className="text-muted">Noch keine Kinder für den Badespass ausgewählt.</p>
          {isParent && (
            <button className="btn-primary mt-3" onClick={() => setConfigModal(true)}>
              Kinder auswählen
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Whose turn */}
          {next && (
            <div className="card mb-4" style={{ background: 'linear-gradient(135deg,#e0f2fe,#f0fff4)', textAlign: 'center', padding: 28 }}>
              <div className="text-muted text-sm mb-2">Heute darf wählen</div>
              <Avatar user={next} size={80} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{next.name}</div>
              {isParent && (
                <button className="btn-primary mt-4" style={{ padding: '12px 28px', fontSize: '1rem' }}
                  onClick={() => recordTurn(next.id)}>
                  🛁 Badetag aufzeichnen
                </button>
              )}
            </div>
          )}

          {/* Choice counts */}
          <div className="card mb-4">
            <h2 className="font-bold mb-3">Zählstand</h2>
            <div className="flex flex-col gap-2">
              {participants.map(p => {
                const isNext = next?.id === p.id;
                const maxCount = Math.max(...participants.map(x => counts[x.id] || 0));
                const myCount = counts[p.id] || 0;
                const debt = maxCount - myCount;
                return (
                  <div key={p.id} className="flex items-center gap-3"
                    style={{ background: isNext ? '#f0fff4' : '#f8faff', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${isNext ? 'var(--success)' : '#e0e7ef'}` }}>
                    <Avatar user={p} size={40} />
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-muted">{myCount}× gewählt</div>
                    </div>
                    {isNext && <span className="tag tag-green">Dran! 🛁</span>}
                    {debt > 0 && !isNext && (
                      <span className="tag" style={{ background: '#fef3c7', color: '#92400e' }}>+{debt} ausstehend</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* History */}
          {turns.length > 0 && (
            <div className="card">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold">Verlauf</h2>
                {isParent && turns.length > 0 && (
                  <button className="btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={undoLast}>
                    ↩ Rückgängig
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {turns.slice(0, 10).map(t => (
                  <div key={t.id} className="flex justify-between items-center"
                    style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-muted text-sm">
                      {new Date(t.bath_date).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Config modal */}
      <Modal open={configModal} title="Badespass-Teilnehmer" onClose={() => setConfigModal(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Welche Kinder nehmen am Badespass teil?</p>
          <div className="flex flex-col gap-2">
            {allChildren.map(child => {
              const on = selected.includes(child.id);
              return (
                <label key={child.id} className="flex items-center gap-3"
                  style={{ background: on ? '#f0fff4' : '#f8faff', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${on ? 'var(--success)' : '#e0e7ef'}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on}
                    onChange={() => setSelected(s => on ? s.filter(id => id !== child.id) : [...s, child.id])} />
                  <Avatar user={child} size={36} />
                  <span className="font-semibold">{child.name}</span>
                </label>
              );
            })}
          </div>
          <button className="btn-primary w-full" onClick={saveConfig}>Speichern</button>
        </div>
      </Modal>
    </div>
  );
}
