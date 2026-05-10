const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');

// Public read (children need some settings too)
router.get('/', auth, (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM family_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

// Only parents can update
router.patch('/', auth, parentOnly, (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO family_settings (key,value) VALUES (?,?)');
  const updateMany = db.transaction(entries => {
    for (const [k, v] of entries) update.run(k, String(v));
  });
  updateMany(Object.entries(req.body));
  res.json({ ok: true });
});

module.exports = router;
