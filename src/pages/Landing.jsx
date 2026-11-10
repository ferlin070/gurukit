import { Link } from 'react-router-dom';
import { TOOLS } from '../data/tools.js';

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <h1>Suite AI lengkap untuk Guru.<br />Satu kit sahaja.</h1>
        <p className="hero-sub">
          RPH & Modul Ajar, Bank Soal HOTS, LKPD, Slide, Bahan Materi — GuruKit letakkan
          semua alat bahan P&P dalam satu dashboard bersih. Dijana Gemini, ikut KSSM,
          dalam Bahasa Melayu.
        </p>
        <div className="hero-cta">
          <Link to="/signup" className="btn btn-primary btn-lg">Mula Percuma</Link>
          <Link to="/login" className="btn btn-ghost btn-lg">Log Masuk</Link>
        </div>
        <div className="hero-stats">
          <div><strong>{TOOLS.length}</strong><span>alat AI</span></div>
          <div><strong>0</strong><span>langkah persediaan</span></div>
          <div><strong>RM0</strong><span>untuk mula</span></div>
        </div>
      </section>

      <section className="tools-preview">
        <h2>Alat dalam kit</h2>
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
          <li><strong>Daftar</strong> — satu e-mel, tiada kad kredit.</li>
          <li><strong>Pilih alat</strong> — dashboard adalah keseluruhan katalog.</li>
          <li><strong>Jana</strong> — isi borang, tekan Jana, salin hasil siap guna.</li>
        </ol>
      </section>
    </div>
  );
}
