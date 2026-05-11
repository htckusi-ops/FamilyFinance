import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import Avatar from '../components/Avatar';

export default function LoginPage() {
  const { login, childLogin } = useAuth();
  const toast = useToast();
  const [children, setChildren] = useState([]);
  const [parents, setParents] = useState([]);
  const [pinChild, setPinChild] = useState(null);
  const [pin, setPin] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/children').then(r => setChildren(r.data)).catch(() => {});
    api.get('/auth/parents').then(r => setParents(r.data)).catch(() => {});
  }, []);

  async function handleChildClick(child) {
    if (child.pin_required) {
      setPinChild(child);
      setPin('');
    } else {
      try {
        await childLogin(child.id);
      } catch {
        toast('Anmeldung fehlgeschlagen', 'error');
      }
    }
  }

  async function handlePinLogin() {
    setLoading(true);
    try {
      await childLogin(pinChild.id, pin);
    } catch {
      toast('Falscher PIN', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleParentLogin(e) {
    e?.preventDefault();
    setLoading(true);
    try {
      await login(selectedParent.name, password);
    } catch {
      toast('Falsches Passwort', 'error');
    } finally {
      setLoading(false);
    }
  }

  const btnStyle = (color) => ({
    background: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 20,
    border: `3px solid ${color || '#4F86C6'}`,
    minWidth: 90,
    transition: 'transform 0.15s',
  });

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏦</div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>FamilyFinance</h1>
      <p className="text-muted mb-4" style={{ textAlign: 'center' }}>Wer bist du?</p>

      {/* Children */}
      {children.length > 0 && (
        <div style={{ marginBottom: 12, width: '100%', maxWidth: 500 }}>
          <p className="font-semibold mb-3" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kinder</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {children.map(child => (
              <button key={child.id} onClick={() => handleChildClick(child)}
                style={btnStyle(child.color)} className="pop-in">
                <Avatar user={child} size={64} />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{child.name}</span>
                {!!child.pin_required && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>🔒 PIN</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {children.length > 0 && parents.length > 0 && (
        <div style={{ width: '100%', maxWidth: 400, borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
      )}

      {/* Parents */}
      {parents.length > 0 && (
        <div style={{ width: '100%', maxWidth: 500 }}>
          <p className="font-semibold mb-3" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Elternteile</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {parents.map(parent => (
              <button key={parent.id} onClick={() => { setSelectedParent(parent); setPassword(''); }}
                style={{ ...btnStyle(parent.color), opacity: 0.85 }} className="pop-in">
                <Avatar user={parent} size={56} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{parent.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>🔑 Passwort</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Child PIN modal */}
      {pinChild && (
        <div className="modal-overlay" onClick={() => setPinChild(null)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <Avatar user={pinChild} size={72} />
              <h2 className="mt-3">Hallo {pinChild.name}!</h2>
              <p className="text-muted mt-2">Gib deinen PIN ein</p>
            </div>
            <input
              type="number"
              placeholder="PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: 8 }}
              onKeyDown={e => e.key === 'Enter' && handlePinLogin()}
              autoFocus
            />
            <button className="btn-primary w-full mt-3" onClick={handlePinLogin} disabled={loading}>
              {loading ? '...' : 'Los!'}
            </button>
          </div>
        </div>
      )}

      {/* Parent password modal */}
      {selectedParent && (
        <div className="modal-overlay" onClick={() => setSelectedParent(null)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <Avatar user={selectedParent} size={72} />
              <h2 className="mt-3">Hallo {selectedParent.name}!</h2>
              <p className="text-muted mt-2">Gib dein Passwort ein</p>
            </div>
            <form onSubmit={handleParentLogin} className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleParentLogin()}
              />
              <button className="btn-primary w-full" type="submit" disabled={loading}>
                {loading ? '...' : 'Anmelden'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
