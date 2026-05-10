const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');
const { checkBadge } = require('../services/badges');
const { sendNotification } = require('../services/notify');
const { single: upload } = require('../middleware/upload');

router.use(auth);

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM rewards WHERE active=1 ORDER BY points_required').all());
});

router.post('/', parentOnly, upload('image', { maxPx: 400 }), (req, res) => {
  const { name, points_required, image: imageText } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (imageText || null);
  const r = db.prepare('INSERT INTO rewards (name,points_required,image) VALUES (?,?,?)').run(name, points_required, image);
  res.json({ id: r.lastInsertRowid });
});

router.patch('/:id', parentOnly, upload('image', { maxPx: 400 }), (req, res) => {
  const { name, points_required, active, image: imageText } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (points_required !== undefined) fields.points_required = points_required;
  if (active !== undefined) fields.active = active ? 1 : 0;
  if (req.file) fields.image = `/uploads/${req.file.filename}`;
  else if (imageText !== undefined) fields.image = imageText || null;
  const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
  if (sets) db.prepare(`UPDATE rewards SET ${sets} WHERE id=?`).run(...Object.values(fields), Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/:id', parentOnly, (req, res) => {
  db.prepare('UPDATE rewards SET active=0 WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Child claims a reward
router.post('/:id/claim', (req, res) => {
  const uid = req.user.id;
  const rewardId = Number(req.params.id);
  const reward = db.prepare('SELECT * FROM rewards WHERE id=? AND active=1').get(rewardId);
  if (!reward) return res.status(404).json({ error: 'Reward not found' });

  const pts = db.prepare('SELECT balance FROM points WHERE user_id=?').get(uid);
  if (!pts || pts.balance < reward.points_required) {
    return res.status(400).json({ error: 'Not enough points' });
  }

  const r = db.prepare(
    'INSERT INTO reward_claims (user_id, reward_id, status) VALUES (?,?,?)'
  ).run(uid, rewardId, 'pending');

  sendNotification(uid, 'reward_claimed', { reward_name: reward.name });
  res.json({ id: r.lastInsertRowid });
});

// Parent approves/rejects claim
router.patch('/claims/:claimId', parentOnly, (req, res) => {
  const { status } = req.body;
  const claim = db.prepare('SELECT * FROM reward_claims WHERE id=?').get(Number(req.params.claimId));
  if (!claim) return res.status(404).json({ error: 'Not found' });

  if (status === 'approved') {
    const reward = db.prepare('SELECT points_required FROM rewards WHERE id=?').get(claim.reward_id);
    db.prepare('UPDATE points SET balance=balance-? WHERE user_id=?').run(reward.points_required, claim.user_id);
    db.prepare('INSERT INTO point_events (user_id,delta,description) VALUES (?,?,?)')
      .run(claim.user_id, -reward.points_required, `Belohnung eingelöst`);
    db.prepare("UPDATE reward_claims SET status='approved', approved_at=datetime('now') WHERE id=?")
      .run(claim.id);
    checkBadge(claim.user_id, 'first_reward');
  } else {
    db.prepare("UPDATE reward_claims SET status='rejected' WHERE id=?").run(claim.id);
  }

  res.json({ ok: true });
});

// All pending claims (for parents)
router.get('/claims/pending', parentOnly, (_req, res) => {
  const claims = db.prepare(`
    SELECT rc.*, u.name as child_name, u.photo, r.name as reward_name, r.points_required
    FROM reward_claims rc
    JOIN users u ON rc.user_id=u.id
    JOIN rewards r ON rc.reward_id=r.id
    WHERE rc.status='pending'
    ORDER BY rc.claimed_at DESC
  `).all();
  res.json(claims);
});

router.get('/claims/:userId', (req, res) => {
  const uid = Number(req.params.userId);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  const claims = db.prepare(`
    SELECT rc.*, r.name as reward_name, r.points_required, r.image
    FROM reward_claims rc JOIN rewards r ON rc.reward_id=r.id
    WHERE rc.user_id=? ORDER BY rc.claimed_at DESC
  `).all(uid);
  res.json(claims);
});

module.exports = router;
