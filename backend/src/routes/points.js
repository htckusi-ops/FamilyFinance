const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');
const { checkBadge, checkJobBadges, checkStreakBadges } = require('../services/badges');
const { sendNotification } = require('../services/notify');

router.use(auth);

// Mini-job list (both duties and extras)
router.get('/jobs', (_req, res) => {
  res.json(db.prepare(
    'SELECT * FROM mini_jobs WHERE active=1 ORDER BY job_type DESC, name'
  ).all());
});

router.post('/jobs', parentOnly, (req, res) => {
  const { name, points, recurrence, job_type, image } = req.body;
  const type = job_type || 'extra';
  const r = db.prepare(
    'INSERT INTO mini_jobs (name,points,recurrence,job_type,image) VALUES (?,?,?,?,?)'
  ).run(name, Number(points) || 0, recurrence || 'manual', type, image || null);
  res.json({ id: r.lastInsertRowid });
});

router.patch('/jobs/:id', parentOnly, (req, res) => {
  const { name, points, recurrence, active, job_type, image } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (points !== undefined) fields.points = points;
  if (recurrence !== undefined) fields.recurrence = recurrence;
  if (active !== undefined) fields.active = active ? 1 : 0;
  if (job_type !== undefined) fields.job_type = job_type;
  if (image !== undefined) fields.image = image;
  const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
  if (sets) db.prepare(`UPDATE mini_jobs SET ${sets} WHERE id=?`).run(...Object.values(fields), Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/jobs/:id', parentOnly, (req, res) => {
  db.prepare('UPDATE mini_jobs SET active=0 WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Award points (parent)
router.post('/award', parentOnly, (req, res) => {
  const { user_id, delta, description, mini_job_id } = req.body;
  const uid = Number(user_id);

  db.prepare('UPDATE points SET balance=balance+? WHERE user_id=?').run(delta, uid);
  db.prepare(
    'INSERT INTO point_events (user_id,delta,description,mini_job_id) VALUES (?,?,?,?)'
  ).run(uid, delta, description, mini_job_id || null);

  // Update streak (mit Freeze-Mechanismus: pädagogisch — Resilienz statt Scham bei Ausfall)
  if (mini_job_id) {
    const week = getISOWeek();
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const p = db.prepare('SELECT last_job_week, streak_weeks, streak_freeze, streak_freeze_month FROM points WHERE user_id=?').get(uid);
    const lastWeek = getISOWeek(-1);
    const twoWeeksAgo = getISOWeek(-2);
    let streak = p.streak_weeks;
    let freeze = p.streak_freeze ?? 1;
    // Freeze automatisch auffüllen wenn neuer Monat
    if (p.streak_freeze_month !== thisMonth) freeze = 1;

    let freezeUsed = false;
    if (p.last_job_week === week) {
      // schon diese Woche gezählt — nichts tun
    } else if (p.last_job_week === lastWeek) {
      streak += 1;
    } else if (p.last_job_week === twoWeeksAgo && freeze > 0) {
      // genau 1 Woche verpasst + Freeze verfügbar → Streak retten
      streak += 1;
      freeze -= 1;
      freezeUsed = true;
    } else {
      streak = 1;
    }
    db.prepare('UPDATE points SET last_job_week=?, streak_weeks=?, streak_freeze=?, streak_freeze_month=? WHERE user_id=?')
      .run(week, streak, freeze, thisMonth, uid);
    checkStreakBadges(uid);
    checkJobBadges(uid);
    if (freezeUsed) {
      sendNotification(uid, 'streak_freeze_used', { streak });
    }
  }

  sendNotification(uid, 'points_received', { delta, description });
  res.json({ ok: true });
});

// Convert points ↔ CHF
router.post('/convert', parentOnly, (req, res) => {
  const { user_id, direction, points: pts } = req.body;
  const uid = Number(user_id);
  const amount = Math.abs(Number(pts));
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Ungültige Menge' });

  const rateSetting = db.prepare("SELECT value FROM family_settings WHERE key='point_value_chf'").get();
  const rate = parseFloat(rateSetting?.value || '0.10');

  const account = db.prepare('SELECT balance FROM accounts WHERE user_id=?').get(uid);
  const pointRow = db.prepare('SELECT balance FROM points WHERE user_id=?').get(uid);

  if (direction === 'points_to_chf') {
    if ((pointRow?.balance || 0) < amount) return res.status(400).json({ error: 'Nicht genug Punkte' });
    const chf = Math.round(amount * rate * 100) / 100;
    db.prepare('UPDATE points SET balance=balance-? WHERE user_id=?').run(amount, uid);
    db.prepare('INSERT INTO point_events (user_id,delta,description) VALUES (?,?,?)').run(uid, -amount, `Umgetauscht in CHF ${chf.toFixed(2)}`);
    db.prepare('UPDATE accounts SET balance=balance+? WHERE user_id=?').run(chf, uid);
    db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)').run(uid, chf, 'point_exchange', `${amount} Punkte eingelöst`);
    return res.json({ ok: true, points: -amount, chf });
  }

  if (direction === 'chf_to_points') {
    const chf = Math.round(amount * rate * 100) / 100;
    if ((account?.balance || 0) < chf) return res.status(400).json({ error: 'Nicht genug Guthaben' });
    const earnedPoints = amount;
    db.prepare('UPDATE accounts SET balance=balance-? WHERE user_id=?').run(chf, uid);
    db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)').run(uid, -chf, 'point_exchange', `${earnedPoints} Punkte gekauft`);
    db.prepare('UPDATE points SET balance=balance+? WHERE user_id=?').run(earnedPoints, uid);
    db.prepare('INSERT INTO point_events (user_id,delta,description) VALUES (?,?,?)').run(uid, earnedPoints, `Gekauft für CHF ${chf.toFixed(2)}`);
    return res.json({ ok: true, points: earnedPoints, chf: -chf });
  }

  res.status(400).json({ error: 'Ungültige Richtung' });
});

// Child's point history
router.get('/:id', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  const summary = db.prepare('SELECT balance, streak_weeks, streak_freeze FROM points WHERE user_id=?').get(uid);
  const events = db.prepare(`
    SELECT pe.*, mj.name as job_name FROM point_events pe
    LEFT JOIN mini_jobs mj ON pe.mini_job_id=mj.id
    WHERE pe.user_id=? ORDER BY pe.created_at DESC
  `).all(uid);
  res.json({ summary, events });
});

function getISOWeek(offsetWeeks = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetWeeks * 7);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

module.exports = router;
