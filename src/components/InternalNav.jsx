import { NavLink } from 'react-router-dom';

export default function InternalNav() {
  return (
    <nav className="panel internal-nav" aria-label="Navegación interna">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `internal-nav__link ${isActive ? 'internal-nav__link--active' : ''}`}
      >
        Directorio
      </NavLink>
      <NavLink
        to="/scraper-control"
        className={({ isActive }) => `internal-nav__link ${isActive ? 'internal-nav__link--active' : ''}`}
      >
        Control de Scraper
      </NavLink>
    </nav>
  );
}
