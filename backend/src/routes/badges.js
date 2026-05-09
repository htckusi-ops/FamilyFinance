const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM badges ORDER BY id').all());
});

router.get('/:userId', (req, res) => {
  const uid = Number(req.params.userId);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  res.json(db.prepare(`
    SELECT b.*, ub.earned_at FROM user_badges ub
    JOIN badges b ON ub.badge_id=b.id
    WHERE ub.user_id=? ORDER BY ub.earned_at DESC
  `).all(uid));
});

module.exports = router;
