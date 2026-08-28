const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');

router.use(auth, parentOnly);

router.get('/', (req, res) => {
  const tokens = db.prepare(
    'SELECT id, name, created_at, last_used_at FROM api_tokens WHERE created_by=? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(tokens);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const token = 'ff_' + crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO api_tokens (name, token, created_by) VALUES (?,?,?)').run(name, token, req.user.id);
  // Return full token only once
  res.json({ token, name });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM api_tokens WHERE id=? AND created_by=?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
