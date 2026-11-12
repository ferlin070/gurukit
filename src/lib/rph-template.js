const BASE_SECTIONS = [
  ["standard", "Standard Kandungan & Pembelajaran"],
  ["objektif", "Objektif Pembelajaran"],
  ["kriteria", "Kriteria Kejayaan"],
  ["aktiviti", "Aktiviti PdPc"],
  ["pentaksiran", "Pentaksiran Bilik Darjah"],
  ["bahan", "Bahan & Sumber"],
  ["pembezaan", "Pembezaan & Pengayaan"],
  ["refleksi", "Refleksi Guru"],
];
export const DEFAULT_RPH_TEMPLATE = Object.freeze({
  version: 1,
  title: "RANCANGAN PENGAJARAN HARIAN",
  subtitle: "MRSM · Draf untuk semakan guru",
  layout: "Naratif berstruktur",
  footer:
    "Disediakan oleh: ____________________    Disemak oleh: ____________________",
  sections: BASE_SECTIONS.map(([key, label]) => ({ key, label })),
});
const plain = (value, max, label) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\r\n<>`#|]/.test(value)
  )
    throw new Error(`${label} tidak sah atau terlalu panjang.`);
  return value.trim();
};
export function validateRphTemplate(raw = DEFAULT_RPH_TEMPLATE) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Templat RPH tidak sah.");
  if (!["Naratif berstruktur", "Jadual ringkasan"].includes(raw.layout))
    throw new Error("Susun atur templat tidak sah.");
  if (
    !Array.isArray(raw.sections) ||
    raw.sections.length !== BASE_SECTIONS.length
  )
    throw new Error("Semua lapan seksyen RPH mesti dikekalkan.");
  const seen = new Set();
  const sections = raw.sections.map((s) => {
    if (!s || !BASE_SECTIONS.some(([key]) => key === s.key) || seen.has(s.key))
      throw new Error("Seksyen templat berulang atau tidak dikenali.");
    seen.add(s.key);
    return { key: s.key, label: plain(s.label, 90, "Label seksyen") };
  });
  if (
    new Set(sections.map((s) => s.label.toLowerCase())).size !== sections.length
  )
    throw new Error("Label seksyen mesti berbeza.");
  return {
    version: 1,
    title: plain(raw.title, 120, "Tajuk"),
    subtitle: plain(raw.subtitle, 180, "Subtajuk"),
    layout: raw.layout,
    footer: plain(raw.footer, 220, "Catatan akhir"),
    sections,
  };
}
export function parseJsonOutput(text) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}
export const REFLECTION_PLACEHOLDER =
  "Diisi selepas PdPc: ____________________";
export function parseGeneratedRph(text) {
  let raw;
  const markers = [
    ...text.matchAll(
      /^#{1,6}\s+GK_(STANDARD|OBJEKTIF|KRITERIA|AKTIVITI|PENTAKSIRAN|BAHAN|PEMBEZAAN)\s*$/gim,
    ),
  ];
  if (markers.length) {
    const sections = {};
    markers.forEach((match, index) => {
      const key = match[1].toLowerCase();
      if (Object.hasOwn(sections, key))
        throw new Error("Seksyen RPH berulang.");
      sections[key] = text
        .slice(
          match.index + match[0].length,
          markers[index + 1]?.index ?? text.length,
        )
        .trim();
    });
    raw = { sections };
  } else raw = parseJsonOutput(text);
  const allowed = BASE_SECTIONS.map(([key]) => key);
  if (
    !raw ||
    !raw.sections ||
    Array.isArray(raw.sections) ||
    Object.keys(raw.sections).some((key) => !allowed.includes(key))
  )
    throw new Error("Struktur RPH tidak lengkap.");
  const sections = {};
  for (const [key] of BASE_SECTIONS) {
    if (key === "refleksi") {
      sections[key] = REFLECTION_PLACEHOLDER;
      continue;
    }
    const value = raw.sections[key];
    if (typeof value !== "string" || !value.trim() || value.length > 20000)
      throw new Error("Seksyen RPH tidak lengkap.");
    sections[key] = value.trim();
  }
  return sections;
}
export function validateLesson(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Maklumat sesi tidak sah.");
  const lesson = {};
  for (const [key, max] of [
    ["date", 10],
    ["time", 60],
    ["className", 100],
  ]) {
    const value = raw[key] ?? "";
    if (
      typeof value !== "string" ||
      value.length > max ||
      /[\r\n<>]/.test(value)
    )
      throw new Error("Maklumat kelas/tarikh tidak sah.");
    lesson[key] = value.trim();
  }
  if (
    lesson.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(lesson.date) ||
      Number.isNaN(Date.parse(lesson.date + "T00:00:00Z")) ||
      new Date(lesson.date + "T00:00:00Z").toISOString().slice(0, 10) !==
        lesson.date)
  )
    throw new Error("Tarikh pengajaran tidak sah.");
  return lesson;
}
const cell = (value) =>
  String(value || "Belum diisi")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " · ");
export function renderRph(
  sections,
  template = DEFAULT_RPH_TEMPLATE,
  info = {},
) {
  const t = validateRphTemplate(template),
    lesson = validateLesson(info.lesson),
    context = info.context || {},
    values = info.values || {};
  let text = `# ${t.title}\n\n${t.subtitle}\n\n| Maklumat | Butiran |\n| --- | --- |\n`;
  for (const [key, value] of [
    ["Maktab", context.maktab],
    ["Guru", info.teacher],
    ["Subjek", values.subjek || context.subjek],
    [
      "Tingkatan / Kelas",
      lesson.className || values.tahun || context.tingkatan,
    ],
    ["Tarikh", lesson.date],
    ["Masa", lesson.time],
    ["Tempoh (minit)", values.tempoh],
    ["Bilangan pelajar", context.bilanganMurid],
  ])
    text += `| ${key} | ${cell(value)} |\n`;
  if (t.layout === "Jadual ringkasan") {
    text += "\n| Komponen | Perincian |\n| --- | --- |\n";
    for (const s of t.sections)
      text += `| ${cell(s.label)} | ${cell(sections[s.key])} |\n`;
  } else
    for (const s of t.sections)
      text += `\n## ${s.label}\n\n${sections[s.key] || "Ruangan untuk diisi guru."}\n`;
  return (
    text +
    `\n---\n\n${t.footer}\n\n*Semak fakta, standard DSKP dan kesesuaian kelas sebelum digunakan. Templat boleh suai ini bukan pengesahan format rasmi maktab.*\n`
  );
}
export function blankRph(template, info = {}) {
  return renderRph(
    Object.fromEntries(
      BASE_SECTIONS.map(([key]) => [
        key,
        key === "refleksi"
          ? "Diisi selepas PdPc: ____________________"
          : "Ruangan untuk diisi guru.",
      ]),
    ),
    template,
    info,
  );
}
