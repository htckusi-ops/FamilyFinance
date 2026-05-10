const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');
const { checkBadge } = require('../services/badges');

router.use(auth);

router.get('/', parentOnly, (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.photo, u.color,
           a.balance, a.savings_balance,
           ac.amount, ac.interval, ac.next_payout_at, ac.interest_rate
    FROM users u
    LEFT JOIN accounts a ON a.user_id=u.id
    LEFT JOIN allowance_config ac ON ac.user_id=u.id
    WHERE u.role='child'
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const account = db.prepare('SELECT * FROM accounts WHERE user_id=?').get(uid);
  const config = db.prepare('SELECT * FROM allowance_config WHERE user_id=?').get(uid);
  const transactions = db.prepare(
    'SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC'
  ).all(uid);
  const goals = db.prepare('SELECT * FROM savings_goals WHERE user_id=? ORDER BY created_at DESC').all(uid);
  res.json({ account, config, transactions, goals });
});

router.post('/:id/pay', parentOnly, (req, res) => {
  const uid = Number(req.params.id);
  const { amount, description, type } = req.body;
  const txType = type || 'allowance';

  db.prepare('UPDATE accounts SET balance = balance + ? WHERE user_id=?').run(amount, uid);
  db.prepare(
    'INSERT INTO transactions (user_id, amount, type, description) VALUES (?,?,?,?)'
  ).run(uid, amount, txType, description || 'Taschengeld');

  checkBadge(uid, 'saver_100');
  res.json({ ok: true });
});

router.post('/:id/savings/deposit', parentOnly, (req, res) => {
  const uid = Number(req.params.id);
  const { amount } = req.body;
  db.prepare('UPDATE accounts SET balance=balance-?, savings_balance=savings_balance+? WHERE user_id=?')
    .run(amount, amount, uid);
  db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)')
    .run(uid, -amount, 'savings_deposit', 'Auf Sparkonto');

  checkBadge(uid, 'first_save');
  const acc = db.prepare('SELECT savings_balance FROM accounts WHERE user_id=?').get(uid);
  if (acc.savings_balance >= 100) checkBadge(uid, 'saver_100');
  res.json({ ok: true });
});

router.post('/:id/config', parentOnly, (req, res) => {
  const uid = Number(req.params.id);
  const { amount, interval, interest_rate, next_payout_at } = req.body;
  db.prepare(`
    UPDATE allowance_config SET amount=?, interval=?, interest_rate=?, next_payout_at=?
    WHERE user_id=?
  `).run(amount, interval, interest_rate || 0, next_payout_at || null, uid);
  res.json({ ok: true });
});

// Savings goals
router.get('/:id/goals', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  res.json(db.prepare('SELECT * FROM savings_goals WHERE user_id=? ORDER BY created_at DESC').all(uid));
});

router.post('/:id/goals', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  const { name, target_amount } = req.body;
  const r = db.prepare(
    'INSERT INTO savings_goals (user_id, name, target_amount) VALUES (?,?,?)'
  ).run(uid, name, target_amount);
  checkBadge(uid, 'first_save');
  res.json({ id: r.lastInsertRowid });
});

router.patch('/:id/goals/:gid', parentOnly, (req, res) => {
  const { current_amount } = req.body;
  const uid = Number(req.params.id);
  const gid = Number(req.params.gid);
  db.prepare('UPDATE savings_goals SET current_amount=? WHERE id=? AND user_id=?')
    .run(current_amount, gid, uid);
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id=?').get(gid);
  if (goal && goal.current_amount >= goal.target_amount && !goal.achieved_at) {
    db.prepare("UPDATE savings_goals SET achieved_at=datetime('now') WHERE id=?").run(gid);
    checkBadge(uid, 'goal_reached');
  }
  res.json({ ok: true });
});

router.delete('/:id/goals/:gid', parentOnly, (req, res) => {
  db.prepare('DELETE FROM savings_goals WHERE id=? AND user_id=?')
    .run(Number(req.params.gid), Number(req.params.id));
  res.json({ ok: true });
});

// Record a child's purchase (deduct from balance, optional photo)
router.post('/:id/expense', parentOnly, require('../middleware/upload').single('photo'), (req, res) => {
  const uid = Number(req.params.id);
  const amount = Math.abs(Number(req.body.amount));
  const description = req.body.description || 'Ausgabe';
  if (!amount) return res.status(400).json({ error: 'Betrag fehlt' });

  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare('UPDATE accounts SET balance=balance-? WHERE user_id=?').run(amount, uid);
  const r = db.prepare(
    'INSERT INTO transactions (user_id,amount,type,description,receipt_photo) VALUES (?,?,?,?,?)'
  ).run(uid, -amount, 'expense', description, photo);
  res.json({ id: r.lastInsertRowid, photo });
});

// Receipt OCR
router.post('/:id/receipt', parentOnly, require('../middleware/upload').single('receipt'), async (req, res) => {
  const uid = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const Tesseract = require('tesseract.js');
    const { data } = await Tesseract.recognize(req.file.path, 'deu');
    const match = data.text.match(/(\d+[.,]\d{2})/g);
    const amounts = match ? match.map(m => parseFloat(m.replace(',', '.'))) : [];
    const photo = `/uploads/${req.file.filename}`;
    res.json({ text: data.text, amounts, photo });
  } catch (err) {
    res.status(500).json({ error: 'OCR failed', detail: err.message });
  }
});

module.exports = router;
