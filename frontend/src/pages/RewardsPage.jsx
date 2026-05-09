import { useEffect, useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';

export default function RewardsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isParent = user.role === 'parent';
  const [rewards, setRewards] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', points_required: '', image: '' });

  useEffect(() => { load(); }, []);
  async function load() {
    const r = await api.get('/rewards');
    setRewards(r.data);
  }
  async function save() {
    await api.post('/rewards', form);
    toast('Belohnung gespeichert! 🎁', 'success');
    setForm({ name: '', points_required: '', image: '' });
    setModal(false);
    load();
  }
  async function del(id) {
    await api.delete(`/rewards/${id}`);
    load();
  }

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ margin: 0 }}>🎁 Belohnungen</h1>
        {isParent && <button className="btn-primary" style={{ padding: '10px 18px' }} onClick={() => setModal(true)}>+ Neu</button>}
      </div>

      <div className="flex flex-col gap-3">
        {rewards.map(r => (
          <div key={r.id} className="card flex justify-between items-center gap-3">
            <div className="flex-1">
              <div className="font-bold">{r.image && <span>{r.image} </span>}{r.name}</div>
              <div className="tag tag-yellow mt-1">{r.points_required} ⭐ benötigt</div>
            </div>
            {isParent && (
              <button style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 10 }} onClick={() => del(r.id)}>✕</button>
            )}
          </div>
        ))}
        {rewards.length === 0 && <div className="card text-center text-muted">Noch keine Belohnungen definiert</div>}
      </div>

      <Modal open={modal} title="Neue Belohnung" onClose={() => setModal(false)}>
        <div className="flex flex-col gap-3">
          <input placeholder="Name (z.B. Kinobesuch)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input type="number" placeholder="Benötigte Punkte" value={form.points_required}
            onChange={e => setForm(f => ({ ...f, points_required: e.target.value }))} />
          <input placeholder="Emoji Icon (z.B. 🎬)" value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} />
          <button className="btn-primary w-full" onClick={save}>Speichern</button>
        </div>
      </Modal>
    </div>
  );
}
