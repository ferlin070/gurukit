import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      setError('Kata laluan mesti sekurang-kurangnya 6 aksara.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await signup(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Daftar Akaun</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Nama
          <input type="text" name="name" value={form.name} onChange={onChange} required autoFocus />
        </label>
        <label>
          E-mel
          <input type="email" name="email" value={form.email} onChange={onChange} required />
        </label>
        <label>
          Kata Laluan
          <input type="password" name="password" value={form.password} onChange={onChange} required minLength={6} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Sedang mendaftar…' : 'Daftar'}
        </button>
        <p className="auth-alt">
          Sudah ada akaun? <Link to="/login">Log Masuk</Link>
        </p>
      </form>
    </div>
  );
}
