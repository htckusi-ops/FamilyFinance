const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

// Full family summary – ideal for HA template sensors
router.get('/summary', (_req, res) => {
  const children = db.prepare("SELECT id, name, color FROM users WHERE role='child'").all();

  const result = children.map(child => {
    const account = db.prepare('SELECT balance, savings_balance FROM accounts WHERE user_id=?').get(child.id);
    const pts = db.prepare('SELECT balance, streak_weeks FROM points WHERE user_id=?').get(child.id);
    const goals = db.prepare('SELECT name, target_amount, current_amount, achieved_at FROM savings_goals WHERE user_id=?').all(child.id);
    const pendingClaims = db.prepare(
      "SELECT COUNT(*) as c FROM reward_claims WHERE user_id=? AND status='pending'"
    ).get(child.id).c;
    const fleaEarnings = db.prepare(`
      SELECT COALESCE(SUM(fi.sold_price * fo.share_percent / 100), 0) as total
      FROM flea_item_owners fo JOIN flea_items fi ON fo.flea_item_id=fi.id
      WHERE fo.user_id=? AND fi.status='sold'
    `).get(child.id);
    const badges = db.prepare(
      'SELECT COUNT(*) as c FROM user_badges WHERE user_id=?'
    ).get(child.id).c;

    return {
      id: child.id,
      name: child.name,
      color: child.color,
      balance: account?.balance || 0,
      savings_balance: account?.savings_balance || 0,
      points: pts?.balance || 0,
      streak_weeks: pts?.streak_weeks || 0,
      badges_count: badges,
      pending_reward_claims: pendingClaims,
      flea_earnings: fleaEarnings?.total || 0,
      savings_goals: goals.map(g => ({
        name: g.name,
        target: g.target_amount,
        current: g.current_amount,
        progress_pct: Math.round((g.current_amount / g.target_amount) * 100),
        achieved: !!g.achieved_at,
      })),
    };
  });

  res.json({
    children: result,
    generated_at: new Date().toISOString(),
  });
});

// Single child – for per-child sensors
router.get('/child/:id', (req, res) => {
  const uid = Number(req.params.id);
  const child = db.prepare('SELECT id, name, color FROM users WHERE id=? AND role=?').get(uid, 'child');
  if (!child) return res.status(404).json({ error: 'Not found' });

  const account = db.prepare('SELECT balance, savings_balance FROM accounts WHERE user_id=?').get(uid);
  const pts = db.prepare('SELECT balance, streak_weeks FROM points WHERE user_id=?').get(uid);
  const fleaEarnings = db.prepare(`
    SELECT COALESCE(SUM(fi.sold_price * fo.share_percent / 100), 0) as total
    FROM flea_item_owners fo JOIN flea_items fi ON fo.flea_item_id=fi.id
    WHERE fo.user_id=? AND fi.status='sold'
  `).get(uid);

  res.json({
    id: child.id,
    name: child.name,
    balance: account?.balance || 0,
    savings_balance: account?.savings_balance || 0,
    points: pts?.balance || 0,
    streak_weeks: pts?.streak_weeks || 0,
    flea_earnings: fleaEarnings?.total || 0,
  });
});

// Pending reward claims – useful for HA notifications
router.get('/pending-claims', (_req, res) => {
  const claims = db.prepare(`
    SELECT rc.id, u.name as child_name, r.name as reward_name, r.points_required, rc.claimed_at
    FROM reward_claims rc
    JOIN users u ON rc.user_id=u.id
    JOIN rewards r ON rc.reward_id=r.id
    WHERE rc.status='pending'
    ORDER BY rc.claimed_at
  `).all();
  res.json({ count: claims.length, claims });
});

module.exports = router;
