import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ParentNav() {
  const { logout } = useAuth();
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span className="icon">🏠</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/allowance">
        <span className="icon">💰</span>
        <span>Taschengeld</span>
      </NavLink>
      <NavLink to="/points">
        <span className="icon">⭐</span>
        <span>Punkte</span>
      </NavLink>
      <NavLink to="/media">
        <span className="icon">📺</span>
        <span>Medienzeit</span>
      </NavLink>
      <NavLink to="/flea">
        <span className="icon">🏷️</span>
        <span>Flohmarkt</span>
      </NavLink>
      <NavLink to="/finance">
        <span className="icon">📊</span>
        <span>Finanzen</span>
      </NavLink>
      <NavLink to="/bath">
        <span className="icon">🛁</span>
        <span>Badespass</span>
      </NavLink>
      <NavLink to="/settings">
        <span className="icon">⚙️</span>
        <span>Einstellungen</span>
      </NavLink>
      <button onClick={logout} style={{ color: '#ef4444' }}>
        <span>👋</span>
        <span>Abmelden</span>
      </button>
    </nav>
  );
}
