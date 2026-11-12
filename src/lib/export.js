export function downloadText(content, name) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/markdown;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".md";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
