import { createContext, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, resolve }
  const resolveRef = useRef(null);

  function confirm(message) {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ message });
    });
  }

  function respond(yes) {
    setState(null);
    resolveRef.current?.(yes);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-sheet slide-up" style={{ maxWidth: 340 }}>
            <div style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: 8 }}>🗑️</div>
            <p style={{ textAlign: 'center', marginBottom: 20, color: '#374151', lineHeight: 1.4 }}>
              {state.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => respond(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '0.95rem' }}>
                Abbrechen
              </button>
              <button
                onClick={() => respond(true)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
