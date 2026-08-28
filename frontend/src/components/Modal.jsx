export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet slide-up">
        <div className="flex justify-between items-center mb-3">
          <h2 className="modal-title" style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', fontSize: '1.4rem', color: '#6b7280' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
