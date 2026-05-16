// Format seconds → H:MM when scale is ≥ 1 h, else MM:SS
function fmt(sec, useHM) {
  if (useHM) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  }
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function MediaTimer({ remainingSeconds, totalSeconds, warnSeconds = 120, size = 180, label, userColor }) {
  const R = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * R;

  // Use H:MM format when the scale is ≥ 1 hour (budget clocks); MM:SS for short sessions
  const useHM = totalSeconds >= 3600;

  const isOvertime = remainingSeconds < 0;
  const overSeconds = isOvertime ? Math.round(Math.abs(remainingSeconds)) : 0;
  const clamped    = isOvertime ? 0 : Math.max(0, Math.round(remainingSeconds));

  const isExpired = !isOvertime && clamped === 0;
  const isWarning = !isOvertime && !isExpired && warnSeconds > 0 && clamped <= warnSeconds;

  // Normal depleting arc
  const normalOffset = C * (1 - (totalSeconds > 0 ? clamped / totalSeconds : 0));
  // Overtime filling arc (grows from 0)
  const overFraction = isOvertime && totalSeconds > 0 ? Math.min(1, overSeconds / totalSeconds) : 0;
  const overOffset   = C * (1 - overFraction);

  const arcColor  = isOvertime || isExpired ? '#ef4444' : isWarning ? '#f59e0b' : (userColor || '#22c55e');
  const textColor = isOvertime || isExpired ? '#ef4444' : '#1a1a2e';

  const displaySecs = isOvertime ? overSeconds : clamped;
  const timeText = isOvertime ? `+${fmt(displaySecs, useHM)}` : fmt(displaySecs, useHM);

  const statusLabel = isOvertime ? 'ÜBERZEIT'
    : isExpired   ? 'FERTIG'
    : isWarning   ? 'FAST FERTIG'
    : useHM       ? 'h:mm'
    : 'verbleibend';
  const statusColor = isOvertime || isExpired ? '#ef4444' : isWarning ? '#f59e0b' : '#94a3b8';
  const shouldBlink = isWarning || isExpired || isOvertime;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <style>{`@keyframes ff-blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block' }}>
        {/* Glow ring */}
        <circle cx={cx} cy={cy} r={R + 4} fill="none" stroke={arcColor} strokeWidth="2" opacity="0.15" />
        {/* Background track — red-tinted when overtime */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={isOvertime ? '#fee2e2' : '#e0e7ef'} strokeWidth="14" />
        {/* Arc — depletes normally, fills red on overtime */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={isOvertime ? '#ef4444' : arcColor}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={isOvertime ? overOffset : normalOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.4s ease' }}
        />
        {/* White inner disc */}
        <circle cx={cx} cy={cy} r={R - 8} fill="white" opacity="0.9" />
        {/* Time digits */}
        <text
          x={cx} y={cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={isOvertime ? size * 0.185 : size * 0.22}
          fontWeight="800"
          fill={textColor}
          fontFamily="'Courier New', monospace"
          style={shouldBlink ? { animation: 'ff-blink 0.9s ease-in-out infinite' } : {}}
        >
          {timeText}
        </text>
        {/* Status / unit label */}
        {size >= 100 && (
          <text
            x={cx} y={cy + size * 0.22}
            textAnchor="middle"
            fontSize={size * 0.085}
            fill={statusColor}
            fontWeight="600"
          >
            {statusLabel}
          </text>
        )}
      </svg>
      {label && (
        <div style={{
          fontWeight: 800, fontSize: '0.95rem',
          background: isOvertime ? '#ef4444' : (userColor || '#6366f1'),
          color: '#fff',
          borderRadius: 20,
          padding: '3px 14px',
          marginTop: 2,
        }}>{label}</div>
      )}
    </div>
  );
}
