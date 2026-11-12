import StudioArt from "../components/StudioArt.jsx";
import { Link } from "react-router-dom";
import { TOOLS } from "../data/tools.js";

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">✦ Dicipta untuk guru MRSM</span>
          <h1>
            Idea cikgu.
            <br />
            <em>Keajaiban</em> bersama.
          </h1>
          <p className="hero-sub">
            Dari RPH hingga pentaksiran, jadikan persediaan mengajar lebih
            ringan. {TOOLS.length} alat AI dalam satu ruang kreatif, mengikut
            KSSM dan DSKP, dalam Bahasa Melayu atau Bahasa Inggeris untuk DLP.
          </p>
          <div className="hero-cta">
            <Link to="/signup" className="btn btn-primary btn-lg">
              Mula Percuma
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Log Masuk
            </Link>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{TOOLS.length}</strong>
              <span>alat AI</span>
            </div>
            <div>
              <strong>KSSM</strong>
              <span>konteks Malaysia</span>
            </div>
            <div>
              <strong>RM0</strong>
              <span>untuk mula</span>
            </div>
          </div>
        </div>
        <div className="hero-art">
          <StudioArt />
          <div className="floating-note">✧ Lebih idea, kurang beban.</div>
        </div>
      </section>

      <section className="tools-preview">
        <span className="eyebrow">KIT KECIL, KEMUNGKINAN BESAR</span>
        <h2>Teman kreatif untuk setiap tugasan.</h2>
        <p className="muted">
          Semua yang cikgu perlukan untuk memulakan idea baharu.
        </p>
        <div className="grid">
          {TOOLS.map((t) => (
            <div key={t.id} className="card tool-card-preview">
              <span className="tool-icon">{t.icon}</span>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
            </div>
          ))}
        </div>
        <p className="preview-note">
          <Link to="/signup">Daftar sekarang</Link> untuk guna mana-mana alat.
        </p>
      </section>

      <section className="how">
        <h2>Cara ia berfungsi</h2>
        <ol className="steps">
          <li>
            <strong>Daftar</strong> — satu e-mel, tiada kad kredit.
          </li>
          <li>
            <strong>Pilih alat</strong> — terokai katalog alat pengajaran.
          </li>
          <li>
            <strong>Jana</strong> — isi borang, tekan Jana, salin hasil untuk
            disemak dan disesuaikan.
          </li>
        </ol>
      </section>
    </div>
  );
}
