export default function MediaTimer({ remainingSeconds, totalSeconds, warnSeconds = 120, size = 180, label, userColor }) {
  const R = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * R;

  const clamped = Math.max(0, Math.round(remainingSeconds));
  const fraction = totalSeconds > 0 ? clamped / totalSeconds : 0;
  const offset = C * (1 - fraction);

  const isExpired = clamped <= 0;
  const isWarning = !isExpired && clamped <= warnSeconds;
  const arcColor = isExpired ? '#ef4444' : isWarning ? '#f59e0b' : (userColor || '#22c55e');

  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <style>{`@keyframes ff-blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block' }}>
        {/* Shadow/glow ring */}
        <circle cx={cx} cy={cy} r={R + 4} fill="none" stroke={arcColor} strokeWidth="2" opacity="0.15" />
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e0e7ef" strokeWidth="14" />
        {/* Depleting arc */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={arcColor}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.4s ease' }}
        />
        {/* Center fill */}
        <circle cx={cx} cy={cy} r={R - 8} fill="white" opacity="0.9" />
        {/* Time digits */}
        <text
          x={cx} y={cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight="800"
          fill={isExpired ? '#ef4444' : '#1a1a2e'}
          fontFamily="'Courier New', monospace"
          style={(isWarning || isExpired) ? { animation: 'ff-blink 0.9s ease-in-out infinite' } : {}}
        >
          {mm}:{ss}
        </text>
        {/* Status label inside circle */}
        <text
          x={cx} y={cy + size * 0.22}
          textAnchor="middle"
          fontSize={size * 0.085}
          fill={isExpired ? '#ef4444' : isWarning ? '#f59e0b' : '#94a3b8'}
          fontWeight="600"
        >
          {isExpired ? 'FERTIG' : isWarning ? 'FAST FERTIG' : 'verbleibend'}
        </text>
      </svg>
      {label && (
        <div style={{
          fontWeight: 800, fontSize: '0.95rem',
          background: userColor || '#6366f1',
          color: '#fff',
          borderRadius: 20,
          padding: '3px 14px',
          marginTop: 2,
        }}>{label}</div>
      )}
    </div>
  );
}
