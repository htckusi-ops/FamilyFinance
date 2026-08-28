import { useEffect, useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Modal from '../components/Modal';

export default function RewardsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const isParent = user.role === 'parent';
  const [rewards, setRewards] = useState([]);
  const [children, setChildren] = useState([]);
  const [modal, setModal] = useState(false);
  const [editReward, setEditReward] = useState(null);
  const blank = { name: '', points_required: '', image: '', targets: [], require_all: false };
  const [form, setForm] = useState(blank);

  useEffect(() => { load(); }, []);

  async function load() {
    const [rr, ur] = await Promise.all([api.get('/rewards'), api.get('/users')]);
    setRewards(rr.data);
    setChildren(ur.data.filter(u => u.role === 'child'));
  }

  function toggleTarget(arr, uid) {
    return arr.includes(uid) ? arr.filter(x => x !== uid) : [...arr, uid];
  }

  async function save() {
    const payload = {
      name: form.name,
      points_required: form.points_required,
      image: form.image || null,
      targets: JSON.stringify(form.targets),
      require_all: form.targets.length > 1 && form.require_all ? '1' : '0',
    };
    await api.post('/rewards', payload);
    toast('Belohnung gespeichert! 🎁', 'success');
    setForm(blank);
    setModal(false);
    load();
  }

  async function saveEdit() {
    const payload = {
      name: editReward.name,
      points_required: editReward.points_required,
      image: editReward.image || null,
      targets: JSON.stringify(editReward.targets.map(t => t.user_id ?? t)),
      require_all: editReward.targets.length > 1 && editReward.require_all ? '1' : '0',
    };
    await api.patch(`/rewards/${editReward.id}`, payload);
    toast('Belohnung aktualisiert ✓', 'success');
    setEditReward(null);
    load();
  }

  async function del(id) {
    if (!await confirmDialog('Belohnung wirklich löschen?')) return;
    await api.delete(`/rewards/${id}`);
    load();
  }

  async function claim(id) {
    try {
      await api.post(`/rewards/${id}/claim`);
      toast('Eingelöst! Warten auf Eltern-Freigabe 🎉', 'success');
      load();
    } catch (e) {
      toast(e.response?.data?.error || 'Fehler', 'error');
    }
  }

  function TargetBadges({ targets }) {
    if (!targets?.length) return <span className="tag" style={{ background: '#f0f4ff', color: '#555', fontSize: '0.65rem' }}>Alle Kinder</span>;
    return (
      <span className="flex gap-1 flex-wrap">
        {targets.map(t => (
          <span key={t.user_id} className="tag" style={{ background: t.color + '22', color: t.color, fontSize: '0.65rem', fontWeight: 600 }}>
            {t.name}
          </span>
        ))}
      </span>
    );
  }

  function ChildSelector({ selected, onChange }) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>Gilt für (leer = alle Kinder):</div>
        <div className="flex flex-wrap gap-2">
          {children.map(c => {
            const on = selected.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => onChange(toggleTarget(selected, c.id))}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
                  border: `2px solid ${c.color}`,
                  background: on ? c.color : 'transparent',
                  color: on ? '#fff' : c.color,
                  cursor: 'pointer',
                }}>
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ margin: 0 }}>🎁 Belohnungen</h1>
        {isParent && <button className="btn-primary" style={{ padding: '10px 18px' }} onClick={() => { setForm(blank); setModal(true); }}>+ Neu</button>}
      </div>

      <div className="flex flex-col gap-3">
        {rewards.map(r => (
          <div key={r.id} className="card" style={{ opacity: (r.canClaim === false) ? 0.7 : 1 }}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="font-bold" style={{ fontSize: '1rem' }}>
                  {r.image && <span style={{ marginRight: 6 }}>{r.image}</span>}{r.name}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="tag tag-yellow">{r.points_required} ⭐</span>
                  {r.require_all && r.targets?.length > 1 && (
                    <span className="tag" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.65rem' }}>alle müssen erreichen</span>
                  )}
                  <TargetBadges targets={r.targets} />
                </div>

                {/* Child view: progress for require_all rewards */}
                {r.targetPoints && (
                  <div className="flex flex-col gap-1 mt-2">
                    {r.targetPoints.map(t => (
                      <div key={t.user_id} className="flex items-center gap-2" style={{ fontSize: '0.75rem' }}>
                        <span style={{ color: t.color, fontWeight: 600, minWidth: 60 }}>{t.name}</span>
                        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            background: t.points >= r.points_required ? '#22c55e' : t.color,
                            width: `${Math.min(100, (t.points / r.points_required) * 100)}%`,
                          }} />
                        </div>
                        <span style={{ color: t.points >= r.points_required ? '#16a34a' : '#6b7280' }}>
                          {t.points}/{r.points_required}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Single-child progress bar */}
                {!r.targetPoints && r.myPoints !== undefined && (
                  <div className="flex items-center gap-2 mt-2" style={{ fontSize: '0.75rem' }}>
                    <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: r.canClaim ? '#22c55e' : '#6366f1',
                        width: `${Math.min(100, (r.myPoints / r.points_required) * 100)}%`,
                      }} />
                    </div>
                    <span style={{ color: r.canClaim ? '#16a34a' : '#6b7280' }}>{r.myPoints}/{r.points_required}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 items-start">
                {!isParent && r.canClaim && (
                  <button className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => claim(r.id)}>
                    Einlösen
                  </button>
                )}
                {isParent && (
                  <>
                    <button style={{ background: '#e0f2fe', color: '#0369a1', padding: '8px 12px', borderRadius: 10 }}
                      onClick={() => setEditReward({ ...r, targets: r.targets || [] })}>✏️</button>
                    <button style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 10 }}
                      onClick={() => del(r.id)}>✕</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {rewards.length === 0 && <div className="card text-center text-muted">Noch keine Belohnungen definiert</div>}
      </div>

      {/* New reward modal */}
      <Modal open={modal} title="Neue Belohnung" onClose={() => setModal(false)}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div style={{ fontSize: '2.4rem', minWidth: 48, textAlign: 'center', background: '#f8faff', borderRadius: 12, padding: '6px 0' }}>
              {form.image || '🎁'}
            </div>
            <input placeholder="Emoji Icon (z.B. 🎬)" value={form.image}
              onChange={e => setForm(f => ({ ...f, image: e.target.value }))} maxLength={4} style={{ flex: 1, fontSize: '1.3rem' }} />
          </div>
          <input placeholder="Name (z.B. Kinobesuch)" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input type="number" placeholder="Benötigte Punkte" value={form.points_required}
            onChange={e => setForm(f => ({ ...f, points_required: e.target.value }))} />
          <ChildSelector selected={form.targets} onChange={v => setForm(f => ({ ...f, targets: v, require_all: v.length < 2 ? false : f.require_all }))} />
          {form.targets.length > 1 && (
            <label className="flex items-center gap-2" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.require_all} onChange={e => setForm(f => ({ ...f, require_all: e.target.checked }))} />
              Alle ausgewählten Kinder müssen die Punktzahl erreichen
            </label>
          )}
          <button className="btn-primary w-full" onClick={save}>Speichern</button>
        </div>
      </Modal>

      {/* Edit reward modal */}
      <Modal open={!!editReward} title="Belohnung bearbeiten" onClose={() => setEditReward(null)}>
        {editReward && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div style={{ fontSize: '2.4rem', minWidth: 48, textAlign: 'center', background: '#f8faff', borderRadius: 12, padding: '6px 0' }}>
                {editReward.image || '🎁'}
              </div>
              <input placeholder="Emoji Icon (z.B. 🎬)" value={editReward.image || ''}
                onChange={e => setEditReward(r => ({ ...r, image: e.target.value }))} maxLength={4} style={{ flex: 1, fontSize: '1.3rem' }} />
            </div>
            <input placeholder="Name" value={editReward.name}
              onChange={e => setEditReward(r => ({ ...r, name: e.target.value }))} />
            <input type="number" placeholder="Benötigte Punkte" value={editReward.points_required}
              onChange={e => setEditReward(r => ({ ...r, points_required: e.target.value }))} />
            <ChildSelector
              selected={editReward.targets.map(t => t.user_id ?? t)}
              onChange={v => setEditReward(r => ({ ...r, targets: children.filter(c => v.includes(c.id)).map(c => ({ user_id: c.id, name: c.name, color: c.color })), require_all: v.length < 2 ? false : r.require_all }))}
            />
            {editReward.targets.length > 1 && (
              <label className="flex items-center gap-2" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!editReward.require_all}
                  onChange={e => setEditReward(r => ({ ...r, require_all: e.target.checked }))} />
                Alle ausgewählten Kinder müssen die Punktzahl erreichen
              </label>
            )}
            <button className="btn-primary w-full" onClick={saveEdit}>Speichern ✓</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
