const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');
const { checkBadge } = require('../services/badges');

router.use(auth);

router.get('/', parentOnly, (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.photo, u.color,
           a.balance, a.savings_balance,
           ac.amount, ac.interval, ac.next_payout_at,
           ac.interest_rate, ac.interest_interval, ac.next_interest_at
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

// Child-initiated transfer between balance and savings
router.post('/:id/savings/self-transfer', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { amount, direction } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Ungültiger Betrag' });
  if (direction !== 'to_savings' && direction !== 'from_savings') {
    return res.status(400).json({ error: 'Ungültige Richtung' });
  }

  const config = db.prepare('SELECT * FROM allowance_config WHERE user_id=?').get(uid);
  if (req.user.role !== 'parent') {
    if (direction === 'to_savings' && !config?.allow_self_transfer_to_savings) {
      return res.status(403).json({ error: 'Nicht erlaubt' });
    }
    if (direction === 'from_savings' && !config?.allow_self_transfer_from_savings) {
      return res.status(403).json({ error: 'Nicht erlaubt' });
    }
  }

  const acc = db.prepare('SELECT * FROM accounts WHERE user_id=?').get(uid);
  if (direction === 'to_savings' && acc.balance < amt) {
    return res.status(400).json({ error: 'Nicht genug Guthaben' });
  }
  if (direction === 'from_savings' && acc.savings_balance < amt) {
    return res.status(400).json({ error: 'Nicht genug in der Sparbüchse' });
  }

  if (direction === 'to_savings') {
    db.prepare('UPDATE accounts SET balance=balance-?, savings_balance=savings_balance+? WHERE user_id=?')
      .run(amt, amt, uid);
    db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)')
      .run(uid, -amt, 'savings_deposit', 'Auf Sparbüchse');
    checkBadge(uid, 'first_save');
    const updated = db.prepare('SELECT savings_balance FROM accounts WHERE user_id=?').get(uid);
    if (updated.savings_balance >= 100) checkBadge(uid, 'saver_100');
  } else {
    db.prepare('UPDATE accounts SET savings_balance=savings_balance-?, balance=balance+? WHERE user_id=?')
      .run(amt, amt, uid);
    db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)')
      .run(uid, amt, 'savings_withdrawal', 'Von Sparbüchse');
  }

  res.json({ ok: true });
});

router.post('/:id/config', parentOnly, (req, res) => {
  const uid = Number(req.params.id);
  const { amount, interval, interest_rate, next_payout_at, interest_interval, next_interest_at } = req.body;
  db.prepare(`
    UPDATE allowance_config SET
      amount=?, interval=?, interest_rate=?, next_payout_at=?,
      interest_interval=?, next_interest_at=?
    WHERE user_id=?
  `).run(
    amount, interval, interest_rate || 0, next_payout_at || null,
    interest_interval || 'monthly', next_interest_at || null,
    uid
  );
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
router.post('/:id/expense', parentOnly, require('../middleware/upload').single('photo', { maxPx: 1600 }), (req, res) => {
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
router.post('/:id/receipt', parentOnly, require('../middleware/upload').single('receipt', { maxPx: 1600 }), async (req, res) => {
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

// PATCH /:id/transactions/:txId/reflect — Kind oder Elternteil speichert Reflexion
// Werte: 'good' | 'unsure' | 'regret'  (EU/OECD: financial attitudes)
router.patch('/:id/transactions/:txId/reflect', (req, res) => {
  const uid = Number(req.params.id);
  if (req.user.role !== 'parent' && req.user.id !== uid) return res.status(403).json({ error: 'Forbidden' });
  const { reflection } = req.body;
  if (!['good', 'unsure', 'regret'].includes(reflection)) return res.status(400).json({ error: 'Ungültige Reflexion' });
  db.prepare('UPDATE transactions SET reflection=? WHERE id=? AND user_id=?')
    .run(reflection, Number(req.params.txId), uid);
  res.json({ ok: true });
});

module.exports = router;
