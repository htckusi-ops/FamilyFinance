const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(auth);

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id,name,role,photo,color,pin_required,age_group FROM users').all();
  res.json(users);
});

router.get('/:id/dashboard', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const user = db.prepare('SELECT id,name,role,photo,color FROM users WHERE id=?').get(uid);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const account = db.prepare('SELECT balance, savings_balance FROM accounts WHERE user_id=?').get(uid);
  const points = db.prepare('SELECT balance, streak_weeks FROM points WHERE user_id=?').get(uid);
  const goals = db.prepare('SELECT * FROM savings_goals WHERE user_id=? ORDER BY created_at DESC').all(uid);
  const rewardClaims = db.prepare(`
    SELECT rc.*, r.name as reward_name, r.points_required, r.image
    FROM reward_claims rc JOIN rewards r ON rc.reward_id=r.id
    WHERE rc.user_id=? ORDER BY rc.claimed_at DESC LIMIT 5
  `).all(uid);
  const badges = db.prepare(`
    SELECT b.*, ub.earned_at FROM user_badges ub JOIN badges b ON ub.badge_id=b.id
    WHERE ub.user_id=? ORDER BY ub.earned_at DESC
  `).all(uid);
  const fleaEarnings = db.prepare(`
    SELECT COALESCE(SUM(fi.sold_price * fo.share_percent / 100), 0) as total
    FROM flea_item_owners fo
    JOIN flea_items fi ON fo.flea_item_id=fi.id
    WHERE fo.user_id=? AND fi.status='sold'
  `).get(uid);
  const recentTx = db.prepare(
    'SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 10'
  ).all(uid);

  res.json({ user, account, points, goals, rewardClaims, badges, fleaEarnings, recentTx });
});

router.post('/', parentOnly, (req, res) => {
  const { name, role, color, pin_required, pin, password } = req.body;
  let pin_hash = null;
  let password_hash = null;

  if (role === 'child' && pin_required && pin) {
    pin_hash = bcrypt.hashSync(String(pin), 10);
  }
  if (role === 'parent' && password) {
    password_hash = bcrypt.hashSync(password, 10);
  }

  const user = db.prepare(
    'INSERT INTO users (name, role, color, pin_required, pin_hash, password_hash) VALUES (?,?,?,?,?,?)'
  ).run(name, role, color || '#4F86C6', pin_required ? 1 : 0, pin_hash, password_hash);

  db.prepare('INSERT INTO accounts (user_id) VALUES (?)').run(user.lastInsertRowid);
  db.prepare('INSERT INTO points (user_id) VALUES (?)').run(user.lastInsertRowid);
  db.prepare('INSERT INTO allowance_config (user_id) VALUES (?)').run(user.lastInsertRowid);

  res.json({ id: user.lastInsertRowid });
});

router.patch('/:id', parentOnly, (req, res) => {
  const uid = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const { name, color, pin_required, pin, password, age_group } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (color) updates.color = color;
  if (pin_required !== undefined) updates.pin_required = pin_required ? 1 : 0;
  if (pin) updates.pin_hash = bcrypt.hashSync(String(pin), 10);
  if (password) updates.password_hash = bcrypt.hashSync(password, 10);
  if (age_group) updates.age_group = age_group;

  const sets = Object.keys(updates).map(k => `${k}=?`).join(',');
  if (sets) {
    db.prepare(`UPDATE users SET ${sets} WHERE id=?`).run(...Object.values(updates), uid);
  }
  res.json({ ok: true });
});

router.post('/:id/photo', parentOnly, upload.single('photo'), (req, res) => {
  const uid = Number(req.params.id);
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare('UPDATE users SET photo=? WHERE id=?').run(photo, uid);
  res.json({ photo });
});

router.delete('/:id', parentOnly, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
