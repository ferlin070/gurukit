import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TOOLS } from '../data/tools.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getQuotaToday } from '../lib/api.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua');
  const [quota, setQuota] = useState(null);

  useEffect(() => { getQuotaToday().then(setQuota).catch(() => {}); }, []);

  const categories = useMemo(
    () => ['Semua', ...new Set(TOOLS.map((t) => t.category))],
    []
  );

  const filtered = TOOLS.filter(
    (t) =>
      (category === 'Semua' || t.category === category) &&
      (t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.description.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Selamat datang kembali, {user.name} 👋</h1>
          <p className="muted">Pilih alat dan mula menjana bahan P&P hari ini.</p>
        </div>
        {quota && (
          <div className="quota-badge">
            <span className="tag">{quota.plan === 'pro' ? '⭐ PRO' : 'FREE'}</span>
            <span className="muted">Kuota hari ini: {quota.used}/{quota.dailyQuota}</span>
          </div>
        )}
        <input
          className="search"
          type="search"
          placeholder="Cari alat…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chips">
        {categories.map((c) => (
          <button
            key={c}
            className={`chip ${c === category ? 'chip-active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty">Tiada alat sepadan dengan "{query}".</p>
      ) : (
        <div className="grid">
          {filtered.map((t) => {
            const locked = t.plan === 'pro' && quota?.plan !== 'pro';
            return (
              <Link key={t.id} to={`/tools/${t.id}`} className={`card tool-card ${locked ? 'tool-locked' : ''}`}>
                <div className="tool-card-top">
                  <span className="tool-icon">{t.icon}</span>
                  {locked && <span className="tag tag-lock">🔒 PRO</span>}
                  <span className="tag">{t.category}</span>
                </div>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <span className="run-hint">{locked ? 'Naik taraf untuk guna →' : 'Guna sekarang →'}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
