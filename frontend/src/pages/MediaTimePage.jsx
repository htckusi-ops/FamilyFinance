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
  const allocated = sessionSeconds !== null ? Math.min(sessionSeconds, budgetSeconds) : budgetSeconds;
  const totalSeconds = Math.max(allocated, 300); // arc scale — minimum 5 min so overtime arc is visible
  const remainingSeconds = allocated - elapsedSeconds; // negative = overtime
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

      {/* Timers — one per child, always individual */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {perUser.map(({ uid, remainingSeconds, totalSeconds, warnSeconds }) => {
          const u = users.find(x => x.id === uid);
          const usage = usageMap[uid];
          return (
            <div key={uid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 150, maxWidth: 220 }}>
              <Avatar user={u} size={48} />
              <div style={{ marginTop: 6 }}>
                <MediaTimer
                  remainingSeconds={remainingSeconds}
                  totalSeconds={totalSeconds}
                  warnSeconds={warnSeconds}
                  size={session.user_ids.length > 1 ? 150 : 180}
                  label={u?.name}
                  userColor={u?.color}
                />
              </div>
              {usage && (
                <div style={{ width: '100%', marginTop: 8 }}>
                  <MiniBar label="Heute" used={usage.usedToday + elapsedSeconds / 60} total={usage.config?.daily_limit_minutes} color={u?.color} />
                  <MiniBar label="Woche" used={usage.usedWeek  + elapsedSeconds / 60} total={usage.config?.weekly_limit_minutes} color={u?.color} />
                </div>
              )}
            </div>
          );
        })}
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
  const [correctionUser, setCorrectionUser] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ todayVal: '', weekVal: '', note: '' });
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

  function openCorrection(child) {
    const used = usageMap[child.id] || child;
    const elapsed = activeSessions.find(s => s.user_ids?.includes(child.id))
      ? (Date.now() - new Date(activeSessions.find(s => s.user_ids?.includes(child.id)).started_at).getTime()) / 60000
      : 0;
    setCorrectionForm({
      todayVal: String(Math.round((used.usedToday + elapsed) * 10) / 10),
      weekVal:  String(Math.round((used.usedWeek  + elapsed) * 10) / 10),
      note: '',
    });
    setCorrectionUser(child);
  }

  async function saveCorrection() {
    const used = usageMap[correctionUser.id] || correctionUser;
    const elapsed = activeSessions.find(s => s.user_ids?.includes(correctionUser.id))
      ? (Date.now() - new Date(activeSessions.find(s => s.user_ids?.includes(correctionUser.id)).started_at).getTime()) / 60000
      : 0;

    const today = new Date().toISOString().slice(0, 10);
    const ws = (() => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();

    const currentToday = Math.round((used.usedToday + elapsed) * 10) / 10;
    const currentWeek  = Math.round((used.usedWeek  + elapsed) * 10) / 10;
    const newToday = Number(correctionForm.todayVal);
    const newWeek  = Number(correctionForm.weekVal);

    const reqs = [];
    const deltaToday = Math.round((newToday - currentToday) * 10) / 10;
    const deltaWeekOnly = Math.round((newWeek - currentWeek - (newToday - currentToday)) * 10) / 10;

    if (deltaToday !== 0) {
      reqs.push(api.post(`/media/corrections/${correctionUser.id}`, {
        date: today, delta_minutes: deltaToday, note: correctionForm.note || null,
      }));
    }
    // Apply the remaining week delta on Monday (first day of week) so it counts in weekly total but not today
    if (deltaWeekOnly !== 0 && ws !== today) {
      reqs.push(api.post(`/media/corrections/${correctionUser.id}`, {
        date: ws, delta_minutes: deltaWeekOnly, note: correctionForm.note || null,
      }));
    } else if (deltaWeekOnly !== 0) {
      // Edge case: today IS Monday — put rest on yesterday (still in this week)
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      reqs.push(api.post(`/media/corrections/${correctionUser.id}`, {
        date: yesterday.toISOString().slice(0, 10), delta_minutes: deltaWeekOnly, note: correctionForm.note || null,
      }));
    }

    try {
      await Promise.all(reqs);
      toast('Korrektur gespeichert ✓', 'success');
      setCorrectionUser(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Fehler', 'error');
    }
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

        {/* Budget overview — two small clocks */}
        {myUsage && !mySession && (
          <div className="card mt-4">
            <h2 className="font-bold mb-4">Mein Budget</h2>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#64748b', marginBottom: 6 }}>📅 Heute</div>
                <MediaTimer
                  remainingSeconds={(myUsage.config?.daily_limit_minutes - myUsage.usedToday) * 60}
                  totalSeconds={(myUsage.config?.daily_limit_minutes ?? 60) * 60}
                  warnSeconds={0}
                  size={120}
                  userColor={user.color}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#64748b', marginBottom: 6 }}>📆 Woche</div>
                <MediaTimer
                  remainingSeconds={(myUsage.config?.weekly_limit_minutes - myUsage.usedWeek) * 60}
                  totalSeconds={(myUsage.config?.weekly_limit_minutes ?? 300) * 60}
                  warnSeconds={0}
                  size={120}
                  userColor={user.color}
                />
              </div>
            </div>
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
            const dailyLimit = child.config?.daily_limit_minutes ?? 60;
            const weeklyLimit = child.config?.weekly_limit_minutes ?? 300;
            const overToday = usedToday > dailyLimit;
            const overWeek  = usedWeek  > weeklyLimit;
            const overtimeMin = Math.round((usedToday - dailyLimit) * 10) / 10;
            return (
              <div key={child.id} className="card" style={{
                padding: 14,
                border: overToday ? '2px solid #ef4444' : undefined,
                background: overToday ? 'linear-gradient(135deg,#fff5f5,#fff)' : undefined,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <Avatar user={child} size={38} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700 }}>{child.name}</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
                      {mySession && (
                        <span style={{ fontSize:'0.7rem', background:'#dcfce7', color:'#166534', borderRadius:20, padding:'2px 8px', fontWeight:700 }}>
                          ▶️ Aktiv
                        </span>
                      )}
                      {overToday && (
                        <span style={{ fontSize:'0.7rem', background:'#ef4444', color:'#fff', borderRadius:20, padding:'2px 8px', fontWeight:800, letterSpacing:'0.03em' }}>
                          ⚠️ +{fmtMin(overtimeMin)} Überzeit
                        </span>
                      )}
                      {!overToday && (
                        <span style={{ fontSize:'0.7rem', color:'#64748b' }}>
                          noch {fmtMin(Math.max(0, dailyLimit - usedToday))} heute
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openCorrection(child)}
                    title="Nutzungszeit manuell korrigieren"
                    style={{ background:'#fef9c3', color:'#854d0e', border:'none', borderRadius:8, padding:'5px 10px', fontWeight:700, cursor:'pointer', fontSize:'0.8rem', flexShrink:0 }}
                  >
                    ✏️
                  </button>
                </div>
                <MiniBar label="Heute"  used={usedToday} total={dailyLimit}  color={overToday ? '#ef4444' : child.color} />
                <MiniBar label="Woche"  used={usedWeek}  total={weeklyLimit} color={overWeek  ? '#ef4444' : child.color} />
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

      {/* ── Correction modal ── */}
      <Modal open={!!correctionUser} title={`⏱ Zeitkorrektur: ${correctionUser?.name}`} onClose={() => setCorrectionUser(null)}>
        {correctionUser && (() => {
          const used = usageMap[correctionUser.id] || correctionUser;
          const dl = used.config?.daily_limit_minutes ?? 60;
          const wl = used.config?.weekly_limit_minutes ?? 300;
          return (
            <div className="flex flex-col gap-4">
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                Gib die tatsächliche Nutzungszeit ein. Die Differenz zur aktuellen Zeit wird als Korrektur gespeichert.
              </p>

              <div style={{ background: '#f8faff', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>📅 Heute</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Tatsächliche Nutzung (Min)</label>
                    <input
                      type="number" min="0" max={dl * 3} step="1"
                      value={correctionForm.todayVal}
                      onChange={e => setCorrectionForm(f => ({ ...f, todayVal: e.target.value }))}
                    />
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', paddingTop: 18 }}>
                    Limit: {dl} Min
                  </div>
                </div>
                {correctionForm.todayVal !== '' && Math.round((Number(correctionForm.todayVal) - Number(correctionForm.todayVal === '' ? used.usedToday : correctionForm.todayVal)) * 10) / 10 !== 0 && (() => {
                  const delta = Math.round((Number(correctionForm.todayVal) - used.usedToday) * 10) / 10;
                  return delta !== 0 ? (
                    <div style={{ fontSize: '0.75rem', color: delta > 0 ? '#ef4444' : '#22c55e', marginTop: 4, fontWeight: 600 }}>
                      {delta > 0 ? `+${delta}` : delta} Min gegenüber aktuell ({Math.round(used.usedToday * 10) / 10} Min)
                    </div>
                  ) : null;
                })()}
              </div>

              <div style={{ background: '#f8faff', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>📆 Diese Woche gesamt</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Tatsächliche Nutzung (Min)</label>
                    <input
                      type="number" min="0" max={wl * 3} step="1"
                      value={correctionForm.weekVal}
                      onChange={e => setCorrectionForm(f => ({ ...f, weekVal: e.target.value }))}
                    />
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', paddingTop: 18 }}>
                    Limit: {wl} Min
                  </div>
                </div>
                {correctionForm.weekVal !== '' && (() => {
                  const delta = Math.round((Number(correctionForm.weekVal) - used.usedWeek) * 10) / 10;
                  return delta !== 0 ? (
                    <div style={{ fontSize: '0.75rem', color: delta > 0 ? '#ef4444' : '#22c55e', marginTop: 4, fontWeight: 600 }}>
                      {delta > 0 ? `+${delta}` : delta} Min gegenüber aktuell ({Math.round(used.usedWeek * 10) / 10} Min)
                    </div>
                  ) : null;
                })()}
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Bemerkung (optional)</label>
                <input
                  placeholder="z.B. Timer vergessen zu stoppen"
                  value={correctionForm.note}
                  onChange={e => setCorrectionForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-ghost w-full" onClick={() => setCorrectionUser(null)}>Abbrechen</button>
                <button className="btn-primary w-full" onClick={saveCorrection}>Speichern ✓</button>
              </div>
            </div>
          );
        })()}
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
