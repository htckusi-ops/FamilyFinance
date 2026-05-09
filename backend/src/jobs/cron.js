const cron = require('node-cron');
const db = require('../db');
const { createBackup } = require('../services/backup');
const { sendNotification } = require('../services/notify');

// Daily at 08:00: process allowance payouts and interest
cron.schedule('0 8 * * *', () => {
  const now = new Date().toISOString();
  const configs = db.prepare(`
    SELECT ac.*, u.name FROM allowance_config ac
    JOIN users u ON ac.user_id=u.id
    WHERE ac.amount > 0 AND ac.next_payout_at IS NOT NULL AND ac.next_payout_at <= ?
  `).all(now);

  for (const cfg of configs) {
    db.prepare('UPDATE accounts SET balance=balance+? WHERE user_id=?').run(cfg.amount, cfg.user_id);
    db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)')
      .run(cfg.user_id, cfg.amount, 'allowance', 'Automatisches Taschengeld');

    const next = nextPayoutDate(cfg.interval);
    db.prepare('UPDATE allowance_config SET next_payout_at=? WHERE user_id=?').run(next, cfg.user_id);

    sendNotification(cfg.user_id, 'allowance_paid', { amount: cfg.amount });
  }

  // Interest on savings
  const accounts = db.prepare(`
    SELECT a.user_id, a.savings_balance, ac.interest_rate
    FROM accounts a
    JOIN allowance_config ac ON ac.user_id=a.user_id
    WHERE ac.interest_rate > 0 AND a.savings_balance > 0
  `).all();

  // Apply monthly interest (only on 1st of month)
  if (new Date().getDate() === 1) {
    for (const acc of accounts) {
      const interest = acc.savings_balance * (acc.interest_rate / 100);
      if (interest > 0.01) {
        db.prepare('UPDATE accounts SET savings_balance=savings_balance+? WHERE user_id=?')
          .run(interest, acc.user_id);
        db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)')
          .run(acc.user_id, interest, 'interest', `Zins ${acc.interest_rate}%`);
      }
    }
  }
});

// Daily at 03:00: auto backup
cron.schedule('0 3 * * *', async () => {
  try {
    await createBackup();
    console.log('Auto backup completed');
  } catch (err) {
    console.error('Auto backup failed:', err.message);
  }
});

function nextPayoutDate(interval) {
  const d = new Date();
  if (interval === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

console.log('Cron jobs registered');
