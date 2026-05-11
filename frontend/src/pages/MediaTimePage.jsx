import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import MediaTimer from '../components/MediaTimer';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';

// ── Audio helpers ──────────────────────────────────────────────────
function beeps(count = 3, freq = 880) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      const t = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.28);
    }
  } catch {}
}

function alarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const freqs = [440, 550, 660, 550, 440, 550, 660];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = f; osc.type = 'square';
      const t = ctx.currentTime + i * 0.3;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    });
  } catch {}
}

// ── Helpers ────────────────────────────────────────────────────────
function fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} Min`;
}

function sessionElapsedSeconds(startedAt) {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

// Compute timer values for one user in a session
function timerForUser(usage, elapsedSeconds, sessionLimitMinutes) {
  const budgetSeconds = Math.min(usage.remainingToday, usage.remainingWeek) * 60;
  const sessionSeconds = sessionLimitMinutes ? sessionLimitMinutes * 60 : null;
  const totalSeconds = sessionSeconds !== null ? Math.min(sessionSeconds, budgetSeconds) : budgetSeconds;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const warnSeconds = (usage.config?.warn_before_minutes ?? 2) * 60;
  return { totalSeconds, remainingSeconds, warnSeconds };
}

// ── Mini progress bar ──────────────────────────────────────────────
function MiniBar({ label, used, total, color = '#6366f1' }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const over = used > total;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>
        <span style={{ color: '#64748b' }}>{label}</span>
        <span style={{ color: over ? '#ef4444' : '#374151' }}>{fmtMin(used)} / {fmtMin(total)}</span>
      </div>
      <div style={{ height: 7, background: '#e0e7ef', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: over ? '#ef4444' : color, borderRadius: 4, transition: 'width 1s linear' }} />
      </div>
    </div>
  );
}

// ── Single running timer card ──────────────────────────────────────
function SessionCard({ session, usageMap, users, now, onStop, warnedRef, alarmedRef }) {
  const elapsedSeconds = Math.floor((now - new Date(session.started_at).getTime()) / 1000);

  // Per-user remaining — capped by session limit if set
  const perUser = session.user_ids.map(uid => {
    const usage = usageMap[uid];
    if (!usage) return { uid, remainingSeconds: 0, totalSeconds: 0, warnSeconds: 120 };
    const { totalSeconds, remainingSeconds, warnSeconds } = timerForUser(usage, elapsedSeconds, session.session_limit_minutes);
    return { uid, remainingSeconds, totalSeconds, warnSeconds };
  });

  // Effective remaining = min of all participants
  const effectiveRemaining = Math.min(...perUser.map(p => p.remainingSeconds));
  const effectiveTotal     = Math.min(...perUser.map(p => p.totalSeconds));
  const effectiveWarn      = Math.min(...perUser.map(p => p.warnSeconds));

  // Audio triggers
  if (!warnedRef.current.has(session.id) && effectiveRemaining <= effectiveWarn && effectiveRemaining > 0) {
    warnedRef.current.add(session.id);
    beeps(3, 880);
  }
  if (!alarmedRef.current.has(session.id) && effectiveRemaining <= 0) {
    alarmedRef.current.add(session.id);
    alarm();
  }

  const isGroup = session.user_ids.length > 1;
  const categoryLabel = session.category === 'active' ? '📚 Aktiv' : '📺 Passiv';

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
      border: `2px solid ${effectiveRemaining <= 0 ? '#ef4444' : effectiveRemaining <= effectiveWarn ? '#f59e0b' : '#a5b4fc'}`,
      boxShadow: '0 2px 12px #0001',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {isGroup ? '👥 Gemeinsam' : users.find(u => u.id === session.user_ids[0])?.name}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {categoryLabel}
            {session.session_limit_minutes ? ` · ${fmtMin(session.session_limit_minutes)}` : ''}
          </div>
        </div>
        <button
          onClick={() => onStop(session.id)}
          style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
        >
          ⏹ Stopp
        </button>
      </div>

      {/* Timer(s) */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {isGroup ? (
          // Group: one big timer + per-user indicators below
          <div style={{ textAlign: 'center' }}>
            <MediaTimer
              remainingSeconds={effectiveRemaining}
              totalSeconds={effectiveTotal}
              warnSeconds={effectiveWarn}
              size={180}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
              {perUser.map(({ uid, remainingSeconds }) => {
                const u = users.find(x => x.id === uid);
                return (
                  <div key={uid} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: u?.color + '22', borderRadius: 20, padding: '3px 10px',
                    fontSize: '0.72rem', fontWeight: 700, color: '#374151',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: u?.color }} />
                    {u?.name}: {fmtMin(Math.max(0, remainingSeconds / 60))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Individual: one timer per user (should only be one)
          perUser.map(({ uid, remainingSeconds, totalSeconds, warnSeconds }) => {
            const u = users.find(x => x.id === uid);
            const usage = usageMap[uid];
            return (
              <div key={uid} style={{ flex: 1, minWidth: 160 }}>
                <MediaTimer
                  remainingSeconds={remainingSeconds}
                  totalSeconds={totalSeconds}
                  warnSeconds={warnSeconds}
                  size={180}
                  label={u?.name}
                  userColor={u?.color}
                />
                {usage && (
                  <div style={{ marginTop: 10 }}>
                    <MiniBar
                      label="Heute"
                      used={usage.usedToday + elapsedSeconds / 60}
                      total={usage.config?.daily_limit_minutes}
                      color={u?.color}
                    />
                    <MiniBar
                      label="Diese Woche"
                      used={usage.usedWeek + elapsedSeconds / 60}
                      total={usage.config?.weekly_limit_minutes}
                      color={u?.color}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function MediaTimePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('active');
  const [children, setChildren] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [usageMap, setUsageMap] = useState({});
  const [history, setHistory] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [startModal, setStartModal] = useState(false);
  const [startSelected, setStartSelected] = useState([]);
  const [startCategory, setStartCategory] = useState('passive');
  const [startLimitMinutes, setStartLimitMinutes] = useState('');
  const [configUser, setConfigUser] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const warnedRef  = useRef(new Set());
  const alarmedRef = useRef(new Set());

  useEffect(() => { load(); }, []);

  // Tick every second for live countdown
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Refresh usage every 30 seconds
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  async function load() {
    if (user.role === 'parent') {
      const [usageRes, activeRes] = await Promise.all([
        api.get('/media/usage-all'),
        api.get('/media/sessions/active'),
      ]);
      setChildren(usageRes.data);
      const map = {};
      usageRes.data.forEach(c => { map[c.id] = c; });
      setUsageMap(map);
      setActiveSessions(activeRes.data);
    } else {
      const [usageRes, activeRes] = await Promise.all([
        api.get(`/media/usage/${user.id}`),
        api.get('/media/sessions/active'),
      ]);
      setUsageMap({ [user.id]: { ...usageRes.data, id: user.id, name: user.name, color: user.color } });
      setActiveSessions(activeRes.data);
    }
  }

  async function loadHistory() {
    const res = await api.get('/media/sessions');
    setHistory(res.data);
  }

  async function startSession() {
    if (startSelected.length === 0) return toast('Bitte mindestens ein Kind auswählen', 'error');
    const sessionLimitMinutes = startLimitMinutes ? Number(startLimitMinutes) : null;
    try {
      await api.post('/media/sessions/start', { userIds: startSelected, category: startCategory, sessionLimitMinutes });
      toast('Session gestartet ▶️', 'success');
      setStartModal(false);
      setStartSelected([]);
      setStartLimitMinutes('');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Fehler', 'error');
    }
  }

  async function stopSession(sid) {
    try {
      await api.post(`/media/sessions/${sid}/stop`);
      warnedRef.current.delete(sid);
      alarmedRef.current.delete(sid);
      toast('Session beendet ⏹', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Fehler', 'error');
    }
  }

  async function saveConfig() {
    await api.post(`/media/config/${configUser.id}`, {
      daily_limit_minutes:  Math.max(1, Number(configForm.daily_limit_minutes)  || 60),
      weekly_limit_minutes: Math.max(1, Number(configForm.weekly_limit_minutes) || 300),
      warn_before_minutes:  Math.max(1, Number(configForm.warn_before_minutes)  || 2),
      active_half_count: configForm.active_half_count,
    });
    toast('Limits gespeichert ✓', 'success');
    setConfigUser(null);
    load();
  }

  function openConfig(child) {
    setConfigForm({
      daily_limit_minutes:  String(child.config?.daily_limit_minutes  ?? 60),
      weekly_limit_minutes: String(child.config?.weekly_limit_minutes ?? 300),
      warn_before_minutes:  String(child.config?.warn_before_minutes  ?? 2),
      active_half_count: child.config?.active_half_count ?? 0,
    });
    setConfigUser(child);
  }

  function toggleStartSelected(id) {
    setStartSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  // ── Child view ───────────────────────────────────────────────────
  if (user.role === 'child') {
    const mySession = activeSessions.find(s => s.user_ids.includes(user.id));
    const myUsage = usageMap[user.id];

    return (
      <div className="page">
        <h1 className="page-title">📺 Medienzeit</h1>

        {mySession ? (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            {(() => {
              const elapsed = Math.floor((now - new Date(mySession.started_at).getTime()) / 1000);
              const { totalSeconds: totalAvail, remainingSeconds: remaining, warnSeconds: warnSec } = myUsage
                ? timerForUser(myUsage, elapsed, mySession.session_limit_minutes)
                : { totalSeconds: 0, remainingSeconds: 0, warnSeconds: 120 };

              // Audio
              if (!warnedRef.current.has(mySession.id) && remaining <= warnSec && remaining > 0) {
                warnedRef.current.add(mySession.id); beeps(3, 880);
              }
              if (!alarmedRef.current.has(mySession.id) && remaining <= 0) {
                alarmedRef.current.add(mySession.id); alarm();
              }

              const isGroup = mySession.user_ids.length > 1;

              return (
                <>
                  <MediaTimer
                    remainingSeconds={remaining}
                    totalSeconds={totalAvail}
                    warnSeconds={warnSec}
                    size={220}
                    userColor={user.color}
                  />
                  {isGroup && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>
                      Gemeinsam mit: {mySession.user_ids.filter(id => id !== user.id).map(id => usageMap[id]?.name || id).join(', ')}
                    </div>
                  )}
                  <button
                    onClick={() => stopSession(mySession.id)}
                    style={{
                      marginTop: 16, background: '#fee2e2', color: '#b91c1c',
                      border: 'none', borderRadius: 12, padding: '12px 28px',
                      fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                    }}
                  >
                    ⏹ Stopp
                  </button>
                </>
              );
            })()}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>📺</div>
            <div style={{ fontWeight: 600 }}>Keine aktive Session</div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Eltern können eine Session starten</div>
          </div>
        )}

        {/* Budget overview */}
        {myUsage && !mySession && (
          <div className="card mt-4">
            <h2 className="font-bold mb-3">Mein Budget</h2>
            {(() => {
              const elapsed = mySession ? Math.floor((now - new Date(mySession.started_at).getTime()) / 60000) : 0;
              return (
                <>
                  <MiniBar label="📅 Heute" used={myUsage.usedToday + elapsed} total={myUsage.config?.daily_limit_minutes} />
                  <MiniBar label="📆 Diese Woche" used={myUsage.usedWeek + elapsed} total={myUsage.config?.weekly_limit_minutes} />
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#64748b' }}>
                    Noch verfügbar: <b>{fmtMin(myUsage.remainingToday)}</b> heute,
                    {' '}<b>{fmtMin(myUsage.remainingWeek)}</b> diese Woche
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // ── Parent view ──────────────────────────────────────────────────
  return (
    <div className="page">
      <h1 className="page-title">📺 Medienzeit</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['active','▶️ Aktiv'],['overview','📊 Übersicht'],['config','⚙️ Limits']].map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); if (key==='active' || key==='overview') load(); }}
            style={{
              flex:1, padding:'10px 8px', borderRadius:10, border:'none', fontWeight:700, fontSize:'0.82rem',
              background: tab===key ? 'var(--primary)' : '#f1f5f9',
              color: tab===key ? '#fff' : '#374151', cursor:'pointer',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Active tab ── */}
      {tab === 'active' && (
        <>
          {activeSessions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8' }}>
              <div style={{ fontSize:'3rem', marginBottom:8 }}>📺</div>
              <div style={{ fontWeight:600 }}>Keine aktive Medienzeit</div>
            </div>
          ) : (
            activeSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                usageMap={usageMap}
                users={children}
                now={now}
                onStop={stopSession}
                warnedRef={warnedRef}
                alarmedRef={alarmedRef}
              />
            ))
          )}
          <button
            className="btn-primary w-full"
            style={{ marginTop: 8 }}
            onClick={() => { setStartSelected([]); setStartCategory('passive'); setStartLimitMinutes(''); setStartModal(true); }}
          >
            ▶️ Neue Session starten
          </button>
        </>
      )}

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-3">
          {children.map(child => {
            const mySession = activeSessions.find(s => s.user_ids.includes(child.id));
            const elapsed = mySession ? (now - new Date(mySession.started_at).getTime()) / 60000 : 0;
            const usedToday = child.usedToday + elapsed;
            const usedWeek  = child.usedWeek  + elapsed;
            return (
              <div key={child.id} className="card" style={{ padding: 14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <Avatar user={child} size={38} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700 }}>{child.name}</div>
                    {mySession && (
                      <span style={{ fontSize:'0.7rem', background:'#dcfce7', color:'#166534', borderRadius:20, padding:'2px 8px', fontWeight:700 }}>
                        ▶️ Aktiv
                      </span>
                    )}
                  </div>
                </div>
                <MiniBar label="Heute" used={usedToday} total={child.config?.daily_limit_minutes} color={child.color} />
                <MiniBar label="Woche" used={usedWeek}  total={child.config?.weekly_limit_minutes} color={child.color} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Config tab ── */}
      {tab === 'config' && (
        <div className="flex flex-col gap-3">
          {children.map(child => (
            <div key={child.id} className="card" style={{ padding: 14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Avatar user={child} size={36} />
                  <div>
                    <div style={{ fontWeight:700 }}>{child.name}</div>
                    <div style={{ fontSize:'0.72rem', color:'#64748b' }}>
                      Täglich: {fmtMin(child.config?.daily_limit_minutes ?? 60)} ·
                      Wöchentlich: {fmtMin(child.config?.weekly_limit_minutes ?? 300)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openConfig(child)}
                  style={{ background:'#e0f2fe', color:'#0369a1', border:'none', borderRadius:8, padding:'6px 12px', fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}
                >
                  ✏️ Bearbeiten
                </button>
              </div>
              <div style={{ fontSize:'0.72rem', color:'#94a3b8' }}>
                Warnung: {child.config?.warn_before_minutes ?? 2} Min vorher ·
                {child.config?.active_half_count ? ' Aktive Zeit zählt halb' : ' Alle Zeit zählt gleich'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Start session modal ── */}
      <Modal open={startModal} title="Neue Session starten" onClose={() => setStartModal(false)}>
        <div className="flex flex-col gap-4">
          <div>
            <div style={{ fontWeight:700, marginBottom:8, fontSize:'0.9rem' }}>Kinder auswählen</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {children.map(child => {
                const sel = startSelected.includes(child.id);
                const hasActive = activeSessions.some(s => s.user_ids.includes(child.id));
                return (
                  <button key={child.id} disabled={hasActive}
                    onClick={() => toggleStartSelected(child.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'8px 12px', borderRadius:12, border:'none', cursor: hasActive ? 'not-allowed' : 'pointer',
                      background: sel ? child.color : '#f1f5f9',
                      color: sel ? '#fff' : '#374151',
                      fontWeight:700, fontSize:'0.85rem', opacity: hasActive ? 0.5 : 1,
                    }}>
                    <Avatar user={child} size={24} />
                    {child.name}
                    {hasActive && ' (aktiv)'}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontWeight:700, marginBottom:8, fontSize:'0.9rem' }}>Art der Medienzeit</div>
            <div style={{ display:'flex', gap:8 }}>
              {[['passive','📺 Passiv'],['active','📚 Aktiv']].map(([val, label]) => (
                <button key={val} onClick={() => setStartCategory(val)}
                  style={{
                    flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                    background: startCategory===val ? 'var(--primary)' : '#f1f5f9',
                    color: startCategory===val ? '#fff' : '#374151',
                    fontWeight:700, fontSize:'0.85rem',
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:4 }}>
              Passiv: TV, YouTube, Gaming · Aktiv: Lernapp, Videoanruf (zählt ggf. halb)
            </div>
          </div>

          {/* Optional session duration */}
          <div>
            <div style={{ fontWeight:700, marginBottom:8, fontSize:'0.9rem' }}>⏱ Sitzungsdauer (optional)</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                type="number" min="1" max="240"
                placeholder="z.B. 15"
                value={startLimitMinutes}
                onChange={e => setStartLimitMinutes(e.target.value)}
                style={{ flex:1 }}
              />
              <span style={{ fontWeight:600, color:'#64748b', whiteSpace:'nowrap' }}>Minuten</span>
            </div>
            <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:4 }}>
              Leer = gesamtes verfügbares Tages-/Wochenbudget als Timer
            </div>
          </div>

          {/* Preview remaining time for selected children */}
          {startSelected.length > 0 && (
            <div style={{ background:'#f8faff', borderRadius:12, padding:12 }}>
              <div style={{ fontWeight:700, fontSize:'0.82rem', marginBottom:8, color:'#64748b' }}>Verfügbare Zeit</div>
              {startSelected.map(uid => {
                const child = children.find(c => c.id === uid);
                if (!child) return null;
                return (
                  <div key={uid} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', marginBottom:4 }}>
                    <span style={{ fontWeight:600 }}>{child.name}</span>
                    <span>
                      Heute: <b>{fmtMin(child.remainingToday)}</b> ·
                      Woche: <b>{fmtMin(child.remainingWeek)}</b>
                    </span>
                  </div>
                );
              })}
              {startSelected.length > 1 && (
                <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:6, borderTop:'1px solid #e0e7ef', paddingTop:6 }}>
                  ⚠️ Timer läuft bis das erste Kind sein Limit erreicht
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-ghost w-full" onClick={() => setStartModal(false)}>Abbrechen</button>
            <button className="btn-primary w-full" onClick={startSession}>▶️ Starten</button>
          </div>
        </div>
      </Modal>

      {/* ── Config edit modal ── */}
      <Modal open={!!configUser} title={`Limits: ${configUser?.name}`} onClose={() => setConfigUser(null)}>
        {configUser && (
          <div className="flex flex-col gap-4">
            <div>
              <label style={{ fontWeight:700, fontSize:'0.85rem', display:'block', marginBottom:4 }}>
                📅 Tageslimit (Minuten)
              </label>
              <input type="number" min="5" max="600"
                value={configForm.daily_limit_minutes}
                onChange={e => setConfigForm(f => ({ ...f, daily_limit_minutes: e.target.value }))} />
              <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:4 }}>
                Empfehlung (AWMF): {configUser.age_group === 'preschool' ? '30 Min' : configUser.age_group === 'teen' ? '120 Min' : '60 Min'}
              </div>
            </div>
            <div>
              <label style={{ fontWeight:700, fontSize:'0.85rem', display:'block', marginBottom:4 }}>
                📆 Wochenlimit (Minuten)
              </label>
              <input type="number" min="30" max="4200"
                value={configForm.weekly_limit_minutes}
                onChange={e => setConfigForm(f => ({ ...f, weekly_limit_minutes: e.target.value }))} />
              <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:4 }}>
                Empfehlung: {configUser.age_group === 'preschool' ? '120 Min/Wo' : configUser.age_group === 'teen' ? '600 Min/Wo' : '300 Min/Wo'}
              </div>
            </div>
            <div>
              <label style={{ fontWeight:700, fontSize:'0.85rem', display:'block', marginBottom:4 }}>
                ⏰ Warnton vor Ende (Minuten)
              </label>
              <input type="number" min="1" max="30"
                value={configForm.warn_before_minutes}
                onChange={e => setConfigForm(f => ({ ...f, warn_before_minutes: e.target.value }))} />
            </div>
            <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.85rem' }}>📚 Aktive Zeit zählt halb</div>
                <div style={{ fontSize:'0.72rem', color:'#94a3b8' }}>Lernapp / Videoanruf zählt nur 50% zum Limit</div>
              </div>
              <input type="checkbox"
                checked={!!configForm.active_half_count}
                onChange={e => setConfigForm(f => ({ ...f, active_half_count: e.target.checked ? 1 : 0 }))} />
            </label>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-ghost w-full" onClick={() => setConfigUser(null)}>Abbrechen</button>
              <button className="btn-primary w-full" onClick={saveConfig}>Speichern ✓</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
