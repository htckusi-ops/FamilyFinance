const cron = require('node-cron');
const db = require('../db');
const { createBackup } = require('../services/backup');
const { sendNotification } = require('../services/notify');

// ── Date helpers ──────────────────────────────────────────────────────────────

// Add N months without day-of-month overflow (Jan 31 + 1m → Feb 28, not Mar 2)
function addMonthsUTC(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months, 1);           // set to 1st first
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function nextPayoutDate(interval) {
  const d = new Date();
  if (interval === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7);
  } else {
    return addMonthsUTC(d, 1).toISOString();
  }
  return d.toISOString();
}

function nextInterestDate(interval) {
  const d = new Date();
  switch (interval) {
    case 'weekly':      d.setUTCDate(d.getUTCDate() + 7); return d.toISOString();
    case 'quarterly':   return addMonthsUTC(d, 3).toISOString();
    case 'semi-annual': return addMonthsUTC(d, 6).toISOString();
    case 'annual':      return addMonthsUTC(d, 12).toISOString();
    default:            return addMonthsUTC(d, 1).toISOString(); // monthly
  }
}

// Number of payout periods per year for a given interval
function periodsPerYear(interval) {
  switch (interval) {
    case 'weekly':      return 52;
    case 'quarterly':   return 4;
    case 'semi-annual': return 2;
    case 'annual':      return 1;
    default:            return 12; // monthly
  }
}

// ── Daily at 08:00 UTC: process allowance payouts and interest ────────────────
cron.schedule('0 8 * * *', () => {
  const now = new Date().toISOString();

  // ── Allowance payouts ───────────────────────────────────────────────────────
  const configs = db.prepare(`
    SELECT ac.*, u.name FROM allowance_config ac
    JOIN users u ON ac.user_id = u.id
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

  // ── Interest payouts — triggered by next_interest_at schedule ──────────────
  const interestDue = db.prepare(`
    SELECT a.user_id, a.savings_balance,
           ac.interest_rate, ac.interest_interval
    FROM accounts a
    JOIN allowance_config ac ON ac.user_id = a.user_id
    WHERE ac.interest_rate > 0
      AND a.savings_balance > 0
      AND ac.next_interest_at IS NOT NULL
      AND ac.next_interest_at <= ?
  `).all(now);

  for (const acc of interestDue) {
    const interval = acc.interest_interval || 'monthly';
    // interest_rate is annual %; divide by periods per year for each payout
    const interest = Math.round(
      acc.savings_balance * (acc.interest_rate / 100) / periodsPerYear(interval) * 100
    ) / 100;

    if (interest >= 0.01) {
      db.prepare('UPDATE accounts SET savings_balance=savings_balance+? WHERE user_id=?')
        .run(interest, acc.user_id);
      db.prepare('INSERT INTO transactions (user_id,amount,type,description) VALUES (?,?,?,?)')
        .run(acc.user_id, interest, 'interest', `Zins ${acc.interest_rate}% p.a. (${intervalLabel(interval)})`);
    }

    const next = nextInterestDate(interval);
    db.prepare('UPDATE allowance_config SET next_interest_at=? WHERE user_id=?')
      .run(next, acc.user_id);
  }
}, { timezone: 'UTC' });

function intervalLabel(interval) {
  const map = { weekly: 'wöchentl.', monthly: 'monatl.', quarterly: 'quartalsw.', 'semi-annual': 'halbj.', annual: 'jährl.' };
  return map[interval] || interval;
}

// ── Daily at 03:00 UTC: auto backup ──────────────────────────────────────────
cron.schedule('0 3 * * *', async () => {
  try {
    await createBackup();
    console.log('Auto backup completed');
  } catch (err) {
    console.error('Auto backup failed:', err.message);
  }
}, { timezone: 'UTC' });

console.log('Cron jobs registered');
