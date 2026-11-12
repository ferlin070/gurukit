import { useTeaching } from "../context/TeachingContext.jsx";
import { Outlet, NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Layout() {
  const { user, logout, authError } = useAuth();
  const { fullName } = useTeaching();
  const displayName = fullName || user?.name || "Guru";
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
            <span className="avatar">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <strong>Hai, Cikgu!</strong>
            <span>{displayName}</span>
          </div>
          <nav aria-label="Navigasi utama">
            <NavLink to="/dashboard">
              ⌂ <span>Papan pemuka</span>
            </NavLink>
            <a href="/dashboard#alat">
              ▦ <span>Semua alat AI</span>
            </a>
            <NavLink to="/question-bank">
              ▦ <span>Bank soalan & JSU</span>
            </NavLink>
            <NavLink to="/rph-template">
              ▧ <span>Templat RPH</span>
            </NavLink>
            <NavLink to="/documents">
              ▤ <span>Dokumen saya</span>
            </NavLink>
            <NavLink to="/settings">
              ⚙ <span>Profil pengajaran</span>
            </NavLink>
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
                  Selamat mengajar, Cikgu {displayName.split(" ")[0]}!
                </span>
                <span className="avatar avatar-small" aria-label={displayName}>
                  {displayName.charAt(0).toUpperCase()}
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
          {authError && (
            <div role="alert" className="alert alert-error">
              {authError}
            </div>
          )}
          {user && (
            <nav className="mobile-tools" aria-label="Ruang kerja MRSM">
              <NavLink to="/dashboard">Alat AI</NavLink>
              <NavLink to="/question-bank">
                ▦ <span>Bank soalan & JSU</span>
              </NavLink>
              <NavLink to="/rph-template">
                ▧ <span>Templat RPH</span>
              </NavLink>
              <NavLink to="/documents">Dokumen saya</NavLink>
              <NavLink to="/settings">Profil MRSM</NavLink>
            </nav>
          )}
          <Outlet />
        </main>
        <footer className="footer">
          <span>✦ GuruKit</span> Dibuat untuk guru Malaysia{" "}
          <span>Bahasa Melayu · KSSM · DSKP</span>
          <Link to="/privacy">Privasi</Link>
          <Link to="/support">Bantuan</Link>
        </footer>
      </div>
    </div>
  );
}
