import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Log Masuk</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          E-mel
          <input type="email" name="email" value={form.email} onChange={onChange} required autoFocus />
        </label>
        <label>
          Kata Laluan
          <input type="password" name="password" value={form.password} onChange={onChange} required />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Sedang log masuk…' : 'Log Masuk'}
        </button>
        <p className="auth-alt">
          Belum ada akaun? <Link to="/signup">Daftar sekarang</Link>
        </p>
      </form>
    </div>
  );
}
