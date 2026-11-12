import WordExportButton from "../components/WordExportButton.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments, getDocument, deleteDocument } from "../lib/api.js";
import { downloadText } from "../lib/export.js";
import DocumentContent from "../components/DocumentContent.jsx";
export default function Documents() {
  const [items, setItems] = useState([]),
    [selected, setSelected] = useState(null),
    [document, setDocument] = useState(null),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [opening, setOpening] = useState(false),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState(false);
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setItems(await listDocuments());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    let active = true;
    setDocument(null);
    setConfirm(false);
    if (!selected) return;
    setOpening(true);
    getDocument(selected)
      .then((data) => {
        if (active) setDocument(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setOpening(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const remove = async () => {
    setDeleting(true);
    try {
      await deleteDocument(selected);
      setItems((prev) => prev.filter((item) => item.id !== selected));
      setSelected(null);
      setDocument(null);
      setConfirm(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="page documents-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">BAHAN PENGAJARAN CIKGU</span>
          <h1>Dokumen saya</h1>
          <p className="muted">
            200 dokumen terkini yang disimpan dalam akaun cikgu.
          </p>
        </div>
        <Link to="/dashboard" className="btn btn-primary">
          ＋ Cipta bahan
        </Link>
      </div>
      {error && (
        <div role="alert" className="alert alert-error">
          {error}{" "}
          <button className="btn btn-ghost btn-sm" onClick={load}>
            Cuba semula
          </button>
        </div>
      )}
      <div className="documents-grid">
        <section className="card document-list">
          <label>
            Cari dokumen
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari mengikut tajuk…"
            />
          </label>
          {busy ? (
            <p role="status">Memuatkan dokumen…</p>
          ) : filtered.length ? (
            filtered.map((item) => (
              <button
                key={item.id}
                className={`document-list-item ${selected === item.id ? "selected" : ""}`}
                onClick={() => {
                  setError("");
                  setSelected(item.id);
                }}
                aria-pressed={selected === item.id}
              >
                <strong>{item.title}</strong>
                <span>
                  {new Intl.DateTimeFormat("ms-MY", {
                    dateStyle: "medium",
                    timeZone: "Asia/Kuala_Lumpur",
                  }).format(new Date(item.created_at))}
                </span>
              </button>
            ))
          ) : (
            <p className="muted">
              {query
                ? "Tiada dokumen sepadan."
                : "Belum ada dokumen. Jana bahan menggunakan alat dan tekan Simpan."}
            </p>
          )}
        </section>
        <section className="card document-preview">
          {opening ? (
            <p role="status">Membuka dokumen…</p>
          ) : document ? (
            <>
              <div className="document-toolbar">
                <h2>{document.title}</h2>
                <div className="output-actions">
                  <WordExportButton
                    content={document.content}
                    title={document.title}
                    onError={setError}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => window.print()}
                  >
                    Cetak / PDF
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      downloadText(document.content, document.tool_id)
                    }
                  >
                    Muat turun Markdown
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirm(true)}
                  >
                    Padam
                  </button>
                </div>
              </div>
              {confirm && (
                <div
                  className="delete-confirm"
                  role="alertdialog"
                  aria-label="Pengesahan padam"
                >
                  <p>Padam dokumen ini? Tindakan ini tidak boleh dibatalkan.</p>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirm(false)}
                    disabled={deleting}
                  >
                    Batal
                  </button>{" "}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={remove}
                    disabled={deleting}
                  >
                    {deleting ? "Memadam…" : "Ya, padam dokumen"}
                  </button>
                </div>
              )}
              <DocumentContent content={document.content} />
            </>
          ) : (
            <div className="empty">
              <h2>Pilih bahan cikgu</h2>
              <p>Buka dokumen untuk membaca, mencetak atau memuat turun.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
