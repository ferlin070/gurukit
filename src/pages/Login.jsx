import StudioArt from "../components/StudioArt.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-cloud cloud-one" aria-hidden="true" />
      <div className="auth-cloud cloud-two" aria-hidden="true" />
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-welcome">
          <span className="eyebrow">✦ RUANG KREATIF CIKGU</span>
          <h1>
            Selamat kembali,
            <br />
            Cikgu!
          </h1>
          <p>Idea baharu menanti. Mari cipta sesuatu yang hebat hari ini.</p>
          <StudioArt />
        </div>
        <div className="auth-fields">
          {error && (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          )}
          <label>
            E-mel
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              required
              autoComplete="email"
              placeholder="cikgu@sekolah.edu.my"
            />
          </label>
          <PasswordField value={form.password} onChange={onChange} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Sedang log masuk…" : "Log masuk →"}
          </button>
          <div className="auth-divider">
            <span>Selamat · Mudah · Untuk cikgu</span>
          </div>
          <p className="auth-alt">
            Belum ada akaun? <Link to="/signup">Daftar sekarang</Link>
          </p>
        </div>
      </form>
    </div>
  );
}
