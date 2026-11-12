import { useState } from "react";
import { downloadDocx } from "../lib/export.js";
export default function WordExportButton({
  content,
  title,
  onError,
  disabled = false,
  label = "Word (.docx)",
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={disabled || busy || !content?.trim()}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadDocx(content, title);
        } catch {
          onError?.(
            "Eksport Word gagal. Cuba semula atau gunakan muat turun Markdown.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Menyediakan Word…" : label}
    </button>
  );
}
