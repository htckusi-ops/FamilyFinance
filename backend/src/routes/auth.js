const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

// Parent login with password
router.post('/login', (req, res) => {
  const { name, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE name = ? COLLATE NOCASE AND role = ?').get(name, 'parent');
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: safeUser(user) });
});

// Child login (by id, optional pin)
router.post('/child-login', (req, res) => {
  const { id, pin } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(id, 'child');
  if (!user) return res.status(404).json({ error: 'Child not found' });

  if (user.pin_required) {
    if (!pin || !bcrypt.compareSync(String(pin), user.pin_hash)) {
      return res.status(401).json({ error: 'Wrong PIN' });
    }
  }

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: safeUser(user) });
});

// List children for login screen (public)
router.get('/children', (_req, res) => {
  const children = db.prepare('SELECT id, name, photo, pin_required, color FROM users WHERE role = ?').all('child');
  res.json(children);
});

function safeUser(u) {
  const { password_hash, pin_hash, ...rest } = u;
  return rest;
}

module.exports = router;
