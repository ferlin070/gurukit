import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { TOOLS } from "../data/tools.js";
import { generateDocument, getQuotaToday, saveDocument } from "../lib/api.js";
import { validateValues, validateContext } from "../lib/tool-validation.js";
import { downloadText } from "../lib/export.js";
import { useTeaching } from "../context/TeachingContext.jsx";
import TeachingFields from "../components/TeachingFields.jsx";
import DocumentContent from "../components/DocumentContent.jsx";

export default function ToolRoute() {
  const { toolId } = useParams();
  return <ToolRunner key={toolId} toolId={toolId} />;
}
function ToolRunner({ toolId }) {
  const tool = TOOLS.find((t) => t.id === toolId),
    profile = useTeaching();
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      (tool?.fields || []).map((f) => [
        f.name,
        f.default || f.options?.[0] || "",
      ]),
    ),
  );
  const [context, setContext] = useState(profile.context),
    [output, setOutput] = useState(""),
    [status, setStatus] = useState("idle"),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [quota, setQuota] = useState(null),
    [quotaError, setQuotaError] = useState(""),
    [title, setTitle] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const controller = useRef(null);
  const running = status === "running",
    complete = status === "complete";
  const refreshQuota = () =>
    getQuotaToday()
      .then((q) => {
        setQuota(q);
        setQuotaError("");
      })
      .catch((e) => setQuotaError(e.message));
  useEffect(() => {
    refreshQuota();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (profile.ready) {
      setContext(profile.context);
      setValues((previous) => {
        const next = { ...previous };
        if ("subjek" in next && !next.subjek)
          next.subjek = profile.context.subjek;
        if ("tahun" in next && !next.tahun)
          next.tahun = profile.context.tingkatan;
        return next;
      });
    }
  }, [profile.ready, profile.context]);
  if (!tool)
    return (
      <div className="page">
        <h1>Alat tidak ditemukan</h1>
        <Link to="/dashboard">Kembali ke papan pemuka</Link>
      </div>
    );
  const locked = tool.plan === "pro" && quota?.plan !== "pro";
  const run = async (e) => {
    e.preventDefault();
    if (running) return;
    setError("");
    let input, teaching;
    try {
      input = validateValues(tool, values);
      teaching = validateContext(context);
    } catch (e) {
      setError(e.message);
      return;
    }
    setStatus("running");
    setOutput("");
    setCopied(false);
    setSaved(false);
    setTitle(
      `${tool.name} — ${input.subjek || teaching.subjek || teaching.tingkatan}`.slice(
        0,
        160,
      ),
    );
    const active = new AbortController();
    controller.current = active;
    try {
      const result = await generateDocument(tool.id, input, teaching, {
        onChunk: setOutput,
        signal: active.signal,
      });
      setOutput(result.text);
      setStatus("complete");
    } catch (e) {
      setStatus("partial");
      setError(
        active.signal.aborted
          ? "Janaan dihentikan. Hasil separa belum sedia untuk digunakan. Semak kuota semula selepas penyelarasan pelayan."
          : e.message,
      );
    } finally {
      controller.current = null;
      refreshQuota();
    }
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await saveDocument(tool.id, title, output);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const field = (f) => {
    const props = {
      "aria-label": f.label,
      value: values[f.name],
      onChange: (e) => {
        setValues((v) => ({ ...v, [f.name]: e.target.value }));
      },
      disabled: running,
      required: Boolean(f.required),
    };
    if (f.type === "textarea")
      return (
        <textarea
          {...props}
          rows={5}
          maxLength={12000}
          placeholder={f.placeholder}
        />
      );
    if (f.type === "select")
      return (
        <select {...props}>
          {f.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    return (
      <input
        {...props}
        type={f.name === "bilangan" ? "number" : "text"}
        min={f.name === "bilangan" ? 1 : undefined}
        max={f.name === "bilangan" ? 20 : undefined}
        maxLength={300}
        placeholder={f.placeholder}
      />
    );
  };
  return (
    <div className="page tool-runner">
      <div className="page-head">
        <div>
          <Link to="/dashboard" className="back-link">
            ← Papan pemuka
          </Link>
          <h1>
            {tool.icon} {tool.name}
          </h1>
          <p className="muted">{tool.description}</p>
        </div>
        {quota && (
          <span className="tag tag-quota">
            Baki hari ini: {Math.max(0, quota.dailyQuota - quota.used)} · MYT
          </span>
        )}
      </div>
      {quotaError && (
        <div className="alert alert-error" role="alert">
          {quotaError}{" "}
          <button className="btn btn-sm btn-ghost" onClick={refreshQuota}>
            Semak semula kuota
          </button>
        </div>
      )}
      {locked && quota && (
        <div className="notice">
          Alat ini memerlukan pelan Pro. Hubungi pentadbir untuk akses atau
          pilih alat Percuma dalam <Link to="/dashboard">papan pemuka</Link>.
        </div>
      )}
      <div className="runner-grid">
        <form className="card runner-form" onSubmit={run}>
          <h2>Maklumat pengajaran</h2>
          {tool.fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.required && <span aria-hidden="true"> *</span>}
              {field(f)}
            </label>
          ))}
          <details className="context-details">
            <summary>
              Konteks MRSM · {context.tingkatan} · {context.bahasa}
            </summary>
            <p className="context-note">
              Digunakan bersama borang alat. Semak standard dan keperluan
              program sebenar.
            </p>
            <TeachingFields
              value={context}
              onChange={setContext}
              compact
              disabled={running}
            />
            <Link to="/settings">
              Ubah tetapan lalai dalam profil pengajaran →
            </Link>
          </details>
          <p className="privacy-note">
            Gunakan ID samaran pelajar. Jangan masukkan nama penuh, nombor
            pengenalan atau maklumat sensitif.
          </p>
          {error && (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-block"
            disabled={running || !quota || locked || !profile.ready}
          >
            {running ? "Sedang menjana…" : "✨ Jana Sekarang"}
          </button>
          {running && (
            <button
              type="button"
              className="btn btn-ghost btn-block stop-button"
              onClick={() => controller.current?.abort()}
            >
              Hentikan janaan
            </button>
          )}
        </form>
        <section className="card runner-output" aria-busy={running}>
          <div className="output-head">
            <h2>Hasil pengajaran</h2>
            {complete && (
              <div className="output-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.print()}
                >
                  Cetak / PDF
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => downloadText(output, tool.id)}
                >
                  ⬇ Muat Turun
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(output);
                      setCopied(true);
                    } catch {
                      setError(
                        "Salinan gagal. Pilih teks atau muat turun hasil.",
                      );
                    }
                  }}
                >
                  {copied ? "✓ Disalin" : "⧉ Salin"}
                </button>
              </div>
            )}
          </div>
          {output ? (
            <div className="output document-output">
              <DocumentContent content={output} />
            </div>
          ) : (
            <div className="output output-placeholder">
              {running
                ? "AI sedang menyediakan bahan cikgu…"
                : "Lengkapkan maklumat pengajaran dan tekan Jana Sekarang."}
            </div>
          )}
          <p className="generation-status" role="status">
            {running
              ? "Sedang menjana. Sila tunggu sehingga selesai."
              : complete
                ? "Janaan selesai. Semak fakta, pengiraan dan rujukan DSKP sebelum digunakan."
                : status === "partial"
                  ? "Hasil separa / gagal. Jangan gunakan sebagai dokumen lengkap."
                  : "Bahan AI memerlukan semakan profesional guru."}
          </p>
          {complete && (
            <div className="save-document">
              <label>
                Tajuk dokumen
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setSaved(false);
                  }}
                  maxLength={160}
                  required
                />
              </label>
              <button
                className="btn btn-primary"
                disabled={saving || saved || !title.trim()}
                onClick={save}
              >
                {saved
                  ? "✓ Tersimpan"
                  : saving
                    ? "Menyimpan…"
                    : "Simpan dokumen"}
              </button>
              {saved && <Link to="/documents">Buka dokumen saya →</Link>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
