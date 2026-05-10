import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/client';

function chf(n) { return `CHF ${Number(n || 0).toFixed(2)}`; }

function SummaryCard({ label, value, sub, color = 'var(--primary)' }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
      <div className="text-sm font-semibold mt-1">{label}</div>
      {sub && <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Row({ label, value, sub, muted }) {
  return (
    <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div>
        <div className={`text-sm ${muted ? 'text-muted' : 'font-semibold'}`}>{label}</div>
        {sub && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{sub}</div>}
      </div>
      <div className="font-bold" style={{ color: muted ? 'var(--muted)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}

export default function FinanceOverviewPage() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month'); // 'month' | 'year'

  useEffect(() => {
    api.get('/finance/overview').then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="page"><div className="text-muted text-center mt-8">Lade Daten…</div></div>;

  const { settings, children, allowance, rewards, points_awarded, transactions } = data;
  const cur = settings.currency || 'CHF';
  const rate = settings.point_value_chf;

  const totalBalance = children.reduce((s, c) => s + c.balance, 0);
  const totalSavings = children.reduce((s, c) => s + c.savings_balance, 0);
  const totalPoints  = children.reduce((s, c) => s + c.points_balance, 0);
  const totalPointsChf = children.reduce((s, c) => s + c.points_as_chf, 0);

  const tx = period === 'month' ? transactions.this_month : transactions.this_year;
  const rw = period === 'month' ? rewards.this_month : rewards.this_year;
  const pa = period === 'month' ? points_awarded.this_month : points_awarded.this_year;

  const allowancePaid = tx.allowance?.total || 0;
  const expenses      = Math.abs(tx.expense?.total || 0);
  const fleaIncome    = tx.flea_sale?.total || 0;
  const ptRedeemed    = tx.point_exchange?.total || 0;

  // Total cost = allowance paid + rewards (in CHF) + points awarded as CHF
  const totalCost = allowancePaid + rw.chf + pa.chf;

  // Format history for recharts
  const historyData = transactions.history.map(h => ({
    month: h.month.slice(5), // "05"
    Taschengeld: +h.allowance.toFixed(2),
    Ausgaben: +h.expenses.toFixed(2),
    Flohmarkt: +h.flea_income.toFixed(2),
    'Punkte (CHF)': +h.points_redeemed.toFixed(2),
  }));

  return (
    <div className="page">
      <h1 className="page-title">📊 Finanzübersicht</h1>

      {/* Period toggle */}
      <div className="flex gap-2 mb-5">
        {[['month', 'Dieser Monat'], ['year', 'Dieses Jahr']].map(([val, label]) => (
          <button key={val} onClick={() => setPeriod(val)}
            style={{ flex: 1, padding: '9px', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem',
              background: period === val ? 'var(--primary)' : '#e0e7ef',
              color: period === val ? '#fff' : 'var(--text)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid-2 gap-3 mb-4">
        <SummaryCard label="Gesamtguthaben" value={chf(totalBalance)} sub="Verfügbar aller Kinder" color="var(--primary)" />
        <SummaryCard label="Ersparnisse" value={chf(totalSavings)} sub="Gespart aller Kinder" color="var(--success)" />
        <SummaryCard label="Punkte (als CHF)" value={chf(totalPointsChf)} sub={`${totalPoints} Punkte × ${cur} ${rate}`} color="var(--accent)" />
        <SummaryCard label="Gesamtkosten" value={chf(totalCost)} sub={period === 'month' ? 'Diesen Monat' : 'Dieses Jahr'} color="#ef4444" />
      </div>

      {/* Running costs */}
      <div className="card mb-4">
        <h2 className="font-bold mb-1">💸 Laufende Kosten (Prognose)</h2>
        <p className="text-muted text-sm mb-3">Basierend auf den konfigurierten Taschengeld-Beträgen</p>
        {children.map(c => (
          <Row key={c.id}
            label={c.name}
            sub={`${cur} ${c.allowance_amount} / ${c.allowance_interval === 'weekly' ? 'Woche' : 'Monat'}`}
            value={`${cur} ${c.allowance_monthly.toFixed(2)} / Mt.`} />
        ))}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid #e0e7ef' }}>
          <div className="flex justify-between">
            <span className="font-bold">Total pro Monat</span>
            <span className="font-bold" style={{ color: '#ef4444' }}>{chf(allowance.monthly_total)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted text-sm">Hochrechnung pro Jahr</span>
            <span className="font-semibold text-sm">{chf(allowance.yearly_total)}</span>
          </div>
        </div>
      </div>

      {/* Period breakdown */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">
          {period === 'month' ? '📅 Diesen Monat' : '📆 Dieses Jahr'} — Kosten & Erlöse
        </h2>
        <Row label="Taschengeld ausbezahlt" value={chf(allowancePaid)} />
        <Row label="Belohnungen eingelöst"
          sub={`${rw.count}× · ${rw.points} Punkte`}
          value={chf(rw.chf)} />
        <Row label="Punkte vergeben (virtuell)"
          sub={`${pa.points} Punkte × ${cur} ${rate}`}
          value={chf(pa.chf)} muted />
        <Row label="Ausgaben der Kinder" value={chf(expenses)} muted />
        {fleaIncome > 0 && <Row label="Flohmarkt-Erlöse (gutgeschrieben)" value={`+ ${chf(fleaIncome)}`} />}
        {ptRedeemed > 0 && <Row label="Punkte → CHF eingelöst" value={`+ ${chf(ptRedeemed)}`} muted />}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid #e0e7ef' }}>
          <div className="flex justify-between">
            <span className="font-bold">Kosten gesamt</span>
            <span className="font-bold" style={{ color: '#ef4444' }}>{chf(totalCost)}</span>
          </div>
        </div>
      </div>

      {/* Per-child breakdown */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">👧👦 Pro Kind — aktueller Stand</h2>
        {children.map(c => (
          <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold" style={{ color: c.color || 'var(--primary)' }}>{c.name}</span>
              <span className="font-semibold">{chf(c.balance + c.savings_balance + c.points_as_chf)}</span>
            </div>
            <div className="flex gap-3 text-sm text-muted">
              <span>💳 {chf(c.balance)}</span>
              <span>🐷 {chf(c.savings_balance)}</span>
              <span>⭐ {c.points_balance} Pkt. ({chf(c.points_as_chf)})</span>
            </div>
          </div>
        ))}
      </div>

      {/* 12-month bar chart */}
      {historyData.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-bold mb-3">📈 Letzte 12 Monate</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={historyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${cur} ${v.toFixed(2)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Taschengeld" stackId="cost" fill="#4F86C6" radius={[0,0,0,0]} />
              <Bar dataKey="Ausgaben"    stackId="cost" fill="#f97316" radius={[0,0,0,0]} />
              <Bar dataKey="Punkte (CHF)" stackId="cost" fill="#a78bfa" radius={[4,4,0,0]} />
              <Bar dataKey="Flohmarkt"  fill="#22c55e" radius={[4,4,4,4]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted">
            <span>🔵 Taschengeld + 🟠 Ausgaben + 🟣 Punkte = Kosten</span>
            <span>🟢 Flohmarkt = Erlöse der Kinder</span>
          </div>
        </div>
      )}
    </div>
  );
}
