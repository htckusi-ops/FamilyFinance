const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
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
