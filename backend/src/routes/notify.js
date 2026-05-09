const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');

router.use(auth, parentOnly);

router.get('/', (req, res) => {
  const cfg = db.prepare('SELECT * FROM notification_config WHERE user_id=?').get(req.user.id);
  res.json(cfg || {});
});

router.post('/', (req, res) => {
  const { telegram_chat_id, events } = req.body;
  const uid = req.user.id;
  const existing = db.prepare('SELECT id FROM notification_config WHERE user_id=?').get(uid);
  if (existing) {
    db.prepare('UPDATE notification_config SET telegram_chat_id=?, events=? WHERE user_id=?')
      .run(telegram_chat_id, JSON.stringify(events || []), uid);
  } else {
    db.prepare('INSERT INTO notification_config (user_id, telegram_chat_id, events) VALUES (?,?,?)')
      .run(uid, telegram_chat_id, JSON.stringify(events || []));
  }
  res.json({ ok: true });
});

module.exports = router;
