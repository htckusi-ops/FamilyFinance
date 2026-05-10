import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

export default function PointsPage({ childId }) {
  const { user } = useAuth();
  const toast = useToast();
  const isParent = user.role === 'parent';
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(childId ? String(childId) : '');
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState(null);
  const [settings, setSettings] = useState({});
  const [jobModal, setJobModal] = useState(false);
  const [awardModal, setAwardModal] = useState(false);
  const [deductModal, setDeductModal] = useState(false);
  const [newJob, setNewJob] = useState({ name: '', points: '', recurrence: 'manual', job_type: 'extra' });
  const [freeAward, setFreeAward] = useState({ delta: '', description: '' });
  const [deduct, setDeduct] = useState({ points: '5', reason: '' });

  const DEDUCT_PRESETS = [
    'TV/Tablet-Zeit überschritten',
    'Aufforderungen nicht nachgekommen',
    'Vereinbarung gebrochen',
    'Unehrlichkeit',
    'Geschwister geärgert',
  ];

  useEffect(() => {
    api.get('/points/jobs').then(r => setJobs(r.data));
    api.get('/settings').then(r => setSettings(r.data)).catch(() => {});
    if (isParent) api.get('/users').then(r => setChildren(r.data.filter(u => u.role === 'child')));
  }, []);

  useEffect(() => {
    const uid = selectedChild || childId;
    if (uid) api.get(`/points/${uid}`).then(r => setHistory(r.data)).catch(() => {});
  }, [selectedChild, childId]);

  const duties = jobs.filter(j => j.job_type === 'duty');
  const extras = jobs.filter(j => j.job_type === 'extra');
  const showStreak = settings.show_streak !== 'false';

  async function awardJob(job) {
    if (!selectedChild && !childId) return toast('Bitte Kind auswählen', 'error');
    const uid = selectedChild || childId;
    if (job.points > 0) {
      await api.post('/points/award', { user_id: uid, delta: job.points, description: job.name, mini_job_id: job.id });
      toast(`+${job.points} Punkte für ${job.name}! ⭐`, 'success');
      api.get(`/points/${uid}`).then(r => setHistory(r.data));
    } else {
      toast(`✅ ${job.name} erledigt – danke!`, 'success');
    }
  }

  async function doDeduct() {
    if (!selectedChild && !childId) return toast('Bitte Kind auswählen', 'error');
    if (!deduct.reason.trim()) return toast('Bitte Grund angeben', 'error');
    const uid = selectedChild || childId;
    const pts = -Math.abs(Number(deduct.points));
    await api.post('/points/award', { user_id: uid, delta: pts, description: deduct.reason });
    toast(`${pts} Punkte abgezogen`, 'success');
    setDeduct({ points: '5', reason: '' });
    setDeductModal(false);
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
    const pts = newJob.job_type === 'duty' ? 0 : Number(newJob.points);
    await api.post('/points/jobs', { ...newJob, points: pts });
    toast('Job gespeichert!', 'success');
    setNewJob({ name: '', points: '', recurrence: 'manual', job_type: 'extra' });
    setJobModal(false);
    api.get('/points/jobs').then(r => setJobs(r.data));
  }

  async function deleteJob(id) {
    await api.delete(`/points/jobs/${id}`);
    api.get('/points/jobs').then(r => setJobs(r.data));
  }

  function JobList({ items, isDuty }) {
    if (items.length === 0) return <p className="text-muted text-sm">Noch keine {isDuty ? 'Pflichten' : 'Extra-Jobs'} definiert</p>;
    return (
      <div className="flex flex-col gap-2">
        {items.map(job => (
          <div key={job.id} className="flex justify-between items-center"
            style={{ background: isDuty ? '#f0fff4' : '#f8faff', padding: '10px 14px', borderRadius: 12, borderLeft: `3px solid ${isDuty ? 'var(--success)' : 'var(--primary)'}` }}>
            <div>
              <span className="font-semibold">{job.name}</span>
              <span className="text-muted text-sm ml-2">
                ({job.recurrence === 'manual' ? 'manuell' : job.recurrence === 'daily' ? 'täglich' : 'wöchentlich'})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isDuty && job.points === 0
                ? <span className="tag tag-green">Pflicht</span>
                : <span className="tag tag-blue">+{job.points} ⭐</span>
              }
              {isParent && (
                <>
                  <button
                    className={isDuty && job.points === 0 ? 'btn-ghost' : 'btn-primary'}
                    style={{ padding: '6px 12px', ...(isDuty && job.points === 0 ? { borderColor: 'var(--success)', color: 'var(--success)' } : {}) }}
                    onClick={() => awardJob(job)}>
                    ✓
                  </button>
                  <button style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 10px', borderRadius: 8 }} onClick={() => deleteJob(job.id)}>✕</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">⭐ Punkte</h1>

      {isParent && (
        <div className="card mb-4">
          <label className="font-semibold mb-2" style={{ display: 'block' }}>Kind auswählen</label>
          <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}>
            <option value="">— bitte wählen —</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {history && (
        <div className="card mb-4" style={{ background: 'linear-gradient(135deg,#fef9c3,#fff7ed)' }}>
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent)' }}>
                {history.summary?.balance || 0}
              </div>
              <div className="text-muted">Punkte Guthaben</div>
            </div>
            {showStreak && (history.summary?.streak_weeks || 0) > 0 && (
              <div className="text-center">
                <div style={{ fontSize: '2rem' }}>🔥</div>
                <div className="font-bold">{history.summary.streak_weeks}</div>
                <div className="text-sm text-muted">Wochen</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Household duties */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="font-bold">{settings.duty_jobs_label || 'Haushaltspflichten'}</h2>
            <p className="text-sm text-muted">Gehören zur Familiengemeinschaft · keine Punkte</p>
          </div>
          {isParent && <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={() => { setNewJob(j => ({ ...j, job_type: 'duty' })); setJobModal(true); }}>+</button>}
        </div>
        <JobList items={duties} isDuty />
      </div>

      {/* Extra jobs */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="font-bold">{settings.extra_jobs_label || 'Extra-Jobs'}</h2>
            <p className="text-sm text-muted">Freiwillig · werden mit Punkten belohnt</p>
          </div>
          {isParent && <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={() => { setNewJob(j => ({ ...j, job_type: 'extra' })); setJobModal(true); }}>+</button>}
        </div>
        <JobList items={extras} isDuty={false} />
        {isParent && (
          <div className="flex gap-2 mt-3">
            <button className="btn-ghost w-full" onClick={() => setAwardModal(true)}>
              ✏️ Spontane Punkte
            </button>
            <button className="w-full" style={{ background: '#fff1f2', color: '#be123c', border: '1.5px solid #fecdd3', borderRadius: 12, padding: '10px 12px', fontWeight: 600, fontSize: '0.9rem' }}
              onClick={() => setDeductModal(true)}>
              ⚠️ Abzug
            </button>
          </div>
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

      <Modal open={jobModal} title={`Neuer ${newJob.job_type === 'duty' ? 'Haushaltspflicht' : 'Extra-Job'}`} onClose={() => setJobModal(false)}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {['duty', 'extra'].map(t => (
              <button key={t} onClick={() => setNewJob(j => ({ ...j, job_type: t }))}
                style={{ flex: 1, padding: '10px', borderRadius: 12, background: newJob.job_type === t ? (t === 'duty' ? 'var(--success)' : 'var(--primary)') : '#e0e7ef', color: newJob.job_type === t ? '#fff' : 'var(--text)', fontWeight: 600 }}>
                {t === 'duty' ? '🏠 Pflicht' : '⭐ Extra-Job'}
              </button>
            ))}
          </div>
          <input placeholder="Name (z.B. Zimmer aufräumen)" value={newJob.name}
            onChange={e => setNewJob(j => ({ ...j, name: e.target.value }))} />
          <input type="number" placeholder={newJob.job_type === 'duty' ? 'Punkte (0 = nur bestätigen)' : 'Punkte'} value={newJob.points}
            onChange={e => setNewJob(j => ({ ...j, points: e.target.value }))} />
          <select value={newJob.recurrence} onChange={e => setNewJob(j => ({ ...j, recurrence: e.target.value }))}>
            <option value="manual">Manuell</option>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
          </select>
          <button className="btn-primary w-full" onClick={addJob}>Speichern</button>
        </div>
      </Modal>

      <Modal open={deductModal} title="⚠️ Punkte abziehen" onClose={() => setDeductModal(false)}>
        <div className="flex flex-col gap-3">
          <div style={{ background: '#fff1f2', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem', color: '#be123c' }}>
            Abzüge sollten immer mit einem Gespräch verbunden sein — nicht als automatische Strafe.
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Grund (Schnellauswahl)</div>
            <div className="flex flex-col gap-1">
              {DEDUCT_PRESETS.map(p => (
                <button key={p}
                  style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 10, background: deduct.reason === p ? '#fff1f2' : '#f8faff', border: `1.5px solid ${deduct.reason === p ? '#fca5a5' : '#e0e7ef'}`, fontWeight: deduct.reason === p ? 700 : 400, fontSize: '0.85rem', color: deduct.reason === p ? '#be123c' : 'var(--text)' }}
                  onClick={() => setDeduct(d => ({ ...d, reason: p }))}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <input placeholder="Oder eigener Grund..." value={deduct.reason}
            onChange={e => setDeduct(d => ({ ...d, reason: e.target.value }))} />
          <div>
            <div className="text-sm font-semibold mb-1">Punkte abziehen</div>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="30" value={deduct.points}
                onChange={e => setDeduct(d => ({ ...d, points: e.target.value }))}
                style={{ flex: 1 }} />
              <span className="font-bold" style={{ color: '#be123c', minWidth: 40 }}>−{deduct.points}</span>
            </div>
          </div>
          <button style={{ background: '#be123c', color: '#fff', borderRadius: 12, padding: '12px', fontWeight: 700, fontSize: '0.95rem' }}
            onClick={doDeduct}>
            Abzug bestätigen
          </button>
        </div>
      </Modal>

      <Modal open={awardModal} title="Spontane Punktvergabe" onClose={() => setAwardModal(false)}>
        <div className="flex flex-col gap-3">
          <input type="number" placeholder="Punkte (negativ für Abzug)" value={freeAward.delta}
            onChange={e => setFreeAward(a => ({ ...a, delta: e.target.value }))} />
          {Number(freeAward.delta) < 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem', color: '#92400e' }}>
              ⚠️ <strong>Punkteabzug:</strong> Negative Punkte als Strafe können das Vertrauen beeinträchtigen. Bitte nur mit Erklärung und im Gespräch einsetzen.
            </div>
          )}
          <input placeholder="Beschreibung" value={freeAward.description}
            onChange={e => setFreeAward(a => ({ ...a, description: e.target.value }))} />
          <button className="btn-accent w-full" onClick={awardFree}>Vergeben ⭐</button>
        </div>
      </Modal>
    </div>
  );
}
