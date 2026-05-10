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
      <NavLink to="/bath">
        <span className="icon">🛁</span>
        <span>Badespass</span>
      </NavLink>
      <button onClick={logout} style={{ color: '#ef4444' }}>
        <span>👋</span>
        <span>Abmelden</span>
      </button>
    </nav>
  );
}
