import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ChildNav() {
  const { logout } = useAuth();
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span className="icon">🏠</span>
        <span>Mein Dashboard</span>
      </NavLink>
      <NavLink to="/points">
        <span className="icon">⭐</span>
        <span>Punkte</span>
      </NavLink>
      <NavLink to="/flea">
        <span className="icon">🏷️</span>
        <span>Flohmarkt</span>
      </NavLink>
      <button onClick={logout} style={{ background: 'none', color: '#6b7280', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 12px', borderRadius: 10 }}>
        <span style={{ fontSize: '1.4rem' }}>👋</span>
        <span>Abmelden</span>
      </button>
    </nav>
  );
}
