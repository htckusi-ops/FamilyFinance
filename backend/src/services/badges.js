const db = require('../db');

function checkBadge(userId, key) {
  try {
    const badge = db.prepare('SELECT id FROM badges WHERE key=?').get(key);
    if (!badge) return;
    db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?,?)').run(userId, badge.id);
  } catch {}
}

function checkJobBadges(userId) {
  const count = db.prepare(
    "SELECT COUNT(*) as c FROM point_events WHERE user_id=? AND mini_job_id IS NOT NULL"
  ).get(userId).c;
  if (count >= 1)  checkBadge(userId, 'first_job');
  if (count >= 5)  checkBadge(userId, 'five_jobs');
  if (count >= 20) checkBadge(userId, 'twenty_jobs');
}

function checkStreakBadges(userId) {
  const p = db.prepare('SELECT streak_weeks FROM points WHERE user_id=?').get(userId);
  if (!p) return;
  if (p.streak_weeks >= 2) checkBadge(userId, 'streak_2');
  if (p.streak_weeks >= 4) checkBadge(userId, 'streak_4');
}

module.exports = { checkBadge, checkJobBadges, checkStreakBadges };
