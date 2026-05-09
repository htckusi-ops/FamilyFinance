import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';

export default function PointsPage({ childId }) {
  const { user } = useAuth();
  const toast = useToast();
  const isParent = user.role === 'parent';
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(childId ? String(childId) : '');
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState(null);
  const [jobModal, setJobModal] = useState(false);
  const [awardModal, setAwardModal] = useState(false);
  const [newJob, setNewJob] = useState({ name: '', points: '', recurrence: 'manual' });
  const [freeAward, setFreeAward] = useState({ delta: '', description: '' });

  useEffect(() => {
    api.get('/points/jobs').then(r => setJobs(r.data));
    if (isParent) api.get('/users').then(r => setChildren(r.data.filter(u => u.role === 'child')));
  }, []);

  useEffect(() => {
    if (selectedChild || childId) {
      const uid = selectedChild || childId;
      api.get(`/points/${uid}`).then(r => setHistory(r.data)).catch(() => {});
    }
  }, [selectedChild, childId]);

  async function awardJob(job) {
    if (!selectedChild && !childId) return toast('Bitte Kind auswählen', 'error');
    const uid = selectedChild || childId;
    await api.post('/points/award', { user_id: uid, delta: job.points, description: job.name, mini_job_id: job.id });
    toast(`+${job.points} Punkte für ${job.name}! ⭐`, 'success');
    api.get(`/points/${uid}`).then(r => setHistory(r.data));
  }

  async function awardFree() {
    if (!selectedChild && !childId) return toast('Bitte Kind auswählen', 'error');
    const uid = selectedChild || childId;
    await api.post('/points/award', { user_id: uid, delta: Number(freeAward.delta), description: freeAward.description || 'Punkte' });
    toast(`${freeAward.delta} Punkte vergeben! ⭐`, 'success');
    setFreeAward({ delta: '', description: '' });
    setAwardModal(false);
    api.get(`/points/${uid}`).then(r => setHistory(r.data));
  }

  async function addJob() {
    await api.post('/points/jobs', newJob);
    toast('Mini-Job gespeichert!', 'success');
    setNewJob({ name: '', points: '', recurrence: 'manual' });
    setJobModal(false);
    api.get('/points/jobs').then(r => setJobs(r.data));
  }

  async function deleteJob(id) {
    await api.delete(`/points/jobs/${id}`);
    api.get('/points/jobs').then(r => setJobs(r.data));
  }

  return (
    <div className="page">
      <h1 className="page-title">⭐ Punkte</h1>

      {isParent && (
        <div className="card mb-4">
          <label className="font-semibold mb-2 flex" style={{ display: 'block' }}>Kind auswählen</label>
          <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}>
            <option value="">— bitte wählen —</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {history && (
        <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #fef9c3, #fff7ed)' }}>
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent)' }}>
                {history.summary?.balance || 0}
              </div>
              <div className="text-muted">Punkte Guthaben</div>
            </div>
            {(history.summary?.streak_weeks || 0) > 0 && (
              <div className="text-center">
                <div style={{ fontSize: '2rem' }}>🔥</div>
                <div className="font-bold">{history.summary.streak_weeks}</div>
                <div className="text-sm text-muted">Wochen</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mini-jobs */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold">Mini-Jobs</h2>
          {isParent && <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={() => setJobModal(true)}>+ Job</button>}
        </div>
        <div className="flex flex-col gap-2">
          {jobs.map(job => (
            <div key={job.id} className="flex justify-between items-center" style={{ background: '#f8faff', padding: '10px 14px', borderRadius: 12 }}>
              <div>
                <span className="font-semibold">{job.name}</span>
                <span className="text-muted text-sm ml-2">({job.recurrence === 'manual' ? 'manuell' : job.recurrence === 'daily' ? 'täglich' : 'wöchentlich'})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tag tag-blue">+{job.points} ⭐</span>
                {isParent && (
                  <>
                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => awardJob(job)}>✓</button>
                    <button style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 10px', borderRadius: 8 }} onClick={() => deleteJob(job.id)}>✕</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {jobs.length === 0 && <p className="text-muted text-sm">Noch keine Mini-Jobs definiert</p>}
        </div>
        {isParent && (
          <button className="btn-ghost w-full mt-3" onClick={() => setAwardModal(true)}>
            ✏️ Freie Punktvergabe
          </button>
        )}
      </div>

      {/* History */}
      {history?.events?.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-3">Verlauf</h2>
          <div className="flex flex-col gap-2">
            {history.events.map(e => (
              <div key={e.id} className="flex justify-between items-center" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                <div>
                  <div className="font-semibold text-sm">{e.description || e.job_name || '—'}</div>
                  <div className="text-muted text-sm">{new Date(e.created_at).toLocaleDateString('de-CH')}</div>
                </div>
                <span className="font-bold" style={{ color: e.delta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {e.delta >= 0 ? '+' : ''}{e.delta} ⭐
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job modal */}
      <Modal open={jobModal} title="Neuer Mini-Job" onClose={() => setJobModal(false)}>
        <div className="flex flex-col gap-3">
          <input placeholder="Name (z.B. Zimmer aufräumen)" value={newJob.name} onChange={e => setNewJob(j => ({ ...j, name: e.target.value }))} />
          <input type="number" placeholder="Punkte" value={newJob.points} onChange={e => setNewJob(j => ({ ...j, points: e.target.value }))} />
          <select value={newJob.recurrence} onChange={e => setNewJob(j => ({ ...j, recurrence: e.target.value }))}>
            <option value="manual">Manuell</option>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
          </select>
          <button className="btn-primary w-full" onClick={addJob}>Speichern</button>
        </div>
      </Modal>

      {/* Free award modal */}
      <Modal open={awardModal} title="Freie Punktvergabe" onClose={() => setAwardModal(false)}>
        <div className="flex flex-col gap-3">
          <input type="number" placeholder="Punkte (negativ für Abzug)" value={freeAward.delta}
            onChange={e => setFreeAward(a => ({ ...a, delta: e.target.value }))} />
          <input placeholder="Beschreibung" value={freeAward.description}
            onChange={e => setFreeAward(a => ({ ...a, description: e.target.value }))} />
          <button className="btn-accent w-full" onClick={awardFree}>Vergeben ⭐</button>
        </div>
      </Modal>
    </div>
  );
}
