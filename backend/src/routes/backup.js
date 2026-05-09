const router = require('express').Router();
const { auth, parentOnly } = require('../middleware/auth');
const db = require('../db');

router.use(auth, parentOnly);

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all());
});

router.post('/', async (_req, res) => {
  try {
    const { createBackup } = require('../services/backup');
    const filename = await createBackup();
    res.json({ filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const file = path.join(process.env.BACKUP_PATH || '/app/backups', req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  res.download(file);
});

module.exports = router;
