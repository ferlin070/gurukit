import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BLOOM,
  QUESTION_TYPES,
  emptyBlueprintRow,
  buildBlueprint,
  parseGeneratedBank,
  validateBank,
  renderBank,
  renderJsuPlan,
} from "../lib/question-bank.js";
import { useTeaching } from "../context/TeachingContext.jsx";
import {
  generateDocument,
  getQuotaToday,
  listQuestionBanks,
  getQuestionBank,
  saveQuestionBank,
  deleteQuestionBank,
} from "../lib/api.js";
import DocumentContent from "../components/DocumentContent.jsx";
import WordExportButton from "../components/WordExportButton.jsx";
import { downloadText } from "../lib/export.js";
const emptyMeta = () => ({
  title: "Ujian Topikal",
  subject: "",
  level: "Tingkatan 1",
  duration: 60,
  instructions:
    "Jawab semua soalan. Tunjukkan langkah kerja bagi soalan subjektif.",
  school: "",
  teacher: "",
});
const sections = {
  paper: "Kertas soalan",
  answers: "Skema jawapan",
  jsu: "JSU",
  edit: "Sunting soalan",
};
export default function QuestionBank() {
  const profile = useTeaching();
  const [meta, setMeta] = useState(emptyMeta),
    [rows, setRows] = useState([emptyBlueprintRow()]),
    [questions, setQuestions] = useState([]),
    [generatedRows, setGeneratedRows] = useState(""),
    [generatedScope, setGeneratedScope] = useState(null),
    [dirty, setDirty] = useState(false),
    [tab, setTab] = useState("jsu"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [quota, setQuota] = useState(null),
    [library, setLibrary] = useState([]),
    [selected, setSelected] = useState(""),
    [bankId, setBankId] = useState(null),
    [confirmDelete, setConfirmDelete] = useState(false),
    [characters, setCharacters] = useState(0);
  const controller = useRef(null),
    activeRequest = useRef(0);
  const touch = () => {
    setDirty(true);
    setMessage("");
  };
  const loadLibrary = async () => {
    try {
      setLibrary(await listQuestionBanks());
    } catch (e) {
      setError(e.message);
    }
  };
  const loadQuota = async () => {
    try {
      setQuota(await getQuotaToday());
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    loadLibrary();
    loadQuota();
    return () => {
      controller.current?.abort();
      activeRequest.current++;
    };
  }, []);
  useEffect(() => {
    if (profile.ready && !bankId && !questions.length)
      setMeta((old) => ({
        ...old,
        subject: old.subject || profile.context.subjek,
        level: profile.context.tingkatan,
        school: profile.context.maktab,
        teacher: profile.fullName,
      }));
  }, [profile.ready, profile.context, profile.fullName]);
  let blueprint = null,
    planError = "";
  try {
    blueprint = buildBlueprint(rows);
  } catch (e) {
    planError = e.message;
  }
  const stale =
    questions.length > 0 &&
    (JSON.stringify(rows) !== generatedRows ||
      meta.subject !== generatedScope?.subject ||
      meta.level !== generatedScope?.level);
  const draft = { version: 1, meta, rows, questions };
  let planMarkdown = "";
  try {
    planMarkdown = renderJsuPlan(meta, rows);
  } catch {}
  let valid = null,
    bankError = "";
  if (questions.length && !stale) {
    try {
      valid = validateBank(draft);
    } catch (e) {
      bankError = e.message;
    }
  }
  const content = useMemo(() => {
    if (!valid || tab === "edit") return "";
    return renderBank(valid, tab);
  }, [valid && JSON.stringify(valid), tab]);
  const setMetaField = (key, value) => {
    touch();
    setMeta((old) => ({ ...old, [key]: value }));
  };
  const setRow = (index, key, value) => {
    touch();
    setRows((old) =>
      old.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: value,
              ...(key === "type" && value === "Objektif"
                ? {
                    marks: 1,
                    counts: row.counts.map((n, j) => (j === 5 ? 0 : n)),
                  }
                : {}),
            }
          : row,
      ),
    );
  };
  const setQuestion = (index, key, value) => {
    touch();
    setQuestions((old) =>
      old.map((q, i) => (i === index ? { ...q, [key]: value } : q)),
    );
  };
  const generate = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    let plan;
    try {
      plan = buildBlueprint(rows);
      if (!meta.subject.trim()) throw new Error("Subjek wajib diisi.");
      if (!meta.title.trim()) throw new Error("Tajuk bank wajib diisi.");
    } catch (e) {
      setError(e.message);
      return;
    }
    setRunning(true);
    setCharacters(0);
    setTab("jsu");
    const ac = new AbortController();
    controller.current = ac;
    try {
      const result = await generateDocument(
        "bank-soalan-jsu",
        {
          subjek: meta.subject,
          tingkatan: meta.level,
          blueprint: JSON.stringify(plan.rows),
        },
        profile.context,
        { signal: ac.signal, onChunk: (text) => setCharacters(text.length) },
      );
      const parsed = parseGeneratedBank(result.text, plan);
      setQuestions(parsed);
      setBankId(null);
      setDirty(true);
      setGeneratedScope({ subject: meta.subject, level: meta.level });
      setGeneratedRows(JSON.stringify(plan.rows));
      setRows(plan.rows);
      setTab("paper");
      setMessage(
        "Soalan dijana mengikut pelan. Semak kandungan dan jawapan sebelum menyimpan.",
      );
    } catch (e) {
      setError(
        ac.signal.aborted
          ? "Janaan dihentikan. Hasil sedia ada dikekalkan."
          : e.message,
      );
    } finally {
      setRunning(false);
      controller.current = null;
      loadQuota();
    }
  };
  const save = async () => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const normalized = validateBank(draft);
      if (stale)
        throw new Error(
          "JSU berubah. Jana semula atau pulihkan pelan hasil sedia ada.",
        );
      const result = await saveQuestionBank(normalized, bankId);
      setBankId(result.id);
      setSelected(result.id);
      setDirty(false);
      setMessage("Bank soalan berjaya disimpan dalam akaun cikgu.");
      await loadLibrary();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const open = async () => {
    if (!selected) return;
    if (
      dirty &&
      questions.length &&
      !window.confirm(
        "Suntingan belum disimpan. Buka bank lain dan gantikan draf ini?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    const request = ++activeRequest.current;
    try {
      const item = await getQuestionBank(selected),
        bank = validateBank(item.payload);
      if (request !== activeRequest.current) return;
      touch();
      setMeta(bank.meta);
      setRows(bank.rows);
      setQuestions(bank.questions);
      setDirty(false);
      setGeneratedScope({ subject: bank.meta.subject, level: bank.meta.level });
      setGeneratedRows(JSON.stringify(bank.rows));
      setBankId(item.id);
      setTab("paper");
      setConfirmDelete(false);
      setMessage(
        "Bank soalan dibuka. Sebarang suntingan perlu disimpan semula.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!bankId) return;
    setBusy(true);
    setError("");
    try {
      await deleteQuestionBank(bankId);
      setBankId(null);
      setQuestions([]);
      setGeneratedRows("");
      setSelected("");
      setConfirmDelete(false);
      setMessage("Bank soalan telah dipadam.");
      await loadLibrary();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page question-bank-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">PELAN GURU · PENGIRAAN SISTEM</span>
          <h1>Bank soalan & JSU</h1>
          <p className="muted">
            Tetapkan pelan, jana dan semak soalan. Kertas pelajar dan skema guru
            dieksport secara berasingan.
          </p>
        </div>
        {quota && (
          <span className="tag">
            Baki janaan: {Math.max(0, quota.dailyQuota - quota.used)}
          </span>
        )}
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <section className="card bank-library">
        <h2>Bank tersimpan</h2>
        <div className="bank-library-controls">
          <label>
            Pilih bank
            <select
              aria-label="Pilih bank"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={running || busy}
            >
              <option value="">100 bank terkini dalam akaun</option>
              {library.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={open}
            disabled={!selected || running || busy}
          >
            Buka bank
          </button>
          <Link to="/documents" className="back-link">
            Dokumen saya →
          </Link>
        </div>
        <p className="context-note">
          Simpan suntingan sebelum membuka bank lain atau menjana semula. Janaan
          baharu menghasilkan bank baharu.
        </p>
      </section>
      <form className="card runner-form bank-builder" onSubmit={generate}>
        <h2>1. Maklumat kertas</h2>
        <fieldset disabled={running || busy}>
          <div className="teaching-fields">
            <label>
              Tajuk bank
              <input
                value={meta.title}
                onChange={(e) => setMetaField("title", e.target.value)}
                required
                maxLength={160}
              />
            </label>
            <label>
              Subjek
              <input
                value={meta.subject}
                onChange={(e) => setMetaField("subject", e.target.value)}
                required
                maxLength={200}
                placeholder="Contoh: Matematik"
              />
            </label>
            <label>
              Tingkatan
              <select
                aria-label="Tingkatan bank"
                value={meta.level}
                onChange={(e) => setMetaField("level", e.target.value)}
              >
                {[
                  "Tingkatan 1",
                  "Tingkatan 2",
                  "Tingkatan 3",
                  "Tingkatan 4",
                  "Tingkatan 5",
                ].map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label>
              Tempoh kertas (minit)
              <input
                type="number"
                min={5}
                max={240}
                value={meta.duration}
                onChange={(e) =>
                  setMetaField("duration", Number(e.target.value))
                }
                required
              />
            </label>
            <label className="field-wide">
              Arahan kertas
              <textarea
                value={meta.instructions}
                onChange={(e) => setMetaField("instructions", e.target.value)}
                maxLength={2000}
                required
                rows={2}
              />
            </label>
          </div>
          <h2>2. Pelan JSU</h2>
          <p className="context-note">
            C1 Mengingat · C2 Memahami · C3 Mengaplikasi · C4 Menganalisis · C5
            Menilai · C6 Mencipta. Had 20 soalan; mulakan dengan 4–8 soalan
            untuk skema yang lebih lengkap.
          </p>
          <div className="jsu-table-scroll">
            <table className="jsu-editor">
              <caption>Bilangan soalan mengikut topik dan aras Bloom</caption>
              <thead>
                <tr>
                  <th>Topik</th>
                  <th>Jenis</th>
                  <th>Markah / item</th>
                  {BLOOM.map((level, i) => (
                    <th key={level} title={level}>
                      C{i + 1}
                    </th>
                  ))}
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        aria-label={`Topik JSU ${index + 1}`}
                        value={row.topic}
                        required
                        maxLength={180}
                        onChange={(e) => setRow(index, "topic", e.target.value)}
                        placeholder="Contoh: Persamaan kuadratik"
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Jenis topik ${index + 1}`}
                        value={row.type}
                        onChange={(e) => setRow(index, "type", e.target.value)}
                      >
                        {QUESTION_TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        aria-label={`Markah item topik ${index + 1}`}
                        disabled={row.type === "Objektif"}
                        value={row.marks}
                        onChange={(e) =>
                          setRow(index, "marks", Number(e.target.value))
                        }
                      />
                    </td>
                    {row.counts.map((count, i) => (
                      <td key={i}>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          aria-label={`Bilangan C${i + 1} topik ${index + 1}`}
                          disabled={row.type === "Objektif" && i === 5}
                          title={
                            row.type === "Objektif" && i === 5
                              ? "C6 memerlukan soalan subjektif."
                              : BLOOM[i]
                          }
                          value={count}
                          onChange={(e) =>
                            setRow(
                              index,
                              "counts",
                              row.counts.map((old, j) =>
                                j === i ? Number(e.target.value) : old,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={rows.length === 1}
                        aria-label={`Buang topik ${index + 1}`}
                        onClick={() => {
                          touch();
                          setRows((old) => old.filter((_, i) => i !== index));
                        }}
                      >
                        Buang
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={rows.length >= 8}
            onClick={() => {
              touch();
              setRows((old) => [...old, emptyBlueprintRow()]);
            }}
          >
            ＋ Tambah topik / jenis
          </button>
          {planError ? (
            <p className="context-note" role="status">
              {planError}
            </p>
          ) : (
            <p className="jsu-summary" role="status">
              <strong>
                {blueprint.totalQuestions} soalan · {blueprint.totalMarks}{" "}
                markah
              </strong>
              <span>
                {blueprint.bloomTotals
                  .map((n, i) => `C${i + 1}: ${n}`)
                  .join(" · ")}
              </span>
            </p>
          )}
          <p className="privacy-note">
            Jangan masukkan data pelajar atau soalan sulit yang tidak dibenarkan
            dihantar kepada AI. Semak kesahan fakta, aras Bloom dan jawapan
            sebelum digunakan.
          </p>
          <button
            className="btn btn-primary"
            disabled={
              running ||
              busy ||
              !blueprint ||
              !quota ||
              quota.used >= quota.dailyQuota ||
              !profile.ready
            }
          >
            {running
              ? `Sedang menjana (${characters} aksara)…`
              : questions.length
                ? "Jana semula bank baharu"
                : "✨ Jana soalan mengikut JSU"}
          </button>
        </fieldset>
        {running && (
          <button
            className="btn btn-ghost stop-button"
            type="button"
            onClick={() => controller.current?.abort()}
          >
            Hentikan janaan
          </button>
        )}
      </form>
      {questions.length > 0 && (
        <section className="card bank-result">
          <div className="bank-result-toolbar">
            <h2>3. Semak, sunting & eksport</h2>
            <div className="output-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={save}
                disabled={!valid || stale || running || busy}
              >
                {busy ? "Menyimpan…" : "Simpan bank"}
              </button>
              {bankId && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy || running}
                >
                  Padam bank ini
                </button>
              )}
            </div>
          </div>
          {confirmDelete && (
            <div
              role="alertdialog"
              aria-label="Pengesahan padam bank"
              className="delete-confirm"
            >
              <p>
                Padam bank ini daripada akaun? Tindakan ini tidak boleh
                dibatalkan.
              </p>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
              >
                Batal
              </button>{" "}
              <button
                className="btn btn-primary btn-sm"
                onClick={remove}
                disabled={busy}
              >
                Ya, padam bank
              </button>
            </div>
          )}
          {stale && (
            <div className="notice" role="status">
              JSU telah berubah. Jana semula untuk memadankan soalan, atau{" "}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRows(JSON.parse(generatedRows));
                  setMeta((old) => ({ ...old, ...generatedScope }));
                  touch();
                }}
              >
                Pulihkan JSU hasil sedia ada
              </button>
              .
            </div>
          )}
          {bankError && (
            <p className="alert alert-error" role="alert">
              {bankError} Betulkan melalui Sunting soalan sebelum menyimpan atau
              mengeksport.
            </p>
          )}
          <div
            className="bank-tabs"
            role="group"
            aria-label="Bahagian bank soalan"
          >
            {Object.entries(sections).map(([key, label]) => (
              <button
                key={key}
                className={`chip ${tab === key ? "chip-active" : ""}`}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "edit" ? (
            <div className="question-editor">
              {questions.map((q, index) => {
                const item = generatedRows
                  ? buildBlueprint(JSON.parse(generatedRows)).plan[index]
                  : null;
                return (
                  <fieldset
                    className="question-edit-card runner-form"
                    key={q.number}
                    disabled={running || busy}
                  >
                    <legend>
                      Soalan {q.number} · {item?.bloom} · {item?.marks} markah
                    </legend>
                    <label>
                      Teks soalan {q.number}
                      <textarea
                        aria-label={`Teks soalan ${q.number}`}
                        value={q.stem}
                        maxLength={3000}
                        rows={3}
                        onChange={(e) =>
                          setQuestion(index, "stem", e.target.value)
                        }
                      />
                    </label>
                    {q.options ? (
                      <>
                        <div className="teaching-fields">
                          {["A", "B", "C", "D"].map((key) => (
                            <label key={key}>
                              Pilihan {key} soalan {q.number}
                              <input
                                aria-label={`Pilihan ${key} soalan ${q.number}`}
                                value={q.options[key]}
                                maxLength={600}
                                onChange={(e) =>
                                  setQuestion(index, "options", {
                                    ...q.options,
                                    [key]: e.target.value,
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <label>
                          Jawapan betul soalan {q.number}
                          <select
                            aria-label={`Jawapan betul soalan ${q.number}`}
                            value={q.answer}
                            onChange={(e) =>
                              setQuestion(index, "answer", e.target.value)
                            }
                          >
                            {["A", "B", "C", "D"].map((key) => (
                              <option key={key}>{key}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Penjelasan soalan {q.number}
                          <textarea
                            aria-label={`Penjelasan soalan ${q.number}`}
                            value={q.explanation || ""}
                            maxLength={2000}
                            rows={2}
                            onChange={(e) =>
                              setQuestion(index, "explanation", e.target.value)
                            }
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label>
                          Jawapan contoh soalan {q.number}
                          <textarea
                            aria-label={`Jawapan contoh soalan ${q.number}`}
                            value={q.answer}
                            maxLength={4000}
                            rows={3}
                            onChange={(e) =>
                              setQuestion(index, "answer", e.target.value)
                            }
                          />
                        </label>
                        {q.rubric.map((point, j) => (
                          <div className="rubric-row" key={j}>
                            <label>
                              Poin {j + 1} soalan {q.number}
                              <input
                                aria-label={`Poin ${j + 1} soalan ${q.number}`}
                                value={point.point}
                                maxLength={1000}
                                onChange={(e) =>
                                  setQuestion(
                                    index,
                                    "rubric",
                                    q.rubric.map((old, k) =>
                                      k === j
                                        ? { ...old, point: e.target.value }
                                        : old,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <label>
                              Markah poin {j + 1} soalan {q.number}
                              <input
                                type="number"
                                min={1}
                                max={20}
                                aria-label={`Markah poin ${j + 1} soalan ${q.number}`}
                                value={point.marks}
                                onChange={(e) =>
                                  setQuestion(
                                    index,
                                    "rubric",
                                    q.rubric.map((old, k) =>
                                      k === j
                                        ? {
                                            ...old,
                                            marks: Number(e.target.value),
                                          }
                                        : old,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label={`Buang poin ${j + 1} soalan ${q.number}`}
                              disabled={q.rubric.length === 1}
                              onClick={() =>
                                setQuestion(
                                  index,
                                  "rubric",
                                  q.rubric.filter((_, k) => k !== j),
                                )
                              }
                            >
                              Buang
                            </button>
                          </div>
                        ))}
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          disabled={q.rubric.length >= 20}
                          onClick={() =>
                            setQuestion(index, "rubric", [
                              ...q.rubric,
                              { point: "Poin baharu", marks: 1 },
                            ])
                          }
                        >
                          Tambah poin skema
                        </button>
                      </>
                    )}
                  </fieldset>
                );
              })}
            </div>
          ) : (
            <>
              <div className="output-actions bank-export">
                <WordExportButton
                  content={content}
                  title={`${meta.title} — ${sections[tab]}`}
                  disabled={!valid || stale || running}
                  onError={setError}
                  label={`Word · ${sections[tab]}`}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!content || stale}
                  onClick={() => window.print()}
                >
                  Cetak / PDF bahagian ini
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!content || stale}
                  onClick={() => downloadText(content, `${meta.title}-${tab}`)}
                >
                  Markdown bahagian ini
                </button>
              </div>
              {tab === "answers" && (
                <p className="notice">
                  Skema untuk guru sahaja. Pilih Kertas soalan untuk eksport
                  kepada pelajar.
                </p>
              )}
              {content && !stale && (
                <div className="bank-print-area">
                  <DocumentContent content={content} />
                </div>
              )}
            </>
          )}
        </section>
      )}
      {!questions.length && blueprint && (
        <section className="card blueprint-preview">
          <h2>Ringkasan pelan</h2>
          <WordExportButton
            content={planMarkdown}
            title={`${meta.title} — JSU`}
            onError={setError}
            disabled={!planMarkdown}
            label="Word JSU tanpa janaan AI"
          />
          <p>
            {blueprint.totalQuestions} soalan bernombor 1–
            {blueprint.totalQuestions}, berjumlah {blueprint.totalMarks} markah.
            Pelan ini menentukan bilangan dan markah setiap soalan; AI tidak
            boleh mengubahnya.
          </p>
        </section>
      )}
    </div>
  );
}
