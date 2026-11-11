import { Outlet, NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className={`app-shell ${user ? "signed-in" : ""}`}>
      <a className="skip-link" href="#main-content">
        Langkau ke kandungan
      </a>
      {user && (
        <aside className="sidebar">
          <Link to="/dashboard" className="brand">
            <span className="brand-mark">✦</span> Guru<span>Kit</span>
            <small>RUANG KREATIF GURU</small>
          </Link>
          <div className="sidebar-profile">
            <span className="avatar">{user.name?.charAt(0).toUpperCase()}</span>
            <strong>Hai, Cikgu!</strong>
            <span>{user.name}</span>
          </div>
          <nav aria-label="Navigasi utama">
            <NavLink to="/dashboard">
              ⌂ <span>Papan pemuka</span>
            </NavLink>
            <a href="/dashboard#alat">
              ▦ <span>Semua alat AI</span>
            </a>
          </nav>
          <div className="sidebar-note">
            <span>✦</span>
            <strong>
              Idea hebat bermula
              <br />
              dengan cikgu.
            </strong>
            <p>Kami bantu urus persediaan, cikgu fokus pada pengajaran.</p>
          </div>
          <button className="sidebar-logout" onClick={logout}>
            ↗ Log keluar
          </button>
        </aside>
      )}
      <div className="workspace">
        <header className="navbar">
          {user ? (
            <div className="breadcrumb">
              Ruang kerja <span>/</span> <strong>GuruKit</strong>
            </div>
          ) : (
            <Link to="/" className="brand">
              <span className="brand-mark">✦</span> Guru<span>Kit</span>
            </Link>
          )}
          <nav aria-label="Navigasi akaun">
            {user ? (
              <>
                <NavLink to="/dashboard" className="mobile-home">
                  Papan pemuka
                </NavLink>
                <span className="nav-greeting">
                  Selamat mengajar, Cikgu {user.name.split(" ")[0]}!
                </span>
                <span className="avatar avatar-small" aria-label={user.name}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <button
                  className="mobile-logout btn btn-ghost btn-sm"
                  onClick={logout}
                >
                  Log keluar
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Log masuk</NavLink>
                <Link to="/signup" className="btn btn-primary">
                  Mula percuma <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}
          </nav>
        </header>
        <main id="main-content">
          <Outlet />
        </main>
        <footer className="footer">
          <span>✦ GuruKit</span> Dibuat untuk guru Malaysia{" "}
          <span>Bahasa Melayu · KSSM · DSKP</span>
        </footer>
      </div>
    </div>
  );
}
