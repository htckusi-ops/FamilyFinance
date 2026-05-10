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
  const [convertModal, setConvertModal] = useState(null); // 'points_to_chf' | 'chf_to_points'
  const [convertAmount, setConvertAmount] = useState('');
  const [newJob, setNewJob] = useState({ name: '', points: '', recurrence: 'manual', job_type: 'extra', image: '' });
  const [editJob, setEditJob] = useState(null);
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
    setHistory(null); // veraltete Daten sofort ausblenden beim Kind-Wechsel
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

  async function doConvert() {
    const uid = selectedChild || childId;
    const pts = Number(convertAmount);
    if (!pts || pts <= 0) return toast('Bitte Punkte eingeben', 'error');
    try {
      const r = await api.post('/points/convert', { user_id: uid, direction: convertModal, points: pts });
      const rate = parseFloat(settings.point_value_chf || '0.10');
      if (convertModal === 'points_to_chf') {
        toast(`${pts} Punkte → CHF ${(pts * rate).toFixed(2)} gutgeschrieben! 💰`, 'success');
      } else {
        toast(`CHF ${(pts * rate).toFixed(2)} → ${pts} Punkte gutgeschrieben! ⭐`, 'success');
      }
      setConvertModal(null);
      setConvertAmount('');
      const uid2 = selectedChild || childId;
      api.get(`/points/${uid2}`).then(r => setHistory(r.data));
    } catch (err) {
      toast(err.response?.data?.error || 'Fehler beim Umtausch', 'error');
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
    const pts = newJob.job_type === 'duty' ? Number(newJob.points) || 0 : Number(newJob.points);
    await api.post('/points/jobs', { ...newJob, points: pts, image: newJob.image || null });
    toast('Job gespeichert!', 'success');
    setNewJob({ name: '', points: '', recurrence: 'manual', job_type: 'extra', image: '' });
    setJobModal(false);
    api.get('/points/jobs').then(r => setJobs(r.data));
  }

  async function deleteJob(id) {
    await api.delete(`/points/jobs/${id}`);
    api.get('/points/jobs').then(r => setJobs(r.data));
  }

  async function saveEditJob() {
    await api.patch(`/points/jobs/${editJob.id}`, {
      name: editJob.name,
      points: Number(editJob.points) || 0,
      recurrence: editJob.recurrence,
      image: editJob.image || null,
    });
    toast('Job aktualisiert ✓', 'success');
    setEditJob(null);
    api.get('/points/jobs').then(r => setJobs(r.data));
  }

  function JobList({ items, isDuty }) {
    if (items.length === 0) return <p className="text-muted text-sm">Noch keine {isDuty ? 'Pflichten' : 'Extra-Jobs'} definiert</p>;
    return (
      <div className="flex flex-col gap-2">
        {items.map(job => (
          <div key={job.id} className="flex items-center gap-3"
            style={{ background: isDuty ? '#f0fff4' : '#f8faff', padding: '10px 12px', borderRadius: 14, borderLeft: `3px solid ${isDuty ? 'var(--success)' : 'var(--primary)'}` }}>
            {/* Emoji/Bild */}
            <div style={{ fontSize: '1.8rem', minWidth: 36, textAlign: 'center', lineHeight: 1 }}>
              {job.image || (isDuty ? '🏠' : '⭐')}
            </div>
            {/* Name + Wiederholung */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-semibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.name}</div>
              <div className="text-muted text-sm">
                {job.recurrence === 'daily' ? 'täglich' : job.recurrence === 'weekly' ? 'wöchentlich' : 'manuell'}
              </div>
            </div>
            {/* Punkte-Tag + Aktions-Buttons */}
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              {isDuty && job.points === 0
                ? <span className="tag tag-green">Pflicht</span>
                : <span className="tag tag-blue">+{job.points} ⭐</span>
              }
              {isParent && (
                <>
                  <button
                    className={isDuty && job.points === 0 ? 'btn-ghost' : 'btn-primary'}
                    style={{ padding: '6px 14px', fontSize: '1rem', ...(isDuty && job.points === 0 ? { borderColor: 'var(--success)', color: 'var(--success)' } : {}) }}
                    onClick={() => awardJob(job)}>
                    ✓
                  </button>
                  <button style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 10px', borderRadius: 8 }} onClick={() => setEditJob({ ...job })}>✏️</button>
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
              {settings.point_value_chf && (
                <div className="text-sm text-muted mt-1">
                  ≈ CHF {((history.summary?.balance || 0) * parseFloat(settings.point_value_chf)).toFixed(2)}
                </div>
              )}
            </div>
            {showStreak && (history.summary?.streak_weeks || 0) > 0 && (
              <div className="text-center">
                <div style={{ fontSize: '2rem' }}>🔥</div>
                <div className="font-bold">{history.summary.streak_weeks}</div>
                <div className="text-sm text-muted">Wochen</div>
              </div>
            )}
          </div>
          {isParent && (selectedChild || childId) && (
            <div className="flex gap-2 mt-3">
              <button className="w-full" style={{ background: '#f0fff4', border: '1.5px solid var(--success)', color: 'var(--success)', borderRadius: 12, padding: '9px', fontWeight: 700, fontSize: '0.85rem' }}
                onClick={() => setConvertModal('points_to_chf')}>
                ⭐ → CHF
              </button>
              <button className="w-full" style={{ background: '#f0f4ff', border: '1.5px solid var(--primary)', color: 'var(--primary)', borderRadius: 12, padding: '9px', fontWeight: 700, fontSize: '0.85rem' }}
                onClick={() => setConvertModal('chf_to_points')}>
                CHF → ⭐
              </button>
            </div>
          )}
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

      <Modal open={jobModal} title={`${newJob.job_type === 'duty' ? '🏠 Haushaltspflicht' : '⭐ Extra-Job'} hinzufügen`} onClose={() => { setJobModal(false); setNewJob({ name: '', points: '', recurrence: 'manual', job_type: 'extra', image: '' }); }}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {['duty', 'extra'].map(t => (
              <button key={t} onClick={() => setNewJob(j => ({ ...j, job_type: t }))}
                style={{ flex: 1, padding: '10px', borderRadius: 12, background: newJob.job_type === t ? (t === 'duty' ? 'var(--success)' : 'var(--primary)') : '#e0e7ef', color: newJob.job_type === t ? '#fff' : 'var(--text)', fontWeight: 600 }}>
                {t === 'duty' ? '🏠 Pflicht' : '⭐ Extra-Job'}
              </button>
            ))}
          </div>

          {/* Emoji-Vorschau + Eingabe */}
          <div className="flex items-center gap-3">
            <div style={{ fontSize: '2.8rem', minWidth: 56, textAlign: 'center', background: '#f8faff', borderRadius: 14, padding: '8px 0' }}>
              {newJob.image || (newJob.job_type === 'duty' ? '🏠' : '⭐')}
            </div>
            <input
              placeholder="Emoji eingeben (z.B. 🚗)"
              value={newJob.image}
              onChange={e => setNewJob(j => ({ ...j, image: e.target.value }))}
              style={{ flex: 1, fontSize: '1.4rem' }}
              maxLength={4}
            />
          </div>

          <input placeholder="Name (z.B. Auto waschen)" value={newJob.name}
            onChange={e => setNewJob(j => ({ ...j, name: e.target.value }))} />
          <input type="number" placeholder={newJob.job_type === 'duty' ? 'Punkte (0 = nur bestätigen)' : 'Punkte (z.B. 10)'} value={newJob.points}
            onChange={e => setNewJob(j => ({ ...j, points: e.target.value }))} />
          <select value={newJob.recurrence} onChange={e => setNewJob(j => ({ ...j, recurrence: e.target.value }))}>
            <option value="manual">Manuell (bei Bedarf)</option>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
          </select>
          <button className="btn-primary w-full" onClick={addJob}>Speichern</button>
        </div>
      </Modal>

      <Modal open={!!convertModal}
        title={convertModal === 'points_to_chf' ? '⭐ Punkte → CHF' : '💰 CHF → Punkte'}
        onClose={() => { setConvertModal(null); setConvertAmount(''); }}>
        {convertModal && (() => {
          const rate = parseFloat(settings.point_value_chf || '0.10');
          const pts = Number(convertAmount) || 0;
          const chf = Math.round(pts * rate * 100) / 100;
          return (
            <div className="flex flex-col gap-3">
              <div style={{ background: '#f8faff', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem' }}>
                Kurs: <strong>1 Punkt = CHF {rate.toFixed(2)}</strong>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1" style={{ display: 'block' }}>
                  {convertModal === 'points_to_chf' ? 'Punkte einlösen' : 'Punkte kaufen'}
                </label>
                <input type="number" min="1" placeholder="Anzahl Punkte"
                  value={convertAmount} onChange={e => setConvertAmount(e.target.value)} autoFocus />
              </div>
              {pts > 0 && (
                <div style={{ background: convertModal === 'points_to_chf' ? '#f0fff4' : '#f0f4ff', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  {convertModal === 'points_to_chf' ? (
                    <><span style={{ fontSize: '1.1rem' }}>⭐ {pts} Punkte</span>
                    <span style={{ margin: '0 10px', color: 'var(--muted)' }}>→</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>CHF {chf.toFixed(2)}</span></>
                  ) : (
                    <><span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>CHF {chf.toFixed(2)}</span>
                    <span style={{ margin: '0 10px', color: 'var(--muted)' }}>→</span>
                    <span style={{ fontSize: '1.1rem' }}>⭐ {pts} Punkte</span></>
                  )}
                </div>
              )}
              <button className="btn-primary w-full" onClick={doConvert} disabled={!pts}>
                Umtauschen ✓
              </button>
            </div>
          );
        })()}
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

      <Modal open={!!editJob} title="Job bearbeiten" onClose={() => setEditJob(null)}>
        {editJob && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div style={{ fontSize: '2.8rem', minWidth: 56, textAlign: 'center', background: '#f8faff', borderRadius: 14, padding: '8px 0' }}>
                {editJob.image || (editJob.job_type === 'duty' ? '🏠' : '⭐')}
              </div>
              <input
                placeholder="Emoji (z.B. 🚗)"
                value={editJob.image || ''}
                onChange={e => setEditJob(j => ({ ...j, image: e.target.value }))}
                style={{ flex: 1, fontSize: '1.4rem' }}
                maxLength={4}
              />
            </div>
            <input placeholder="Name" value={editJob.name}
              onChange={e => setEditJob(j => ({ ...j, name: e.target.value }))} />
            <input type="number" placeholder={editJob.job_type === 'duty' ? 'Punkte (0 = nur bestätigen)' : 'Punkte'}
              value={editJob.points}
              onChange={e => setEditJob(j => ({ ...j, points: e.target.value }))} />
            <select value={editJob.recurrence} onChange={e => setEditJob(j => ({ ...j, recurrence: e.target.value }))}>
              <option value="manual">Manuell (bei Bedarf)</option>
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
            </select>
            <button className="btn-primary w-full" onClick={saveEditJob}>Speichern ✓</button>
          </div>
        )}
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
