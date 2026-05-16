import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';

function fmtMedia(min) {
  if (min == null) return '–';
  if (min <= 0) return 'Überzeit';
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(min)}m`;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [children, setChildren] = useState([]);
  const [mediaMap, setMediaMap] = useState({});
  const [pendingClaims, setPendingClaims] = useState([]);
  const [quickAward, setQuickAward] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [freePoints, setFreePoints] = useState({ delta: '', description: '' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [usersRes, claimsRes, jobsRes, mediaRes] = await Promise.all([
      api.get('/users'),
      api.get('/rewards/claims/pending'),
      api.get('/points/jobs'),
      api.get('/media/usage-all').catch(() => ({ data: [] })),
    ]);
    setChildren(usersRes.data.filter(u => u.role === 'child'));
    setPendingClaims(claimsRes.data);
    setJobs(jobsRes.data);
    const map = {};
    mediaRes.data.forEach(c => { map[c.id] = c; });
    setMediaMap(map);
  }

  async function awardJob(childId, job) {
    await api.post('/points/award', { user_id: childId, delta: job.points, description: job.name, mini_job_id: job.id });
    toast(`${job.points} Punkte für ${job.name} vergeben! ⭐`, 'success');
    setQuickAward(null);
  }

  async function awardFree(childId) {
    if (!freePoints.delta) return;
    await api.post('/points/award', { user_id: childId, delta: Number(freePoints.delta), description: freePoints.description || 'Spontane Punkte' });
    toast(`${freePoints.delta} Punkte vergeben! ⭐`, 'success');
    setFreePoints({ delta: '', description: '' });
    setQuickAward(null);
  }

  async function handleClaim(claim, status) {
    await api.patch(`/rewards/claims/${claim.id}`, { status });
    toast(status === 'approved' ? '✅ Belohnung genehmigt!' : '❌ Abgelehnt', status === 'approved' ? 'success' : 'error');
    load();
  }

  return (
    <div className="page">
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={user} size={48} />
        <div>
          <h1 className="font-bold" style={{ fontSize: '1.3rem' }}>Hallo, {user.name}!</h1>
          <p className="text-muted text-sm">Eltern-Übersicht</p>
        </div>
      </div>

      {/* Pending reward claims */}
      {pendingClaims.length > 0 && (
        <div className="card mb-4" style={{ borderLeft: '4px solid var(--accent)' }}>
          <h2 className="font-bold mb-3">🎁 Offene Belohnungsanfragen ({pendingClaims.length})</h2>
          <div className="flex flex-col gap-3">
            {pendingClaims.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-semibold">{c.child_name}</span>
                  <span className="text-muted text-sm"> möchte: </span>
                  <span className="font-semibold">{c.reward_name}</span>
                  <span className="text-muted text-sm"> ({c.points_required} Punkte)</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" style={{ padding: '6px 14px' }} onClick={() => handleClaim(c, 'approved')}>✓</button>
                  <button className="btn-danger" style={{ padding: '6px 14px' }} onClick={() => handleClaim(c, 'rejected')}>✗</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">⚡ Schnellzugriff</h2>
        <div className="grid-2 gap-3">
          <Link to="/points" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ background: '#f0f7ff', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: '2rem' }}>⭐</div>
              <div className="font-semibold mt-2">Punkte vergeben</div>
            </div>
          </Link>
          <Link to="/allowance" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ background: '#f0fff4', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: '2rem' }}>💰</div>
              <div className="font-semibold mt-2">Taschengeld</div>
            </div>
          </Link>
          <Link to="/flea" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ background: '#fffbeb', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: '2rem' }}>🏷️</div>
              <div className="font-semibold mt-2">Flohmarkt</div>
            </div>
          </Link>
          <Link to="/rewards" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ background: '#fdf4ff', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: '2rem' }}>🎁</div>
              <div className="font-semibold mt-2">Belohnungen</div>
            </div>
          </Link>
          <Link to="/finance" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ background: '#f0fdf4', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: '2rem' }}>📊</div>
              <div className="font-semibold mt-2">Finanzübersicht</div>
            </div>
          </Link>
          <Link to="/media" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ background: '#eef2ff', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: '2rem' }}>📺</div>
              <div className="font-semibold mt-2">Medienzeit</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Children overview */}
      <h2 className="font-bold mb-3">👧👦 Kinder</h2>
      <div className="flex flex-col gap-3">
        {children.map(child => {
          const m = mediaMap[child.id];
          const isOver = m && m.remainingToday <= 0 && m.usedToday > 0;
          return (
            <div key={child.id} className="card" style={{ padding: '12px 14px' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <Avatar user={child} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div className="font-bold" style={{ fontSize: '1.05rem' }}>{child.name}</div>
                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b' }}>
                        ⭐ {m?.points_balance ?? '–'}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isOver ? '#ef4444' : '#6366f1' }}>
                        📺 {m ? fmtMedia(m.remainingToday) : '–'}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e' }}>
                        💰 {m != null ? `CHF ${m.balance.toFixed(2)}` : '–'}
                      </span>
                    </div>
                  </div>
                </div>
                <button className="btn-primary" style={{ padding: '8px 14px', flexShrink: 0 }} onClick={() => setQuickAward(child)}>
                  ⭐ Punkte
                </button>
              </div>
            </div>
          );
        })}
        {children.length === 0 && (
          <div className="card text-center text-muted">
            <p>Noch keine Kinder angelegt.</p>
            <Link to="/settings" className="text-sm" style={{ color: 'var(--primary)' }}>→ Kinder hinzufügen</Link>
          </div>
        )}
      </div>

      {/* Quick award modal */}
      {quickAward && (
        <Modal open title={`Punkte für ${quickAward.name}`} onClose={() => setQuickAward(null)}>
          <h3 className="font-semibold mb-3">Mini-Job auswählen</h3>
          <div className="flex flex-col gap-2 mb-4">
            {jobs.filter(j => j.job_type === 'extra' || j.points > 0).map(job => (
              <button key={job.id} onClick={() => awardJob(quickAward.id, job)}
                className="flex justify-between items-center"
                style={{ background: job.job_type === 'duty' ? '#f0fff4' : '#f0f7ff', padding: '12px 16px', borderRadius: 12, textAlign: 'left', border: 'none', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{job.image || (job.job_type === 'duty' ? '🏠' : '⭐')}</span>
                <span className="font-semibold" style={{ flex: 1 }}>{job.name}</span>
                <span className="tag tag-blue">+{job.points} ⭐</span>
              </button>
            ))}
            {jobs.length === 0 && <p className="text-muted text-sm">Noch keine Mini-Jobs definiert.</p>}
          </div>
          <h3 className="font-semibold mb-2">Oder frei vergeben</h3>
          <div className="flex flex-col gap-2">
            <input type="number" placeholder="Punkte (z.B. 5)" value={freePoints.delta}
              onChange={e => setFreePoints(p => ({ ...p, delta: e.target.value }))} />
            <input placeholder="Beschreibung" value={freePoints.description}
              onChange={e => setFreePoints(p => ({ ...p, description: e.target.value }))} />
            <button className="btn-accent w-full" onClick={() => awardFree(quickAward.id)}>
              Punkte vergeben ⭐
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
