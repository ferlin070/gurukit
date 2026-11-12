import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import PasswordField from "../components/PasswordField.jsx";
export default function PasswordRecovery({ reset = false }) {
  const { user, loading } = useAuth(),
    navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (reset) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Kata laluan berjaya dikemas kini.");
        navigate("/dashboard", { replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin + "/reset-password" },
        );
        if (error) throw error;
        setMessage(
          "Jika e-mel ini berdaftar, pautan pemulihan akan dihantar. Semak peti masuk dan folder spam.",
        );
      }
    } catch {
      setError(
        reset
          ? "Pautan tidak sah atau telah tamat. Mohon pautan pemulihan yang baharu."
          : "Permintaan belum dapat diproses. Cuba lagi sebentar.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <form className="auth-card recovery-card runner-form" onSubmit={submit}>
        <span className="eyebrow">AKSES AKAUN CIKGU</span>
        <h1>{reset ? "Kata laluan baharu" : "Lupa kata laluan?"}</h1>
        <p className="muted">
          {reset
            ? "Tetapkan kata laluan sekurang-kurangnya 8 aksara."
            : "Masukkan e-mel akaun untuk mendapatkan pautan pemulihan."}
        </p>
        {reset ? (
          loading ? (
            <p role="status">Menyemak sesi…</p>
          ) : !user ? (
            <p role="alert">
              Pautan pemulihan diperlukan.{" "}
              <Link to="/forgot-password">Mohon pautan baharu</Link>.
            </p>
          ) : (
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          )
        ) : (
          <label>
            E-mel
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}
        {message && (
          <p role="status" className="success-message">
            {message}
          </p>
        )}
        {error && (
          <div role="alert" className="alert alert-error">
            {error}
          </div>
        )}
        <button
          className="btn btn-primary btn-block"
          disabled={busy || (reset && !user)}
        >
          {busy
            ? "Memproses…"
            : reset
              ? "Simpan kata laluan"
              : "Hantar pautan pemulihan"}
        </button>
        <p className="auth-alt">
          <Link to="/login">Kembali ke log masuk</Link>
        </p>
      </form>
    </div>
  );
}
