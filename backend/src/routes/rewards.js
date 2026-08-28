const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');
const { checkBadge } = require('../services/badges');
const { sendNotification } = require('../services/notify');
const { single: upload } = require('../middleware/upload');

router.use(auth);

function attachTargets(rewards) {
  const ids = rewards.map(r => r.id);
  if (!ids.length) return rewards;
  const targets = db.prepare(
    `SELECT rt.reward_id, rt.user_id, u.name, u.photo, u.color
     FROM reward_targets rt JOIN users u ON rt.user_id=u.id
     WHERE rt.reward_id IN (${ids.map(() => '?').join(',')})`
  ).all(...ids);
  const map = {};
  for (const t of targets) {
    if (!map[t.reward_id]) map[t.reward_id] = [];
    map[t.reward_id].push({ user_id: t.user_id, name: t.name, photo: t.photo, color: t.color });
  }
  return rewards.map(r => ({ ...r, targets: map[r.id] || [] }));
}

router.get('/', (req, res) => {
  const uid = req.user.id;
  const role = req.user.role;
  let rewards = db.prepare('SELECT * FROM rewards WHERE active=1 ORDER BY points_required').all();
  rewards = attachTargets(rewards);

  if (role === 'child') {
    const pts = db.prepare('SELECT balance FROM points WHERE user_id=?').get(uid);
    const myPoints = pts ? pts.balance : 0;

    rewards = rewards.map(r => {
      // Only show if no targets or this child is a target
      const relevant = r.targets.length === 0 || r.targets.some(t => t.user_id === uid);
      if (!relevant) return null;

      if (r.require_all && r.targets.length > 1) {
        const targetPoints = r.targets.map(t => {
          const p = db.prepare('SELECT balance FROM points WHERE user_id=?').get(t.user_id);
          return { ...t, points: p ? p.balance : 0 };
        });
        const canClaim = targetPoints.every(t => t.points >= r.points_required);
        return { ...r, myPoints, canClaim, targetPoints };
      }
      return { ...r, myPoints, canClaim: myPoints >= r.points_required };
    }).filter(Boolean);
  }

  res.json(rewards);
});

router.post('/', parentOnly, upload('image', { maxPx: 400 }), (req, res) => {
  const { name, points_required, image: imageText, require_all, targets } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (imageText || null);
  const requireAll = (require_all === '1' || require_all === true || require_all === 'true') ? 1 : 0;
  const r = db.prepare('INSERT INTO rewards (name,points_required,image,require_all) VALUES (?,?,?,?)').run(name, points_required, image, requireAll);
  const rewardId = r.lastInsertRowid;
  const targetList = targets ? JSON.parse(targets) : [];
  for (const uid of targetList) {
    db.prepare('INSERT OR IGNORE INTO reward_targets (reward_id, user_id) VALUES (?,?)').run(rewardId, uid);
  }
  res.json({ id: rewardId });
});

router.patch('/:id', parentOnly, upload('image', { maxPx: 400 }), (req, res) => {
  const id = Number(req.params.id);
  const { name, points_required, active, image: imageText, require_all, targets } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (points_required !== undefined) fields.points_required = points_required;
  if (active !== undefined) fields.active = active ? 1 : 0;
  if (require_all !== undefined) fields.require_all = (require_all === '1' || require_all === true || require_all === 'true') ? 1 : 0;
  if (req.file) fields.image = `/uploads/${req.file.filename}`;
  else if (imageText !== undefined) fields.image = imageText || null;
  const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
  if (sets) db.prepare(`UPDATE rewards SET ${sets} WHERE id=?`).run(...Object.values(fields), id);

  if (targets !== undefined) {
    db.prepare('DELETE FROM reward_targets WHERE reward_id=?').run(id);
    for (const uid of JSON.parse(targets)) {
      db.prepare('INSERT OR IGNORE INTO reward_targets (reward_id, user_id) VALUES (?,?)').run(id, uid);
    }
  }
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

  const targets = db.prepare('SELECT user_id FROM reward_targets WHERE reward_id=?').all(rewardId);
  if (targets.length > 0 && !targets.some(t => t.user_id === uid)) {
    return res.status(403).json({ error: 'Diese Belohnung gilt nicht für dich' });
  }

  if (reward.require_all && targets.length > 1) {
    for (const t of targets) {
      const p = db.prepare('SELECT balance FROM points WHERE user_id=?').get(t.user_id);
      if (!p || p.balance < reward.points_required) {
        return res.status(400).json({ error: 'Noch nicht alle Kinder haben genug Punkte' });
      }
    }
  } else {
    const pts = db.prepare('SELECT balance FROM points WHERE user_id=?').get(uid);
    if (!pts || pts.balance < reward.points_required) {
      return res.status(400).json({ error: 'Not enough points' });
    }
  }

  const r = db.prepare('INSERT INTO reward_claims (user_id, reward_id, status) VALUES (?,?,?)').run(uid, rewardId, 'pending');
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
    db.prepare("UPDATE reward_claims SET status='approved', approved_at=datetime('now') WHERE id=?").run(claim.id);
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
