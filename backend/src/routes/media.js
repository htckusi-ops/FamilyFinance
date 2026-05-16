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

// ── Configurable reset helpers ────────────────────────────────────────────────

function getMediaSettings() {
  const rows = db.prepare(
    "SELECT key, value FROM family_settings WHERE key IN ('media_reset_hour','media_week_start_day')"
  ).all();
  const m = {};
  rows.forEach(r => { m[r.key] = r.value; });
  return {
    resetHour:    parseInt(m.media_reset_hour    || '0', 10),
    weekStartDay: parseInt(m.media_week_start_day || '1', 10),
  };
}

// "Today" shifts back when current hour is before the configured reset hour
function getMediaToday(settings) {
  const { resetHour } = settings;
  const now = new Date();
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (now.getUTCHours() < resetHour) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getMediaWeekStart(settings) {
  const { resetHour, weekStartDay } = settings;
  const now = new Date();
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (now.getUTCHours() < resetHour) d.setUTCDate(d.getUTCDate() - 1);
  const daysBack = (d.getUTCDay() - weekStartDay + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function getResetInfo(settings) {
  const { resetHour, weekStartDay } = settings;
  const now = new Date();

  // Next daily reset
  const nextDaily = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHour, 0, 0, 0));
  if (nextDaily <= now) nextDaily.setUTCDate(nextDaily.getUTCDate() + 1);

  // Next weekly reset (first upcoming weekStartDay at resetHour)
  const nextWeekly = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHour, 0, 0, 0));
  const currDay = nextWeekly.getUTCDay();
  let daysForward = (weekStartDay - currDay + 7) % 7;
  if (daysForward === 0 && nextWeekly <= now) daysForward = 7;
  nextWeekly.setUTCDate(nextWeekly.getUTCDate() + daysForward);

  return {
    resetHour,
    weekStartDay,
    hoursUntilDailyReset:  Math.round((nextDaily  - now) / 3600000 * 10) / 10,
    daysUntilWeeklyReset:  Math.round((nextWeekly - now) / 86400000 * 10) / 10,
    nextDailyReset:  nextDaily.toISOString(),
    nextWeeklyReset: nextWeekly.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function getUsage(uid) {
  const settings = getMediaSettings();
  const today = getMediaToday(settings);
  const ws    = getMediaWeekStart(settings);

  const sessions = db.prepare(`
    SELECT ms.duration_minutes, ms.started_at FROM media_sessions ms
    JOIN media_session_users msu ON msu.session_id=ms.id
    WHERE msu.user_id=? AND ms.ended_at IS NOT NULL
  `).all(uid);

  let usedToday = 0, usedWeek = 0;
  for (const r of sessions) {
    const d = r.started_at.slice(0, 10);
    const mins = r.duration_minutes || 0;
    if (d === today) usedToday += mins;
    if (d >= ws) usedWeek += mins;
  }

  // Manual corrections (positive = add time, negative = reduce)
  const corrections = db.prepare(
    'SELECT date, delta_minutes FROM media_manual_corrections WHERE user_id=?'
  ).all(uid);
  for (const c of corrections) {
    if (c.date === today) usedToday += c.delta_minutes;
    if (c.date >= ws)     usedWeek  += c.delta_minutes;
  }

  return { usedToday: Math.max(0, usedToday), usedWeek: Math.max(0, usedWeek) };
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
  const settings = getMediaSettings();
  res.json({
    config,
    usedToday: Math.round(usedToday * 10) / 10,
    usedWeek:  Math.round(usedWeek  * 10) / 10,
    remainingToday: Math.max(0, config.daily_limit_minutes - usedToday),
    remainingWeek:  Math.max(0, config.weekly_limit_minutes - usedWeek),
    resetInfo: getResetInfo(settings),
  });
});

// GET /media/usage-all (parent only) — usage for all children
router.get('/usage-all', parentOnly, (req, res) => {
  const children = db.prepare(`
    SELECT u.id, u.name, u.color, u.photo, u.age_group,
           COALESCE(a.balance, 0) AS balance,
           COALESCE(a.savings_balance, 0) AS savings_balance,
           COALESCE(p.balance, 0) AS points_balance,
           COALESCE(p.streak_weeks, 0) AS streak_weeks
    FROM users u
    LEFT JOIN accounts a ON a.user_id = u.id
    LEFT JOIN points p ON p.user_id = u.id
    WHERE u.role = 'child'
  `).all();
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

// GET /media/sessions — recent completed sessions (optionally filtered by ?userId=)
router.get('/sessions', (req, res) => {
  const filterUid = req.query.userId ? Number(req.query.userId) : null;
  let rows;
  if (req.user.role === 'parent') {
    rows = filterUid
      ? db.prepare(`
          SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
          FROM media_sessions ms JOIN media_session_users msu ON msu.session_id=ms.id
          WHERE ms.ended_at IS NOT NULL AND ms.id IN (
            SELECT session_id FROM media_session_users WHERE user_id=?
          )
          GROUP BY ms.id ORDER BY ms.started_at DESC LIMIT 30
        `).all(filterUid)
      : db.prepare(`
          SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
          FROM media_sessions ms JOIN media_session_users msu ON msu.session_id=ms.id
          WHERE ms.ended_at IS NOT NULL
          GROUP BY ms.id ORDER BY ms.started_at DESC LIMIT 50
        `).all();
  } else {
    rows = db.prepare(`
        SELECT ms.*, GROUP_CONCAT(msu.user_id) as user_ids
        FROM media_sessions ms JOIN media_session_users msu ON msu.session_id=ms.id
        WHERE ms.ended_at IS NOT NULL AND ms.id IN (
          SELECT session_id FROM media_session_users WHERE user_id=?
        )
        GROUP BY ms.id ORDER BY ms.started_at DESC LIMIT 20
      `).all(req.user.id);
  }
  res.json(rows.map(normalizeSession));
});

// PATCH /media/sessions/:id (parent only) — edit duration and/or notes
router.patch('/sessions/:id', parentOnly, (req, res) => {
  const sid = Number(req.params.id);
  const { duration_minutes, notes } = req.body;
  if (duration_minutes !== undefined) {
    const mins = Math.max(0, Math.round(Number(duration_minutes) * 10) / 10);
    db.prepare('UPDATE media_sessions SET duration_minutes=? WHERE id=?').run(mins, sid);
  }
  if (notes !== undefined) {
    db.prepare('UPDATE media_sessions SET notes=? WHERE id=?').run(notes || null, sid);
  }
  res.json({ ok: true });
});

// DELETE /media/sessions/:id (parent only)
router.delete('/sessions/:id', parentOnly, (req, res) => {
  db.prepare('DELETE FROM media_sessions WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// POST /media/corrections/:id (parent only) — manual time correction for a child
// Body: { date: 'YYYY-MM-DD', delta_minutes: number, note?: string }
// date = which day the correction applies to (for today's usage vs. earlier in the week)
router.post('/corrections/:id', parentOnly, (req, res) => {
  const uid = Number(req.params.id);
  const { date, delta_minutes, note } = req.body;
  if (!date || delta_minutes === undefined || delta_minutes === null) {
    return res.status(400).json({ error: 'date und delta_minutes erforderlich' });
  }
  db.prepare(
    'INSERT INTO media_manual_corrections (user_id, date, delta_minutes, note) VALUES (?,?,?,?)'
  ).run(uid, date, Math.round(Number(delta_minutes) * 10) / 10, note || null);
  res.json({ ok: true });
});

module.exports = router;
