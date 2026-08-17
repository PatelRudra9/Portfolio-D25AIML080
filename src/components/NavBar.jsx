import { NavLink } from 'react-router-dom';

function NavBar({ isLightMode, onToggleTheme }) {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <span className="navbar-logo">RP</span>
                <span className="navbar-name">Rudra Patel</span>
            </div>
            <ul className="navbar-links">
                <li>
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        🏠 Home
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/projects"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        🚀 Projects
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/tasks"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        📋 Tasks API
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/contact"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                    >
                        📬 Contact
                    </NavLink>
                </li>
            </ul>
            <button
                type="button"
                className="navbar-theme-btn"
                onClick={onToggleTheme}
                title="Toggle Light/Dark Mode"
            >
                {isLightMode ? '🌙' : '☀️'}
            </button>
        </nav>
    );
}

export default NavBar;
