import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page notfound">
      <h1>404</h1>
      <p className="muted">Halaman ini tidak ditemukan.</p>
      <Link to="/" className="btn btn-primary">
        Laman utama
      </Link>
    </div>
  );
}
