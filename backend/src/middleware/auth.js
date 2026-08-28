const jwt = require('jsonwebtoken');
const db = require('../db');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];

  // Try long-lived API token first
  if (token && token.startsWith('ff_')) {
    const row = db.prepare('SELECT * FROM api_tokens WHERE token=?').get(token);
    if (!row) return res.status(401).json({ error: 'Invalid API token' });
    db.prepare("UPDATE api_tokens SET last_used_at=datetime('now') WHERE id=?").run(row.id);
    const creator = db.prepare('SELECT id, name, role FROM users WHERE id=?').get(row.created_by);
    req.user = { ...creator, api_token: true };
    return next();
  }

  // Fall back to JWT
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
  next();
}

module.exports = { auth, parentOnly };
