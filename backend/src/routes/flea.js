const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkBadge } = require('../services/badges');

router.use(auth);

// === DAYS ===
router.get('/days', (_req, res) => {
  res.json(db.prepare('SELECT * FROM flea_market_days ORDER BY date DESC').all());
});

router.post('/days', parentOnly, (req, res) => {
  const { date, name } = req.body;
  const r = db.prepare('INSERT INTO flea_market_days (date, name) VALUES (?,?)').run(date, name);
  res.json({ id: r.lastInsertRowid });
});

router.delete('/days/:id', parentOnly, (req, res) => {
  db.prepare('DELETE FROM flea_market_days WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// === ITEMS ===
router.get('/items', (req, res) => {
  const { day_id, user_id } = req.query;
  let q = `
    SELECT fi.*, GROUP_CONCAT(u.name) as owner_names, GROUP_CONCAT(fo.user_id) as owner_ids
    FROM flea_items fi
    LEFT JOIN flea_item_owners fo ON fo.flea_item_id=fi.id
    LEFT JOIN users u ON fo.user_id=u.id
  `;
  const params = [];
  const where = [];
  if (day_id) { where.push('fi.day_id=?'); params.push(day_id); }
  if (user_id) { where.push('fo.user_id=?'); params.push(user_id); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' GROUP BY fi.id ORDER BY fi.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

router.get('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM flea_items WHERE id=?').get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  const owners = db.prepare(`
    SELECT fo.*, u.name FROM flea_item_owners fo JOIN users u ON fo.user_id=u.id
    WHERE fo.flea_item_id=?
  `).all(item.id);
  res.json({ ...item, owners });
});

router.post('/items', parentOnly, upload.single('photo'), (req, res) => {
  const { day_id, name, description, barcode, category, condition, suggested_price, owners } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  const item = db.prepare(`
    INSERT INTO flea_items (day_id,name,description,barcode,photo,category,condition,suggested_price)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(day_id || null, name, description || null, barcode || null, photo, category || 'Sonstiges', condition || 'gut', suggested_price || 0);

  const itemId = item.lastInsertRowid;
  const ownerList = owners ? JSON.parse(owners) : [];
  if (ownerList.length === 0 && req.body.user_id) {
    ownerList.push({ user_id: req.body.user_id, share_percent: 100 });
  }
  for (const o of ownerList) {
    db.prepare('INSERT INTO flea_item_owners (flea_item_id,user_id,share_percent) VALUES (?,?,?)')
      .run(itemId, o.user_id, o.share_percent || 100);
    checkBadge(Number(o.user_id), 'flea_first_item');
  }

  res.json({ id: itemId });
});

router.patch('/items/:id', parentOnly, upload.single('photo'), (req, res) => {
  const id = Number(req.params.id);
  const { name, description, barcode, category, condition, suggested_price, day_id } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (description !== undefined) fields.description = description;
  if (barcode !== undefined) fields.barcode = barcode;
  if (category !== undefined) fields.category = category;
  if (condition !== undefined) fields.condition = condition;
  if (suggested_price !== undefined) fields.suggested_price = suggested_price;
  if (day_id !== undefined) fields.day_id = day_id;
  if (req.file) fields.photo = `/uploads/${req.file.filename}`;
  const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
  if (sets) db.prepare(`UPDATE flea_items SET ${sets} WHERE id=?`).run(...Object.values(fields), id);
  res.json({ ok: true });
});

// Sell an item (cashier function)
router.post('/items/:id/sell', parentOnly, (req, res) => {
  const id = Number(req.params.id);
  const { sold_price } = req.body;
  db.prepare("UPDATE flea_items SET status='sold', sold_price=? WHERE id=?").run(sold_price, id);

  const owners = db.prepare(
    'SELECT fo.user_id, fo.share_percent FROM flea_item_owners fo WHERE fo.flea_item_id=?'
  ).all(id);

  for (const owner of owners) {
    const earning = sold_price * owner.share_percent / 100;
    db.prepare('UPDATE accounts SET balance=balance+? WHERE user_id=?').run(earning, owner.user_id);
    db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)')
      .run(owner.user_id, earning, 'flea_sale', `Flohmarkt-Erlös`);
    checkBadge(owner.user_id, 'flea_first_sale');
  }

  res.json({ ok: true });
});

router.post('/items/:id/unsold', parentOnly, (req, res) => {
  db.prepare("UPDATE flea_items SET status='unsold' WHERE id=?").run(Number(req.params.id));
  res.json({ ok: true });
});

// Reset item to available (archive re-use)
router.post('/items/:id/reactivate', parentOnly, (req, res) => {
  const { day_id } = req.body;
  db.prepare("UPDATE flea_items SET status='available', sold_price=NULL, day_id=? WHERE id=?")
    .run(day_id || null, Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/items/:id', parentOnly, (req, res) => {
  db.prepare('DELETE FROM flea_items WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Day summary
router.get('/days/:id/summary', (req, res) => {
  const dayId = Number(req.params.id);
  const items = db.prepare(`
    SELECT fi.*, fo.user_id, fo.share_percent, u.name as owner_name
    FROM flea_items fi
    JOIN flea_item_owners fo ON fo.flea_item_id=fi.id
    JOIN users u ON fo.user_id=u.id
    WHERE fi.day_id=?
  `).all(dayId);

  const byChild = {};
  for (const item of items) {
    if (!byChild[item.user_id]) byChild[item.user_id] = { name: item.owner_name, total: 0, items: [] };
    if (item.status === 'sold') {
      byChild[item.user_id].total += item.sold_price * item.share_percent / 100;
    }
    byChild[item.user_id].items.push(item);
  }

  res.json({ byChild, total: Object.values(byChild).reduce((s, c) => s + c.total, 0) });
});

// PDF labels
router.get('/days/:id/labels.pdf', parentOnly, async (req, res) => {
  const dayId = Number(req.params.id);
  const day = db.prepare('SELECT * FROM flea_market_days WHERE id=?').get(dayId);
  const items = db.prepare(`
    SELECT fi.*, u.name as owner_name
    FROM flea_items fi
    LEFT JOIN flea_item_owners fo ON fo.flea_item_id=fi.id
    LEFT JOIN users u ON fo.user_id=u.id
    WHERE fi.day_id=? AND fi.status='available'
  `).all(dayId);

  const pdfService = require('../services/pdf');
  const pdfBuffer = await pdfService.generateLabels(day, items);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="etiketten-${day.date}.pdf"`);
  res.send(pdfBuffer);
});

module.exports = router;
