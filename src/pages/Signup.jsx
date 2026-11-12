import StudioArt from "../components/StudioArt.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Kata laluan mesti sekurang-kurangnya 8 aksara.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await signup(form);
      if (result.requiresConfirmation) {
        setConfirmation(true);
        return;
      }
      navigate("/dashboard", { replace: true });
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
            Mulakan perjalanan
            <br />
            kreatif cikgu.
          </h1>
          <p>Satu akaun, pelbagai kemungkinan untuk pengajaran.</p>
          <StudioArt />
        </div>
        <div className="auth-fields">
          {confirmation && (
            <p role="status" className="success-message">
              Pendaftaran diterima. Jika alamat layak didaftarkan, sila semak
              e-mel pengesahan sebelum log masuk.
            </p>
          )}
          {error && (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          )}
          <label>
            Nama
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={onChange}
              required
              autoComplete="name"
            />
          </label>
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
          <PasswordField
            value={form.password}
            onChange={onChange}
            autoComplete="new-password"
            minLength={8}
          />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Sedang mendaftar…" : "Cipta akaun percuma →"}
          </button>
          <div className="auth-divider">
            <span>Selamat · Mudah · Untuk cikgu</span>
          </div>
          <p className="auth-alt">
            Sudah ada akaun? <Link to="/login">Log Masuk</Link>
          </p>
        </div>
      </form>
    </div>
  );
}
