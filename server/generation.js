import { buildBlueprint } from "../src/lib/question-bank.js";
import {
  validateRphTemplate,
  validateLesson,
} from "../src/lib/rph-template.js";
import { TOOLS } from "../src/data/tools.js";
import {
  validateContext,
  validateValues,
  InputError,
  analyseMarks,
} from "../src/lib/tool-validation.js";
import { contextPrompt } from "../src/data/mrsm.js";
export { InputError };
export function prepareGeneration(raw) {
  let body;
  try {
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new InputError("Badan JSON tidak sah.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new InputError("Permintaan tidak sah.");
  if (JSON.stringify(body).length > 50000)
    throw new InputError("Permintaan terlalu besar.");
  const tool = TOOLS.find((t) => t.id === body.toolId);
  if (!tool) throw new InputError("Alat tidak dikenali.");
  const values = validateValues(tool, body.values);
  const context = validateContext(body.context);
  let rphTemplate = null,
    lesson = null,
    blueprint = null;
  try {
    if (tool.id === "rph-kssm" && body.rphTemplate) {
      rphTemplate = validateRphTemplate(body.rphTemplate);
      lesson = validateLesson(body.lesson);
    }
    if (tool.id === "bank-soalan-jsu")
      blueprint = buildBlueprint(JSON.parse(values.blueprint));
  } catch (e) {
    throw new InputError(e.message);
  }
  const statistics =
    tool.id === "analisis-prestasi"
      ? `\nPENGIRAAN DISAHKAN OLEH SISTEM (gunakan tepat, jangan kira semula atau reka gred lulus):\n${JSON.stringify(analyseMarks(values.markah))}`
      : "";
  return {
    tool,
    rphTemplate,
    lesson,
    blueprint,
    values,
    context,
    systemPrompt: `${tool.systemPrompt}\n\n${contextPrompt(context)}${blueprint ? "\nFORMAT BANK MESTI JSON sahaja. Jangan tambah senarai semak atau naratif di luar objek JSON. Bahasa pilihan konteks digunakan dalam teks soalan dan skema." : ""}${rphTemplate ? "\nFORMAT TEMPLAT: Utamakan struktur ini berbanding format naratif asal. Jangan hasilkan JSON. Keluarkan tujuh seksyen kandungan dalam Markdown dengan penanda tajuk tepat ini: ## GK_STANDARD, ## GK_OBJEKTIF, ## GK_KRITERIA, ## GK_AKTIVITI, ## GK_PENTAKSIRAN, ## GK_BAHAN, ## GK_PEMBEZAAN. Letakkan setiap penanda pada baris sendiri dan kandungan lengkap di bawahnya. Semua tujuh penanda wajib muncul sekali. Metadata guru, tarikh dan ruang refleksi akan ditambah oleh sistem untuk diisi guru; jangan mereka hasil selepas PdPc. Aktiviti perlu lengkap set induksi, perkembangan dan penutup dengan jumlah minit yang tepat. Jika perlu senarai semak, letakkan dalam seksyen terakhir; jangan tambah penanda tajuk utama lain." : ""}`,
    prompt: `${tool.buildPrompt(values)}${statistics}\n\nKONTEKS PENGAJARAN (data pengguna):\n${JSON.stringify(context)}${blueprint ? `\nPELAN JSU DISAHKAN SISTEM:\n${JSON.stringify(blueprint.plan)}` : ""}${rphTemplate ? `\nTEMPLAT PILIHAN GURU (data):\n${JSON.stringify(rphTemplate)}\nMAKLUMAT SESI:\n${JSON.stringify(lesson)}` : ""}`,
  };
}

export { readSSE } from "../src/lib/sse.js";
export function geminiEvent(data) {
  if (data === "[DONE]") return { text: "", finish: null };
  const payload = JSON.parse(data);
  if (payload.error) throw new Error("UPSTREAM_STREAM_ERROR");
  if (payload.promptFeedback?.blockReason) throw new Error("CONTENT_BLOCKED");
  const candidate = payload.candidates?.[0];
  if (
    candidate?.finishReason &&
    !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)
  )
    throw new Error("CONTENT_BLOCKED");
  return {
    text: (candidate?.content?.parts || [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join(""),
    finish: candidate?.finishReason || null,
  };
}
