export default function ProgressBar({ value, max, color, label }) {
  const pct = Math.min(100, Math.round((value / max) * 100)) || 0;
  const barColor = color || (pct >= 100 ? '#43A047' : pct >= 75 ? '#F9A825' : '#4F86C6');

  return (
    <div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      {label && (
        <div className="flex justify-between mt-2 text-sm text-muted">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
    </div>
  );
}
