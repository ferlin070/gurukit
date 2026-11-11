import StudioArt from "../components/StudioArt.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TOOLS } from "../data/tools.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getQuotaToday } from "../lib/api.js";

export default function Dashboard() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [quota, setQuota] = useState(null);
  const [quotaError, setQuotaError] = useState(false);

  useEffect(() => {
    getQuotaToday()
      .then(setQuota)
      .catch(() => setQuotaError(true));
  }, []);

  const categories = useMemo(
    () => ["Semua", ...new Set(TOOLS.map((t) => t.category))],
    [],
  );

  const filtered = TOOLS.filter(
    (t) =>
      (category === "Semua" || t.category === category) &&
      (t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.description.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="page dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">SEDIKIT BANTUAN, BANYAK KEMUNGKINAN</span>
          <h1>Papan pemuka</h1>
        </div>
        <span className="today">
          {new Intl.DateTimeFormat("ms-MY", {
            dateStyle: "long",
            timeZone: "Asia/Kuala_Lumpur",
          }).format(new Date())}
        </span>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="pill">✦ Pembantu AI peribadi cikgu</span>
          <h2>
            Selamat kembali,
            <br />
            Cikgu {user.name.split(" ")[0]} <span className="sun">✧</span>
          </h2>
          <p>
            Lebih masa untuk mengajar.
            <br />
            Lebih ruang untuk mencipta.
          </p>
          <Link to="/tools/rph-kssm" className="btn btn-primary">
            ＋ Cipta RPH baharu
          </Link>
        </div>
        <StudioArt />
      </section>
      <section className="stats-grid" aria-label="Ringkasan ruang kerja">
        <div className="stat-card stat-lilac">
          <span className="stat-icon">▦</span>
          <span>Alat dalam kit</span>
          <strong>
            {TOOLS.length}
            <small> alat AI</small>
          </strong>
          <p>Sedia membantu cikgu</p>
        </div>
        <div className="stat-card stat-pink">
          <span className="stat-icon">✧</span>
          <span>Janaan hari ini</span>
          <strong>
            {quota ? quota.used : "—"}
            <small>{quota ? ` / ${quota.dailyQuota}` : ""}</small>
          </strong>
          <p>
            {quotaError
              ? "Kuota tidak dapat dimuatkan"
              : "Mengikut penggunaan sebenar"}
          </p>
        </div>
        <div className="stat-card stat-yellow">
          <span className="stat-icon">◷</span>
          <span>Baki kuota</span>
          <strong>
            {quota ? Math.max(0, quota.dailyQuota - quota.used) : "—"}
            <small> janaan</small>
          </strong>
          <p>Kuota diperbaharui setiap hari</p>
        </div>
        <div className="stat-card stat-green">
          <span className="stat-icon">♧</span>
          <span>Pelan cikgu</span>
          <strong>
            {quota ? (quota.plan === "pro" ? "Pro" : "Percuma") : "—"}
          </strong>
          <p>
            {quota
              ? `${TOOLS.filter((t) => quota.plan === "pro" || t.plan !== "pro").length} alat tersedia dalam pelan`
              : "Memuatkan maklumat pelan…"}
          </p>
        </div>
      </section>
      <div className="tool-section-heading" id="alat">
        <div>
          <span className="eyebrow">DARI IDEA KE BAHAN PENGAJARAN</span>
          <h2>Apa yang cikgu ingin cipta?</h2>
          <p className="muted">
            Pilih alat yang sesuai. Biar kami bantu langkah seterusnya.
          </p>
        </div>
        <label className="search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            className="search"
            aria-label="Cari alat AI"
            type="search"
            placeholder="Cari alat untuk cikgu…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="chips">
        {categories.map((c) => (
          <button
            key={c}
            aria-pressed={c === category}
            className={`chip ${c === category ? "chip-active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty" role="status">
          <span>⌕</span>
          <h3>Tiada alat ditemukan</h3>
          <p>Cuba kata carian lain atau pilih kategori Semua.</p>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setQuery("");
              setCategory("Semua");
            }}
          >
            Tetapkan semula carian
          </button>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((t) => {
            const locked =
              t.plan === "pro" && quota !== null && quota.plan !== "pro";
            return (
              <Link
                key={t.id}
                to={`/tools/${t.id}`}
                className={`card tool-card ${locked ? "tool-locked" : ""}`}
              >
                <div className="tool-card-top">
                  <span className="tool-icon">{t.icon}</span>
                  {locked && <span className="tag tag-lock">🔒 PRO</span>}
                  <span className="tag">{t.category}</span>
                </div>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <span className="run-hint">
                  {locked ? "Naik taraf untuk guna →" : "Guna sekarang →"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <section className="inspiration-banner">
        <span className="inspiration-star" aria-hidden="true">
          ✦
        </span>
        <div>
          <h2>Pengajaran hebat bermula dengan satu idea.</h2>
          <p>Disesuaikan dengan KSSM dan DSKP, dalam Bahasa Melayu.</p>
        </div>
        <Link to="/tools/nota-ringkas-kssm" className="btn btn-ghost">
          Cipta nota →
        </Link>
      </section>
    </div>
  );
}
