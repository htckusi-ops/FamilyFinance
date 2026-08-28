const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');

router.use(auth);

// Get current status: participants, turn, history
router.get('/status', (req, res) => {
  const participants = db.prepare(`
    SELECT u.id, u.name, u.photo, u.color
    FROM bath_participants bp
    JOIN users u ON bp.user_id = u.id
    ORDER BY u.name
  `).all();

  const turns = db.prepare(
    'SELECT bt.*, u.name FROM bath_turns bt JOIN users u ON bt.user_id=u.id ORDER BY bt.created_at DESC LIMIT 30'
  ).all();

  const next = getNextTurn(participants, turns);

  // Count per participant
  const counts = {};
  for (const p of participants) counts[p.id] = 0;
  for (const t of turns) if (counts[t.user_id] !== undefined) counts[t.user_id]++;

  res.json({ participants, turns, next, counts });
});

// Record a bath turn
router.post('/record', parentOnly, (req, res) => {
  const { user_id, bath_date } = req.body;
  const date = bath_date || new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO bath_turns (user_id, bath_date) VALUES (?,?)').run(Number(user_id), date);
  res.json({ ok: true });
});

// Delete last turn (undo)
router.delete('/last', parentOnly, (_req, res) => {
  const last = db.prepare('SELECT id FROM bath_turns ORDER BY created_at DESC LIMIT 1').get();
  if (last) db.prepare('DELETE FROM bath_turns WHERE id=?').run(last.id);
  res.json({ ok: true });
});

// Set participants
router.put('/participants', parentOnly, (req, res) => {
  const { user_ids } = req.body;
  db.prepare('DELETE FROM bath_participants').run();
  const ins = db.prepare('INSERT INTO bath_participants (user_id) VALUES (?)');
  const insertAll = db.transaction(ids => { for (const id of ids) ins.run(Number(id)); });
  insertAll(user_ids || []);
  res.json({ ok: true });
});

function getNextTurn(participants, turns) {
  if (participants.length === 0) return null;
  if (participants.length === 1) return participants[0];

  const counts = {};
  const lastSeen = {};
  for (const p of participants) { counts[p.id] = 0; lastSeen[p.id] = null; }

  // Process turns oldest-first for lastSeen tracking
  for (const t of [...turns].reverse()) {
    if (counts[t.user_id] !== undefined) {
      counts[t.user_id]++;
      lastSeen[t.user_id] = t.created_at;
    }
  }

  const minCount = Math.min(...participants.map(p => counts[p.id]));
  const candidates = participants.filter(p => counts[p.id] === minCount);

  if (candidates.length === 1) return candidates[0];

  // Tiebreak: who chose longest ago (null = never → highest priority)
  candidates.sort((a, b) => {
    if (!lastSeen[a.id]) return -1;
    if (!lastSeen[b.id]) return 1;
    return lastSeen[a.id].localeCompare(lastSeen[b.id]);
  });
  return candidates[0];
}

module.exports = router;
