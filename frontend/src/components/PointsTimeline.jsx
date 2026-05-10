export default function PointsTimeline({ points = 0, rewards = [] }) {
  const sorted = [...rewards].sort((a, b) => a.points_required - b.points_required);
  const maxVal = Math.max(...sorted.map(r => r.points_required), points, 1) * 1.15;

  const pct = val => Math.min(100, (val / maxVal) * 100);
  const currentPct = pct(points);

  if (sorted.length === 0) return null;

  return (
    <div style={{ position: 'relative', padding: '16px 0 16px 52px', minHeight: 200 }}>
      {/* Track */}
      <div style={{
        position: 'absolute', left: 20, top: 0, bottom: 0, width: 10,
        background: '#e0e7ef', borderRadius: 10,
      }}>
        {/* Fill up to current */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${currentPct}%`,
          background: 'linear-gradient(to top, var(--accent), var(--primary))',
          borderRadius: 10, transition: 'height 0.6s ease',
        }} />
      </div>

      {/* Current position marker */}
      <div style={{
        position: 'absolute',
        left: 10,
        bottom: `calc(${currentPct}% - 14px)`,
        width: 30, height: 30,
        background: 'var(--accent)',
        borderRadius: '50%',
        border: '3px solid #fff',
        boxShadow: '0 0 0 4px var(--accent)33, 0 2px 8px #0003',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.65rem', fontWeight: 800, color: '#fff',
        zIndex: 10,
        transition: 'bottom 0.6s ease',
      }}>
        ⭐
      </div>

      {/* Current points label */}
      <div style={{
        position: 'absolute',
        left: 46,
        bottom: `calc(${currentPct}% - 10px)`,
        background: 'var(--accent)',
        color: '#fff',
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: '0.8rem',
        fontWeight: 800,
        whiteSpace: 'nowrap',
        zIndex: 10,
      }}>
        {points} Punkte
      </div>

      {/* Reward milestones */}
      {sorted.map(r => {
        const rPct = pct(r.points_required);
        const reached = points >= r.points_required;
        const isNext = !reached && sorted.filter(x => x.points_required > points)[0]?.id === r.id;
        return (
          <div key={r.id} style={{
            position: 'absolute',
            left: 46,
            bottom: `calc(${rPct}% - 20px)`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {/* Tick mark */}
            <div style={{
              position: 'absolute',
              left: -34,
              width: 18, height: 18,
              borderRadius: '50%',
              background: reached ? 'var(--success)' : isNext ? 'var(--primary)' : '#c8d6e5',
              border: '2px solid #fff',
              boxShadow: isNext ? '0 0 0 3px var(--primary)44' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', color: '#fff', fontWeight: 800,
            }}>
              {reached ? '✓' : ''}
            </div>

            {/* Reward card */}
            <div style={{
              background: reached ? '#f0fff4' : isNext ? '#f0f4ff' : '#f8faff',
              border: `1.5px solid ${reached ? 'var(--success)' : isNext ? 'var(--primary)' : '#e0e7ef'}`,
              borderRadius: 12,
              padding: '6px 12px',
              minWidth: 160,
              opacity: reached ? 0.8 : 1,
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {r.image && <span>{r.image} </span>}{r.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: reached ? 'var(--success)' : isNext ? 'var(--primary)' : 'var(--muted)', fontWeight: 600 }}>
                {reached ? '✅ Erreicht!' : isNext
                  ? `Noch ${r.points_required - points} Punkte`
                  : `${r.points_required} ⭐`}
              </div>
            </div>
          </div>
        );
      })}

      {/* Spacer so items don't overlap bottom */}
      <div style={{ height: Math.max(...sorted.map(r => pct(r.points_required))) + '%' }} />
    </div>
  );
}
