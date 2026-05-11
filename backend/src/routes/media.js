const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');

router.use(auth);

const AGE_DEFAULTS = {
  preschool: { daily: 30, weekly: 120 },
  school:    { daily: 60, weekly: 300 },
  teen:      { daily: 120, weekly: 600 },
};

function ensureConfig(uid) {
  if (db.prepare('SELECT id FROM media_config WHERE user_id=?').get(uid)) return;
  const user = db.prepare('SELECT age_group FROM users WHERE id=?').get(uid);
  const d = AGE_DEFAULTS[user?.age_group] || AGE_DEFAULTS.school;
  db.prepare('INSERT INTO media_config (user_id,daily_limit_minutes,weekly_limit_minutes) VALUES (?,?,?)')
    .run(uid, d.daily, d.weekly);
}

function weekStart() {
  const d = new Date();
  d.setUTCHours(0,0,0,0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
}

function getUsage(uid) {
  const today = new Date().toISOString().slice(0, 10);
  const ws = weekStart();
  const rows = db.prepare(`
    SELECT ms.duration_minutes, ms.started_at FROM media_sessions ms
    JOIN media_session_users msu ON msu.session_id=ms.id
    WHERE msu.user_id=? AND ms.ended_at IS NOT NULL
  `).all(uid);
  let usedToday = 0, usedWeek = 0;
  for (const r of rows) {
    const d = r.started_at.slice(0, 10);
    const mins = r.duration_minutes || 0;
    if (d === today) usedToday += mins;
    if (d >= ws) usedWeek += mins;
  }
  return { usedToday, usedWeek };
}

function normalizeSession(s) {
  return {
    ...s,
    started_at: s.started_at && !s.started_at.includes('T')
      ? s.started_at.replace(' ', 'T') + 'Z'
      : s.started_at,
    ended_at: s.ended_at && !s.ended_at.includes('T')
      ? s.ended_at.replace(' ', 'T') + 'Z'
      : s.ended_at,
    user_ids: s.user_ids ? s.user_ids.split(',').map(Number) : [],
  };
}

// GET /media/config/:id
router.get('/config/:id', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  ensureConfig(uid);
  res.json(db.prepare('SELECT * FROM media_config WHERE user_id=?').get(uid));
});

// POST /media/config/:id (parent only)
router.post('/config/:id', parentOnly, (req, res) => {
  const uid = Number(req.params.id);
  ensureConfig(uid);
  const { daily_limit_minutes, weekly_limit_minutes, warn_before_minutes, active_half_count } = req.body;
  db.prepare(`UPDATE media_config SET
    daily_limit_minutes=COALESCE(?,daily_limit_minutes),
    weekly_limit_minutes=COALESCE(?,weekly_limit_minutes),
    warn_before_minutes=COALESCE(?,warn_before_minutes),
    active_half_count=COALESCE(?,active_half_count)
    WHERE user_id=?`
  ).run(
    daily_limit_minutes ?? null,
    weekly_limit_minutes ?? null,
    warn_before_minutes ?? null,
    active_half_count !== undefined ? (active_half_count ? 1 : 0) : null,
    uid
  );
  res.json({ ok: true });
});

// GET /media/usage/:id
router.get('/usage/:id', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  ensureConfig(uid);
  const config = db.prepare('SELECT * FROM media_config WHERE user_id=?').get(uid);
  const { usedToday, usedWeek } = getUsage(uid);
  res.json({
    config,
    usedToday: Math.round(usedToday * 10) / 10,
    usedWeek: Math.round(usedWeek * 10) / 10,
    remainingToday: Math.max(0, config.daily_limit_minutes - usedToday),
    remainingWeek: Math.max(0, config.weekly_limit_minutes - usedWeek),
  });
});

// GET /media/usage-all (parent only) — usage for all children
router.get('/usage-all', parentOnly, (req, res) => {
  const children = db.prepare("SELECT id,name,color,photo,age_group FROM users WHERE role='child'").all();
  const result = children.map(child => {
    ensureConfig(child.id);
    const config = db.prepare('SELECT * FROM media_config WHERE user_id=?').get(child.id);
    const { usedToday, usedWeek } = getUsage(child.id);
    return {
      ...child,
      config,
      usedToday: Math.round(usedToday * 10) / 10,
      usedWeek: Math.round(usedWeek * 10) / 10,
      remainingToday: Math.max(0, config.daily_limit_minutes - usedToday),
      remainingWeek: Math.max(0, config.weekly_limit_minutes - usedWeek),
    };
  });
  res.json(result);
});

// GET /media/sessions/active
router.get('/sessions/active', (req, res) => {
  const sessions = db.prepare(`
    SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
    FROM media_sessions ms
    JOIN media_session_users msu ON msu.session_id=ms.id
    WHERE ms.ended_at IS NULL
    GROUP BY ms.id
  `).all().map(normalizeSession);

  if (req.user.role === 'parent') return res.json(sessions);
  res.json(sessions.filter(s => s.user_ids.includes(req.user.id)));
});

// POST /media/sessions/start
router.post('/sessions/start', (req, res) => {
  const { userIds, category = 'passive' } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0)
    return res.status(400).json({ error: 'Keine Kinder ausgewählt' });

  if (req.user.role !== 'parent')
    return res.status(403).json({ error: 'Nur Eltern können Sessions starten' });

  for (const uid of userIds) {
    const active = db.prepare(`
      SELECT ms.id FROM media_sessions ms
      JOIN media_session_users msu ON msu.session_id=ms.id
      WHERE msu.user_id=? AND ms.ended_at IS NULL
    `).get(uid);
    if (active) return res.status(400).json({ error: 'Kind hat bereits eine aktive Session' });
  }

  const { sessionLimitMinutes } = req.body;
  const session = db.prepare('INSERT INTO media_sessions (category, session_limit_minutes) VALUES (?,?)')
    .run(category, sessionLimitMinutes ? Number(sessionLimitMinutes) : null);
  const sid = session.lastInsertRowid;
  const ins = db.prepare('INSERT INTO media_session_users (session_id,user_id) VALUES (?,?)');
  for (const uid of userIds) ins.run(sid, uid);

  const created = db.prepare(`
    SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
    FROM media_sessions ms JOIN media_session_users msu ON msu.session_id=ms.id
    WHERE ms.id=? GROUP BY ms.id
  `).get(sid);
  res.json(normalizeSession(created));
});

// POST /media/sessions/:id/stop
router.post('/sessions/:id/stop', (req, res) => {
  const sid = Number(req.params.id);
  const session = db.prepare(`
    SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
    FROM media_sessions ms JOIN media_session_users msu ON msu.session_id=ms.id
    WHERE ms.id=? AND ms.ended_at IS NULL GROUP BY ms.id
  `).get(sid);
  if (!session) return res.status(404).json({ error: 'Session nicht gefunden' });

  const userIds = session.user_ids.split(',').map(Number);
  if (req.user.role !== 'parent' && !userIds.includes(req.user.id))
    return res.status(403).json({ error: 'Forbidden' });

  const startedAt = new Date(session.started_at.replace(' ', 'T') + (session.started_at.includes('T') ? '' : 'Z'));
  const durationMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000 * 10) / 10;
  db.prepare("UPDATE media_sessions SET ended_at=datetime('now'),duration_minutes=? WHERE id=?")
    .run(durationMinutes, sid);
  res.json({ ok: true, duration_minutes: durationMinutes });
});

// GET /media/sessions — recent completed sessions
router.get('/sessions', (req, res) => {
  const rows = req.user.role === 'parent'
    ? db.prepare(`
        SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
        FROM media_sessions ms JOIN media_session_users msu ON msu.session_id=ms.id
        WHERE ms.ended_at IS NOT NULL
        GROUP BY ms.id ORDER BY ms.started_at DESC LIMIT 50
      `).all()
    : db.prepare(`
        SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
        FROM media_sessions ms JOIN media_session_users msu ON msu.session_id=ms.id
        WHERE ms.ended_at IS NOT NULL AND ms.id IN (
          SELECT session_id FROM media_session_users WHERE user_id=?
        )
        GROUP BY ms.id ORDER BY ms.started_at DESC LIMIT 20
      `).all(req.user.id);
  res.json(rows.map(normalizeSession));
});

// DELETE /media/sessions/:id (parent only)
router.delete('/sessions/:id', parentOnly, (req, res) => {
  db.prepare('DELETE FROM media_sessions WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
