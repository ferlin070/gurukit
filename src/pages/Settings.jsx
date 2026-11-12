import { useEffect, useState } from "react";
import { useTeaching } from "../context/TeachingContext.jsx";
import TeachingFields from "../components/TeachingFields.jsx";
export default function Settings() {
  const profile = useTeaching();
  const [draft, setDraft] = useState(profile.context),
    [name, setName] = useState(profile.fullName),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (profile.ready) {
      setDraft(profile.context);
      setName(profile.fullName);
    }
  }, [profile.ready, profile.context, profile.fullName]);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await profile.save(name, draft);
      setMessage(
        "Profil pengajaran berjaya disimpan. Alat baharu akan menggunakan tetapan ini.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!profile.ready) return <p role="status">Memuatkan profil…</p>;
  return (
    <div className="page settings-page">
      <span className="eyebrow">DISESUAIKAN UNTUK CIKGU MRSM</span>
      <h1>Profil pengajaran</h1>
      <p className="muted">
        Tetapan lalai untuk semua alat. Cikgu boleh mengubah konteks bagi setiap
        janaan.
      </p>
      {profile.error && (
        <div role="alert" className="alert alert-error">
          {profile.error}{" "}
          <button className="btn btn-sm btn-ghost" onClick={profile.reload}>
            Cuba semula
          </button>
        </div>
      )}
      <form className="card runner-form" onSubmit={submit}>
        <label>
          Nama paparan
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
          />
        </label>
        <TeachingFields value={draft} onChange={setDraft} disabled={busy} />
        <p className="context-note">
          KSSM ialah asas lalai. Program khas tidak menggantikan semakan silibus
          sebenar. Jangan masukkan nama penuh, nombor pengenalan atau maklumat
          peribadi pelajar.
        </p>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <p role="status" className="success-message">
            {message}
          </p>
        )}
        <button
          className="btn btn-primary"
          disabled={busy || Boolean(profile.error)}
        >
          {busy ? "Menyimpan…" : "Simpan profil pengajaran"}
        </button>
      </form>
    </div>
  );
}
