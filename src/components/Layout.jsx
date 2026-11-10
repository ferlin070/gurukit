import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="navbar">
        <Link to="/" className="brand">
          Guru<span>Kit</span>
        </Link>
        <nav>
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <span className="nav-user">{user.name}</span>
              <button className="btn btn-ghost" onClick={logout}>Log Keluar</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log Masuk</NavLink>
              <Link to="/signup" className="btn btn-primary">Mula Sekarang</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        © {new Date().getFullYear()} GuruKit — Suite AI untuk Guru Malaysia.
      </footer>
    </div>
  );
}
