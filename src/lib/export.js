export function downloadText(content, name) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/markdown;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(name) + ".md";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name) {
  const value = String(name || "Dokumen GuruKit")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 100);
  return !value || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value)
    ? "Dokumen GuruKit"
    : value;
}
export async function downloadDocx(content, title) {
  const { buildDocx } = await import("./docx-export.js");
  const blob = await buildDocx(content, { title });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = safeFilename(title) + ".docx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
