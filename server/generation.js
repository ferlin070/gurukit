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
  const statistics =
    tool.id === "analisis-prestasi"
      ? `\nPENGIRAAN DISAHKAN OLEH SISTEM (gunakan tepat, jangan kira semula atau reka gred lulus):\n${JSON.stringify(analyseMarks(values.markah))}`
      : "";
  return {
    tool,
    values,
    context,
    systemPrompt: `${tool.systemPrompt}\n\n${contextPrompt(context)}`,
    prompt: `${tool.buildPrompt(values)}${statistics}\n\nKONTEKS PENGAJARAN (data pengguna):\n${JSON.stringify(context)}`,
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
