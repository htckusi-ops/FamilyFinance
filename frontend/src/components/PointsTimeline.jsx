export default function PointsTimeline({ points = 0, rewards = [] }) {
  const sorted = [...rewards].sort((a, b) => a.points_required - b.points_required);
  if (sorted.length === 0) return null;

  // Build ordered list: milestones interspersed with the current-position marker
  const achieved = sorted.filter(r => points >= r.points_required);
  const upcoming = sorted.filter(r => points < r.points_required);
  const next = upcoming[0] ?? null;

  // Track colour for the filled portion
  const FILL = 'linear-gradient(to bottom, #6366f1, #818cf8)';
  const GREY = '#e0e7ef';
  const GREEN = '#22c55e';
  const BLUE = '#6366f1';

  function Dot({ color, size = 20, border = '#fff', shadow }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color, border: `3px solid ${border}`,
        flexShrink: 0, zIndex: 2,
        boxShadow: shadow ? `0 0 0 4px ${color}33, 0 2px 8px #0003` : '0 1px 4px #0002',
      }} />
    );
  }

  function TrackLine({ filled, flex = 1 }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex, minHeight: 24 }}>
        <div style={{
          width: 4, flex: 1, borderRadius: 4,
          background: filled ? FILL : GREY,
          minHeight: 24,
        }} />
      </div>
    );
  }

  function MilestoneRow({ r, state }) {
    // state: 'achieved' | 'next' | 'future'
    const reached = state === 'achieved';
    const isNext = state === 'next';
    const dotColor = reached ? GREEN : isNext ? BLUE : GREY;
    const remaining = r.points_required - points;
    const progressPct = isNext ? Math.min(100, Math.round((points / r.points_required) * 100)) : 0;

    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Dot */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
          <Dot color={dotColor} size={22} shadow={isNext} />
        </div>

        {/* Card */}
        <div style={{
          flex: 1, marginBottom: 4,
          background: reached ? '#f0fff4' : isNext ? '#eef2ff' : '#f8faff',
          border: `1.5px solid ${reached ? '#86efac' : isNext ? '#a5b4fc' : '#e0e7ef'}`,
          borderRadius: 12,
          padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {r.image && <span style={{ marginRight: 5 }}>{r.image}</span>}{r.name}
            </div>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', padding: '2px 8px',
              borderRadius: 20,
              background: reached ? '#dcfce7' : isNext ? '#e0e7ff' : '#f1f5f9',
              color: reached ? '#16a34a' : isNext ? '#4338ca' : '#94a3b8',
            }}>
              {r.points_required} ⭐
            </span>
          </div>

          {reached && (
            <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: 4 }}>✅ Erreicht!</div>
          )}

          {isNext && (
            <>
              <div style={{ fontSize: '0.75rem', color: '#4338ca', fontWeight: 600, marginTop: 4 }}>
                Noch {remaining} Punkte
              </div>
              <div style={{ marginTop: 6, height: 6, background: '#c7d2fe', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: FILL,
                  width: `${progressPct}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Achieved milestones (bottom → current) */}
      {achieved.map((r, i) => (
        <div key={r.id}>
          <MilestoneRow r={r} state="achieved" />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 4, background: i < achieved.length - 1 || next ? FILL : GREY, flex: 1, minHeight: 16, borderRadius: 4 }} />
            </div>
            <div style={{ flex: 1 }} />
          </div>
        </div>
      ))}

      {/* Current position marker — always between achieved and next */}
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

      {/* Connector from current to next */}
      {next && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 4, background: GREY, minHeight: 16, borderRadius: 4 }} />
          </div>
          <div style={{ flex: 1 }} />
        </div>
      )}

      {/* Upcoming milestones */}
      {upcoming.map((r, i) => (
        <div key={r.id}>
          <MilestoneRow r={r} state={i === 0 ? 'next' : 'future'} />
          {i < upcoming.length - 1 && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 4, background: GREY, minHeight: 16, borderRadius: 4 }} />
              </div>
              <div style={{ flex: 1 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
