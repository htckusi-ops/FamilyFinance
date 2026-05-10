const router = require('express').Router();
const db = require('../db');
const { auth, parentOnly } = require('../middleware/auth');

router.use(auth);

router.get('/overview', parentOnly, (req, res) => {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const thisYear = now.getFullYear().toString();

  const settings = {};
  db.prepare('SELECT key, value FROM family_settings').all().forEach(s => { settings[s.key] = s.value; });
  const rate = parseFloat(settings.point_value_chf || '0.10');

  // Children with balances + allowance config
  const children = db.prepare(`
    SELECT u.id, u.name, u.color, a.balance, a.savings_balance,
           p.balance as points_balance,
           ac.amount as allowance_amount, ac.interval as allowance_interval
    FROM users u
    LEFT JOIN accounts a ON a.user_id = u.id
    LEFT JOIN points p ON p.user_id = u.id
    LEFT JOIN allowance_config ac ON ac.user_id = u.id
    WHERE u.role = 'child'
    ORDER BY u.name
  `).all().map(c => {
    const monthly = !c.allowance_amount ? 0
      : c.allowance_interval === 'weekly' ? c.allowance_amount * 52 / 12
      : c.allowance_amount;
    return {
      id: c.id, name: c.name, color: c.color,
      balance: Math.round((c.balance || 0) * 100) / 100,
      savings_balance: Math.round((c.savings_balance || 0) * 100) / 100,
      points_balance: c.points_balance || 0,
      points_as_chf: Math.round((c.points_balance || 0) * rate * 100) / 100,
      allowance_amount: c.allowance_amount || 0,
      allowance_interval: c.allowance_interval || 'monthly',
      allowance_monthly: Math.round(monthly * 100) / 100,
    };
  });

  const allowanceMonthly = children.reduce((s, c) => s + c.allowance_monthly, 0);

  // Approved rewards cost
  const rwRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', rc.approved_at) = ? THEN r.points_required ELSE 0 END), 0) as pts_month,
      COALESCE(SUM(CASE WHEN strftime('%Y',    rc.approved_at) = ? THEN r.points_required ELSE 0 END), 0) as pts_year,
      COUNT(CASE WHEN strftime('%Y-%m', rc.approved_at) = ? THEN 1 END) as cnt_month,
      COUNT(CASE WHEN strftime('%Y',    rc.approved_at) = ? THEN 1 END) as cnt_year
    FROM reward_claims rc JOIN rewards r ON rc.reward_id = r.id
    WHERE rc.status = 'approved'
  `).get(thisMonth, thisYear, thisMonth, thisYear);

  // Points awarded (positive delta = parent awarded)
  const ptRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = ? AND delta > 0 THEN delta ELSE 0 END), 0) as pts_month,
      COALESCE(SUM(CASE WHEN strftime('%Y',    created_at) = ? AND delta > 0 THEN delta ELSE 0 END), 0) as pts_year
    FROM point_events
  `).get(thisMonth, thisYear);

  // Transactions per type, this month + this year
  const toMap = rows => {
    const m = {};
    rows.forEach(r => { m[r.type] = { total: Math.round(r.total * 100) / 100, count: r.count }; });
    return m;
  };
  const txMonth = toMap(db.prepare(`
    SELECT type, SUM(amount) as total, COUNT(*) as count
    FROM transactions WHERE strftime('%Y-%m', created_at) = ? GROUP BY type
  `).all(thisMonth));
  const txYear = toMap(db.prepare(`
    SELECT type, SUM(amount) as total, COUNT(*) as count
    FROM transactions WHERE strftime('%Y', created_at) = ? GROUP BY type
  `).all(thisYear));

  // Last 12 months history (for bar chart)
  const history = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
      COALESCE(SUM(CASE WHEN type='allowance' AND amount > 0 THEN amount END), 0) as allowance,
      COALESCE(SUM(CASE WHEN type='expense'   THEN ABS(amount) END), 0) as expenses,
      COALESCE(SUM(CASE WHEN type='flea_sale' AND amount > 0 THEN amount END), 0) as flea_income,
      COALESCE(SUM(CASE WHEN type='point_exchange' AND amount > 0 THEN amount END), 0) as points_redeemed
    FROM transactions
    WHERE created_at >= date('now', '-12 months')
    GROUP BY month ORDER BY month ASC
  `).all();

  res.json({
    settings: { point_value_chf: rate, currency: settings.currency || 'CHF' },
    children,
    allowance: {
      monthly_total: Math.round(allowanceMonthly * 100) / 100,
      yearly_total: Math.round(allowanceMonthly * 12 * 100) / 100,
    },
    rewards: {
      this_month: { count: rwRow.cnt_month, points: rwRow.pts_month, chf: Math.round(rwRow.pts_month * rate * 100) / 100 },
      this_year:  { count: rwRow.cnt_year,  points: rwRow.pts_year,  chf: Math.round(rwRow.pts_year  * rate * 100) / 100 },
    },
    points_awarded: {
      this_month: { points: ptRow.pts_month, chf: Math.round(ptRow.pts_month * rate * 100) / 100 },
      this_year:  { points: ptRow.pts_year,  chf: Math.round(ptRow.pts_year  * rate * 100) / 100 },
    },
    transactions: { this_month: txMonth, this_year: txYear, history },
  });
});

module.exports = router;
