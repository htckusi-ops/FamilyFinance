function nextBirthday(birthdate) {
  if (!birthdate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = birthdate.split('-').map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next <= today) next = new Date(today.getFullYear() + 1, m - 1, d);
  const diffMs = next - today;
  const days = Math.round(diffMs / 86400000);
  const age = next.getFullYear() - y;
  return { date: next, days, age };
}

const FILL = 'linear-gradient(to right, #6366f1, #818cf8)';
const FILL_V = 'linear-gradient(to bottom, #6366f1, #818cf8)';
const GREEN = '#22c55e';
const BLUE = '#6366f1';
const GREY = '#e0e7ef';

function Dot({ color, size = 22, shadow }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, border: '3px solid #fff',
      flexShrink: 0, zIndex: 2,
      boxShadow: shadow ? `0 0 0 4px ${color}33, 0 2px 8px #0003` : '0 1px 4px #0002',
    }} />
  );
}

function Connector({ filled, minHeight = 16 }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 4, minHeight, borderRadius: 4, flex: 1,
          background: filled ? FILL_V : GREY,
        }} />
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
}

// Single reward card — used inside a tier
function RewardCard({ r, state, points, compact = false }) {
  const reached = state === 'achieved';
  const isNext  = state === 'next';

  const progressPct = reached ? 100 : Math.min(99, Math.round((points / r.points_required) * 100));
  const remaining   = Math.max(0, r.points_required - points);

  const bg      = reached ? '#f0fff4' : isNext ? '#eef2ff' : '#f8faff';
  const border  = reached ? '#86efac' : isNext ? '#a5b4fc' : '#e0e7ef';
  const tagBg   = reached ? '#dcfce7' : isNext ? '#e0e7ff' : '#f1f5f9';
  const tagCol  = reached ? '#16a34a' : isNext ? '#4338ca' : '#94a3b8';
  const barBg   = reached ? '#bbf7d0' : isNext ? '#c7d2fe' : '#e0e7ef';
  const barFill = reached ? GREEN     : isNext ? FILL      : '#94a3b8';

  return (
    <div style={{
      flex: compact ? '1 1 140px' : 1,
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 12,
      padding: compact ? '8px 10px' : '10px 14px',
    }}>
      {/* Name + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: compact ? '0.8rem' : '0.9rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.image && <span style={{ marginRight: 4 }}>{r.image}</span>}{r.name}
        </div>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
          padding: '2px 7px', borderRadius: 20,
          background: tagBg, color: tagCol,
          flexShrink: 0,
        }}>
          {r.points_required} ⭐
        </span>
      </div>

      {/* Progress bar — always visible */}
      <div style={{ marginTop: 6, height: 5, background: barBg, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: barFill,
          width: `${progressPct}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Status text */}
      <div style={{ fontSize: '0.72rem', fontWeight: 600, marginTop: 4, color: tagCol }}>
        {reached
          ? '✅ Erreicht!'
          : isNext
            ? `Noch ${remaining} Punkte · ${progressPct}%`
            : `${progressPct}% · noch ${remaining} Punkte`}
      </div>
    </div>
  );
}

// A tier groups rewards with the same points_required
function TierRow({ tier, state, points }) {
  const reached = state === 'achieved';
  const isNext  = state === 'next';
  const dotColor = reached ? GREEN : isNext ? BLUE : GREY;
  const compact  = tier.rewards.length > 1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 24, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
        <Dot color={dotColor} shadow={isNext} />
      </div>
      <div style={{ flex: 1, marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tier.rewards.map(r => (
          <RewardCard key={r.id} r={r} state={state} points={points} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export default function PointsTimeline({ points = 0, rewards = [], birthdate = null }) {
  const bday = nextBirthday(birthdate);

  // Sort and group into tiers by points_required
  const sorted = [...rewards].sort((a, b) => a.points_required - b.points_required);
  if (sorted.length === 0 && !bday) return null;

  const tiers = [];
  for (const r of sorted) {
    const last = tiers[tiers.length - 1];
    if (last && last.points === r.points_required) {
      last.rewards.push(r);
    } else {
      tiers.push({ points: r.points_required, rewards: [r] });
    }
  }

  const achievedTiers = tiers.filter(t => points >= t.points);
  const upcomingTiers = tiers.filter(t => points <  t.points);

  return (
    <div style={{ padding: '4px 0' }}>

      {/* Achieved tiers */}
      {achievedTiers.map((tier, i) => (
        <div key={tier.points + '-' + i}>
          <TierRow tier={tier} state="achieved" points={points} />
          <Connector filled={true} minHeight={16} />
        </div>
      ))}

      {/* Current position marker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--accent, #f59e0b)',
            border: '3px solid #fff',
            boxShadow: '0 0 0 4px #f59e0b33, 0 2px 8px #0003',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', zIndex: 2, flexShrink: 0,
          }}>⭐</div>
        </div>
        <div style={{
          background: 'var(--accent, #f59e0b)', color: '#fff',
          borderRadius: 20, padding: '5px 14px',
          fontWeight: 800, fontSize: '0.85rem', whiteSpace: 'nowrap',
        }}>
          {points} Punkte
        </div>
      </div>

      {/* Connector to first upcoming */}
      {(upcomingTiers.length > 0 || bday) && <Connector filled={false} minHeight={16} />}

      {/* Upcoming tiers */}
      {upcomingTiers.map((tier, i) => (
        <div key={tier.points + '-' + i}>
          <TierRow tier={tier} state={i === 0 ? 'next' : 'future'} points={points} />
          {(i < upcomingTiers.length - 1 || bday) && <Connector filled={false} minHeight={16} />}
        </div>
      ))}

      {/* Birthday milestone */}
      {bday && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#f472b6', border: '3px solid #fff',
              boxShadow: '0 0 0 3px #f472b644, 0 1px 4px #0002',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', flexShrink: 0, zIndex: 2,
            }}>🎂</div>
          </div>
          <div style={{
            flex: 1, marginBottom: 4,
            background: 'linear-gradient(135deg, #fff0f8, #fce7f3)',
            border: '1.5px solid #f9a8d4',
            borderRadius: 12,
            padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                🎂 {bday.age}. Geburtstag!
              </div>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
                padding: '2px 8px', borderRadius: 20,
                background: '#fce7f3', color: '#be185d',
              }}>
                {bday.date.toLocaleDateString('de-CH', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#be185d', fontWeight: 600, marginTop: 4 }}>
              {bday.days === 0 ? '🎉 Heute!' : bday.days === 1 ? 'Morgen!' : `Noch ${bday.days} Tage`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
