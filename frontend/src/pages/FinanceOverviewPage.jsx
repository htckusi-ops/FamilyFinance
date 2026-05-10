import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/client';

function chf(n) { return `CHF ${Number(n || 0).toFixed(2)}`; }

function SummaryCard({ label, value, sub, color = 'var(--primary)', highlight }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '16px 12px', ...(highlight ? { border: `2px solid ${color}` } : {}) }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
      <div className="text-sm font-semibold mt-1">{label}</div>
      {sub && <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Row({ label, value, sub, muted, positive }) {
  return (
    <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div>
        <div className={`text-sm ${muted ? 'text-muted' : 'font-semibold'}`}>{label}</div>
        {sub && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{sub}</div>}
      </div>
      <div className="font-bold" style={{ color: positive ? 'var(--success)' : muted ? 'var(--muted)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}

export default function FinanceOverviewPage() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    api.get('/finance/overview').then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="page"><div className="text-muted text-center mt-8">Lade Daten…</div></div>;

  const { settings, children, allowance, interest, rewards, points_awarded, transactions } = data;
  const cur = settings.currency || 'CHF';
  const rate = settings.point_value_chf;

  const totalBalance   = children.reduce((s, c) => s + c.balance, 0);
  const totalSavings   = children.reduce((s, c) => s + c.savings_balance, 0);
  const totalPoints    = children.reduce((s, c) => s + c.points_balance, 0);
  const totalPointsChf = children.reduce((s, c) => s + c.points_as_chf, 0);

  const tx = period === 'month' ? transactions.this_month : transactions.this_year;
  const rw = period === 'month' ? rewards.this_month : rewards.this_year;
  const pa = period === 'month' ? points_awarded.this_month : points_awarded.this_year;
  const intPaid = period === 'month' ? interest.paid_this_month : interest.paid_this_year;

  const allowancePaid = tx.allowance?.total || 0;
  const expenses      = Math.abs(tx.expense?.total || 0);
  const fleaIncome    = tx.flea_sale?.total || 0;
  const ptRedeemed    = tx.point_exchange?.total || 0;
  const totalCost     = allowancePaid + rw.chf + pa.chf;

  const hasInterest = children.some(c => c.interest_rate > 0);

  const historyData = transactions.history.map(h => ({
    month: h.month.slice(5),
    Taschengeld: +h.allowance.toFixed(2),
    Ausgaben: +h.expenses.toFixed(2),
    'Punkte (CHF)': +h.points_redeemed.toFixed(2),
    Zinsen: +h.interest.toFixed(2),
    Flohmarkt: +h.flea_income.toFixed(2),
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
        <SummaryCard label="Punkte (als CHF)" value={chf(totalPointsChf)} sub={`${totalPoints} Pkt. × ${cur} ${rate}`} color="var(--accent)" />
        <SummaryCard label="Kosten" value={chf(totalCost)} sub={period === 'month' ? 'Diesen Monat' : 'Dieses Jahr'} color="#ef4444" />
      </div>

      {/* Interest — prominent section */}
      {hasInterest && (
        <div className="card mb-4" style={{ borderLeft: '4px solid #f59e0b', background: 'linear-gradient(135deg,#fffbeb,#fff)' }}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-bold">💹 Zinsen auf Ersparnisse</h2>
              <p className="text-muted text-sm">Jährliche Gutschrift am 1. des Monats</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>{chf(interest.yearly_projected)}</div>
              <div className="text-muted text-sm">Prognose / Jahr</div>
            </div>
          </div>
          {children.filter(c => c.interest_rate > 0).map(c => (
            <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid #fde68a' }}>
              <div className="flex justify-between items-center">
                <span className="font-semibold" style={{ color: c.color || 'var(--primary)' }}>{c.name}</span>
                <span className="font-bold" style={{ color: '#d97706' }}>+ {chf(c.interest_yearly)} / Jahr</span>
              </div>
              <div className="flex gap-3 text-sm text-muted mt-1">
                <span>🐷 {chf(c.savings_balance)} gespart</span>
                <span>× {c.interest_rate}% Zins</span>
                <span>≈ {chf(c.interest_monthly)} / Mt.</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '2px solid #fde68a', display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-sm text-muted">Bereits ausgezahlt {period === 'month' ? 'diesen Monat' : 'dieses Jahr'}</span>
            <span className="font-bold" style={{ color: '#d97706' }}>{chf(intPaid)}</span>
          </div>
        </div>
      )}

      {/* Running costs */}
      <div className="card mb-4">
        <h2 className="font-bold mb-1">💸 Laufende Kosten (Prognose)</h2>
        <p className="text-muted text-sm mb-3">Basierend auf konfigurierten Taschengeld-Beträgen</p>
        {children.map(c => (
          <Row key={c.id}
            label={c.name}
            sub={`${cur} ${c.allowance_amount} / ${c.allowance_interval === 'weekly' ? 'Woche' : 'Monat'}`}
            value={`${cur} ${c.allowance_monthly.toFixed(2)} / Mt.`} />
        ))}
        {hasInterest && (
          <Row label="Zinsen (Prognose)" sub="Auf Ersparnisse aller Kinder"
            value={`+ ${chf(interest.monthly_projected)} / Mt.`} positive />
        )}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid #e0e7ef' }}>
          <div className="flex justify-between">
            <span className="font-bold">Taschengeld / Monat</span>
            <span className="font-bold" style={{ color: '#ef4444' }}>{chf(allowance.monthly_total)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted text-sm">Hochrechnung / Jahr</span>
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
        {hasInterest && intPaid > 0 && (
          <Row label="Zinsen ausbezahlt" value={`+ ${chf(intPaid)}`} positive
            sub="Gutschrift auf Sparkonto" />
        )}
        <Row label="Belohnungen eingelöst"
          sub={`${rw.count}× · ${rw.points} Punkte`}
          value={chf(rw.chf)} />
        <Row label="Punkte vergeben (virtuell)"
          sub={`${pa.points} Punkte × ${cur} ${rate}`}
          value={chf(pa.chf)} muted />
        <Row label="Ausgaben der Kinder" value={chf(expenses)} muted />
        {fleaIncome > 0 && <Row label="Flohmarkt-Erlöse (gutgeschrieben)" value={`+ ${chf(fleaIncome)}`} positive />}
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
            <div className="flex flex-wrap gap-2 text-sm text-muted">
              <span>💳 {chf(c.balance)}</span>
              <span>🐷 {chf(c.savings_balance)}</span>
              <span>⭐ {c.points_balance} Pkt. ({chf(c.points_as_chf)})</span>
              {c.interest_rate > 0 && (
                <span style={{ color: '#d97706', fontWeight: 600 }}>💹 {c.interest_rate}% Zins → +{chf(c.interest_yearly)}/J.</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 12-month bar chart */}
      {historyData.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-bold mb-3">📈 Letzte 12 Monate</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={historyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${cur} ${v.toFixed(2)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Taschengeld" stackId="cost" fill="#4F86C6" />
              <Bar dataKey="Ausgaben"    stackId="cost" fill="#f97316" />
              <Bar dataKey="Punkte (CHF)" stackId="cost" fill="#a78bfa" />
              <Bar dataKey="Zinsen"      stackId="cost" fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="Flohmarkt"  fill="#22c55e" radius={[4,4,4,4]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            <span>🔵 Taschengeld · 🟠 Ausgaben · 🟣 Punkte · 🟡 Zinsen = gestapelt</span>
            <span>🟢 Flohmarkt = Erlöse (separat)</span>
          </div>
        </div>
      )}
    </div>
  );
}
