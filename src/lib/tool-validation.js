import { buildBlueprint } from "./question-bank.js";
import {
  DEFAULT_CONTEXT,
  PROGRAMS,
  LEVELS,
  LANGUAGES,
  SETTINGS,
  SUPPORT,
} from "../data/mrsm.js";
export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const options = {
  program: PROGRAMS,
  tingkatan: LEVELS,
  bahasa: LANGUAGES,
  suasana: SETTINGS,
  sokongan: SUPPORT,
};
export function validateContext(raw = {}) {
  if (!object(raw)) throw new InputError("Konteks pengajaran tidak sah.");
  const context = { ...DEFAULT_CONTEXT };
  for (const key of Object.keys(DEFAULT_CONTEXT)) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "string")
      throw new InputError("Maklumat konteks mestilah teks.");
    const value = raw[key].trim();
    const max = key === "standard" ? 4000 : key === "catatan" ? 1000 : 200;
    if (value.length > max)
      throw new InputError(`Maklumat ${key} melebihi ${max} aksara.`);
    if (options[key] && !options[key].includes(value))
      throw new InputError(`Pilihan ${key} tidak sah.`);
    context[key] = value;
  }
  if (
    !/^\d{1,3}$/.test(context.bilanganMurid) ||
    +context.bilanganMurid < 1 ||
    +context.bilanganMurid > 100
  )
    throw new InputError("Bilangan pelajar mestilah antara 1 hingga 100.");
  return context;
}
export function validateValues(tool, raw) {
  if (!object(raw))
    throw new InputError("Sila muat semula halaman dan isi borang alat.");
  if (Object.keys(raw).some((key) => !tool.fields.some((f) => f.name === key)))
    throw new InputError("Ruangan alat tidak dikenali.");
  const values = {};
  for (const field of tool.fields) {
    const value = raw[field.name] ?? field.default ?? field.options?.[0] ?? "";
    if (typeof value !== "string")
      throw new InputError(`${field.label} mestilah teks.`);
    values[field.name] = value.trim();
    if (field.required && !values[field.name])
      throw new InputError(`${field.label} wajib diisi.`);
    const max = field.type === "textarea" ? 12000 : 300;
    if (value.length > max)
      throw new InputError(`${field.label} melebihi ${max} aksara.`);
    if (field.type === "select" && !field.options.includes(values[field.name]))
      throw new InputError(`Pilihan ${field.label} tidak sah.`);
    if (
      field.name === "bilangan" &&
      (!/^\d{1,2}$/.test(values[field.name]) ||
        +values[field.name] < 1 ||
        +values[field.name] > 20)
    )
      throw new InputError("Bilangan soalan mestilah antara 1 hingga 20.");
  }
  if (JSON.stringify(values).length > 24000)
    throw new InputError(
      "Input terlalu panjang. Ringkaskan bahan kepada 24,000 aksara.",
    );
  if (tool.id === "analisis-prestasi") analyseMarks(values.markah);
  if (tool.id === "bank-soalan-jsu") {
    let rows;
    try {
      rows = JSON.parse(values.blueprint);
    } catch {
      throw new InputError("Pelan JSU bukan JSON sah.");
    }
    try {
      buildBlueprint(rows);
    } catch (e) {
      throw new InputError(e.message);
    }
  }
  return values;
}
export function analyseMarks(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!rows.length || rows.length > 100)
    throw new InputError(
      "Masukkan 1 hingga 100 baris markah tanpa nama pelajar.",
    );
  const seen = new Set();
  const items = rows.map((line) => {
    const match = line
      .trim()
      .match(/^(P\d{1,4})\s*[,;:\t ]\s*(\d{1,3}(?:\.\d{1,2})?)\s*$/i);
    if (!match || +match[2] > 100)
      throw new InputError(
        "Gunakan ID samaran dan markah 0–100 sahaja, contohnya P001, 78. Jangan masukkan nama pelajar.",
      );
    const id = match[1].toUpperCase();
    if (seen.has(id))
      throw new InputError(`ID ${id} berulang. Gunakan ID unik.`);
    seen.add(id);
    return { id, score: +match[2] };
  });
  const scores = items.map((x) => x.score).sort((a, b) => a - b),
    n = scores.length;
  return {
    count: n,
    mean: Math.round((scores.reduce((a, b) => a + b, 0) / n) * 100) / 100,
    min: scores[0],
    max: scores[n - 1],
    median:
      n % 2 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2,
    items,
  };
}
