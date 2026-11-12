import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { getRphTemplate, saveRphTemplate } from "../lib/api.js";
import {
  DEFAULT_RPH_TEMPLATE,
  validateRphTemplate,
  blankRph,
} from "../lib/rph-template.js";
import { useTeaching } from "../context/TeachingContext.jsx";
import DocumentContent from "../components/DocumentContent.jsx";
import WordExportButton from "../components/WordExportButton.jsx";
const defaults = () => structuredClone(DEFAULT_RPH_TEMPLATE);
export default function RphTemplate() {
  const profile = useTeaching();
  const [draft, setDraft] = useState(defaults),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const requestVersion = useRef(0);
  const load = async () => {
    const request = ++requestVersion.current;
    setLoaded(false);
    setError("");
    try {
      const data = await getRphTemplate();
      if (request !== requestVersion.current) return;
      setDraft(data ? validateRphTemplate(data) : defaults());
      setLoaded(true);
    } catch (e) {
      if (request === requestVersion.current) setError(e.message);
    }
  };
  useEffect(() => {
    load();
    return () => {
      requestVersion.current++;
    };
  }, []);
  const update = (key, value) => {
    setDraft((t) => ({ ...t, [key]: value }));
    setMessage("");
  };
  const move = (index, direction) => {
    setDraft((t) => {
      const sections = [...t.sections];
      [sections[index], sections[index + direction]] = [
        sections[index + direction],
        sections[index],
      ];
      return { ...t, sections };
    });
    setMessage("");
  };
  let preview = "",
    validation = "";
  try {
    preview = blankRph(validateRphTemplate(draft), {
      context: profile.context,
      teacher: profile.fullName,
    });
  } catch (e) {
    validation = e.message;
  }
  const save = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await saveRphTemplate(validateRphTemplate(draft));
      setMessage(
        "Templat RPH berjaya disimpan. Janaan RPH baharu akan menggunakannya.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">IKUT KEPERLUAN MAKTAB CIKGU</span>
          <h1>Templat RPH maktab</h1>
          <p className="muted">
            Ubah label dan susunan lapan seksyen asas. Templat ini boleh suai,
            bukan pengesahan format rasmi MRSM.
          </p>
        </div>
        <Link className="btn btn-primary" to="/tools/rph-kssm">
          Cipta RPH →
        </Link>
      </div>
      {error && (
        <div role="alert" className="alert alert-error">
          {error}{" "}
          {!loaded && (
            <button className="btn btn-ghost btn-sm" onClick={load}>
              Cuba muat semula
            </button>
          )}
        </div>
      )}
      <div className="runner-grid">
        <form className="card runner-form template-editor" onSubmit={save}>
          <h2>Tetapan templat</h2>
          {!loaded && !error && <p role="status">Memuatkan templat…</p>}
          <fieldset disabled={!loaded || busy}>
            <label>
              Tajuk RPH
              <input
                value={draft.title}
                maxLength={120}
                onChange={(e) => update("title", e.target.value)}
                required
              />
            </label>
            <label>
              Subtajuk
              <input
                value={draft.subtitle}
                maxLength={180}
                onChange={(e) => update("subtitle", e.target.value)}
                required
              />
            </label>
            <label>
              Susun atur
              <select
                aria-label="Susun atur"
                value={draft.layout}
                onChange={(e) => update("layout", e.target.value)}
              >
                <option>Naratif berstruktur</option>
                <option>Jadual ringkasan</option>
              </select>
            </label>
            <p className="context-note">
              Jadual ringkasan memadatkan perenggan ke dalam sel; pilih naratif
              untuk butiran aktiviti yang panjang.
            </p>
            <h3>Label dan susunan seksyen</h3>
            {draft.sections.map((s, index) => (
              <div key={s.key} className="template-section-row">
                <label>
                  Label seksyen {index + 1}
                  <input
                    value={s.label}
                    required
                    maxLength={90}
                    onChange={(e) => {
                      update(
                        "sections",
                        draft.sections.map((old, i) =>
                          i === index ? { ...old, label: e.target.value } : old,
                        ),
                      );
                    }}
                  />
                </label>
                <div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={index === 0}
                    aria-label={`Naikkan ${s.label}`}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={index === draft.sections.length - 1}
                    aria-label={`Turunkan ${s.label}`}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
            <label>
              Catatan / tandatangan akhir
              <input
                value={draft.footer}
                maxLength={220}
                required
                onChange={(e) => update("footer", e.target.value)}
              />
            </label>
            {validation && (
              <p role="alert" className="alert alert-error">
                {validation}
              </p>
            )}
            {message && (
              <p role="status" className="success-message">
                {message}
              </p>
            )}
            <div className="output-actions">
              <button
                className="btn btn-primary"
                disabled={Boolean(validation)}
              >
                {busy ? "Menyimpan…" : "Simpan templat"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDraft(defaults());
                  setMessage(
                    "Templat lalai dipaparkan. Tekan Simpan untuk menggunakannya dalam akaun.",
                  );
                }}
              >
                Pulihkan lalai
              </button>
            </div>
          </fieldset>
        </form>
        <section className="card template-preview">
          <div className="output-head">
            <h2>Pratonton templat kosong</h2>
            <WordExportButton
              content={preview}
              title={draft.title}
              disabled={!loaded || Boolean(validation)}
              onError={setError}
              label="Templat Word kosong"
            />
          </div>
          {preview && <DocumentContent content={preview} />}
        </section>
      </div>
    </div>
  );
}
