import { NavLink } from 'react-router-dom';

export default function ParentNav() {
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
      <NavLink to="/flea">
        <span className="icon">🏷️</span>
        <span>Flohmarkt</span>
      </NavLink>
      <NavLink to="/bath">
        <span className="icon">🛁</span>
        <span>Badespass</span>
      </NavLink>
      <NavLink to="/settings">
        <span className="icon">⚙️</span>
        <span>Einstellungen</span>
      </NavLink>
    </nav>
  );
}
