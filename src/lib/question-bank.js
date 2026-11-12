import { parseJsonOutput } from "./rph-template.js";
export const BLOOM = [
  "Mengingat",
  "Memahami",
  "Mengaplikasi",
  "Menganalisis",
  "Menilai",
  "Mencipta",
];
export const QUESTION_TYPES = ["Objektif", "Struktur", "Esei"];
export const emptyBlueprintRow = () => ({
  topic: "",
  type: "Objektif",
  marks: 1,
  counts: [1, 0, 0, 0, 0, 0],
});
const str = (value, max, label) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${label} wajib diisi dan maksimum ${max} aksara.`);
  return value.trim();
};
const integer = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;
export function buildBlueprint(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8)
    throw new Error("JSU memerlukan 1 hingga 8 baris topik.");
  const rows = raw.map((row) => {
    const topic = str(row?.topic, 180, "Topik");
    if (
      !QUESTION_TYPES.includes(row.type) ||
      !integer(row.marks, 1, 20) ||
      (row.type === "Objektif" && row.marks !== 1)
    )
      throw new Error(
        "Jenis atau markah soalan tidak sah. Soalan objektif menggunakan 1 markah.",
      );
    if (
      !Array.isArray(row.counts) ||
      row.counts.length !== 6 ||
      row.counts.some((n) => !integer(n, 0, 20))
    )
      throw new Error(
        "Bilangan aras Bloom mestilah integer antara 0 hingga 20.",
      );
    if (row.type === "Objektif" && row.counts[5] > 0)
      throw new Error("C6 Mencipta memerlukan soalan struktur atau esei.");
    if (!row.counts.some(Boolean))
      throw new Error(
        "Setiap baris topik memerlukan sekurang-kurangnya satu soalan.",
      );
    return { topic, type: row.type, marks: row.marks, counts: [...row.counts] };
  });
  const plan = [];
  rows.forEach((row, rowIndex) =>
    row.counts.forEach((count, bloomIndex) => {
      for (let n = 0; n < count; n++)
        plan.push({
          number: plan.length + 1,
          rowIndex,
          topic: row.topic,
          type: row.type,
          marks: row.marks,
          bloom: `C${bloomIndex + 1}`,
          level: BLOOM[bloomIndex],
        });
    }),
  );
  if (plan.length > 20)
    throw new Error(
      "Had satu bank ialah 20 soalan. Pecahkan JSU kepada beberapa bank.",
    );
  return {
    rows,
    plan,
    totalQuestions: plan.length,
    totalMarks: plan.reduce((sum, q) => sum + q.marks, 0),
    bloomTotals: BLOOM.map(
      (_, i) => plan.filter((q) => q.bloom === `C${i + 1}`).length,
    ),
  };
}
export function validateQuestions(raw, blueprint) {
  if (!Array.isArray(raw) || raw.length !== blueprint.totalQuestions)
    throw new Error("Bilangan soalan tidak sepadan dengan JSU.");
  return raw.map((q, index) => {
    const item = blueprint.plan[index];
    if (!q || q.number !== item.number)
      throw new Error("Nombor dan susunan soalan tidak sepadan dengan JSU.");
    const question = {
      number: item.number,
      stem: str(q.stem, 3000, "Teks soalan"),
    };
    if (item.type === "Objektif") {
      if (
        !q.options ||
        Array.isArray(q.options) ||
        Object.keys(q.options).length !== 4
      )
        throw new Error("Soalan objektif memerlukan empat pilihan A–D.");
      question.options = Object.fromEntries(
        ["A", "B", "C", "D"].map((key) => [
          key,
          str(q.options[key], 600, "Pilihan jawapan"),
        ]),
      );
      if (
        new Set(Object.values(question.options).map((x) => x.toLowerCase()))
          .size !== 4
      )
        throw new Error("Pilihan jawapan objektif mesti berbeza.");
      if (!["A", "B", "C", "D"].includes(q.answer))
        throw new Error("Jawapan objektif mestilah A–D.");
      question.answer = q.answer;
      question.explanation =
        typeof q.explanation === "string"
          ? q.explanation.trim().slice(0, 2000)
          : "";
    } else {
      question.answer = str(q.answer, 4000, "Jawapan contoh");
      if (!Array.isArray(q.rubric) || !q.rubric.length || q.rubric.length > 20)
        throw new Error("Skema soalan subjektif memerlukan pecahan markah.");
      question.rubric = q.rubric.map((r) => {
        if (!integer(r?.marks, 1, 20))
          throw new Error("Markah rubrik tidak sah.");
        return { point: str(r.point, 1000, "Poin skema"), marks: r.marks };
      });
      if (question.rubric.reduce((sum, r) => sum + r.marks, 0) !== item.marks)
        throw new Error(
          `Jumlah rubrik soalan ${item.number} mesti ${item.marks} markah.`,
        );
    }
    return question;
  });
}
export function parseGeneratedBank(text, blueprint) {
  const raw = parseJsonOutput(text);
  return validateQuestions(raw?.questions, blueprint);
}
export function validateBank(raw) {
  if (!raw || typeof raw !== "object")
    throw new Error("Bank soalan tidak sah.");
  const blueprint = buildBlueprint(raw.rows),
    meta = raw.meta || {};
  if (!integer(meta.duration, 5, 240))
    throw new Error("Tempoh peperiksaan mestilah 5 hingga 240 minit.");
  const normalized = {
    version: 1,
    meta: {
      title: str(meta.title, 160, "Tajuk bank"),
      subject: str(meta.subject, 200, "Subjek"),
      level: str(meta.level, 100, "Tingkatan"),
      duration: meta.duration,
      instructions: str(meta.instructions, 2000, "Arahan kertas"),
      school: typeof meta.school === "string" ? meta.school.slice(0, 200) : "",
      teacher:
        typeof meta.teacher === "string" ? meta.teacher.slice(0, 100) : "",
    },
    rows: blueprint.rows,
    questions: validateQuestions(raw.questions, blueprint),
  };
  if (JSON.stringify(normalized).length > 200000)
    throw new Error("Bank soalan terlalu besar.");
  return normalized;
}
const cell = (x) =>
  String(x)
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ");
export function renderBank(raw, section = "paper") {
  const bank = validateBank(raw),
    blueprint = buildBlueprint(bank.rows),
    { meta } = bank;
  if (!["paper", "answers", "jsu"].includes(section))
    throw new Error("Bahagian bank tidak dikenali.");
  const heading =
    section === "paper"
      ? "KERTAS SOALAN"
      : section === "answers"
        ? "SKEMA JAWAPAN"
        : "JADUAL SPESIFIKASI UJIAN (JSU)";
  let text = `# ${heading}\n\n## ${meta.title}\n\n${meta.school ? `${meta.school}\n\n` : ""}**Subjek:** ${meta.subject} · **Tingkatan:** ${meta.level}\n\n**Tempoh:** ${meta.duration} minit · **Jumlah markah:** ${blueprint.totalMarks}\n\n`;
  if (section === "paper") {
    text += `**Nama:** ____________________  **Kelas:** __________\n\n**Arahan:** ${meta.instructions}\n\n`;
    for (const q of bank.questions) {
      const item = blueprint.plan[q.number - 1];
      text += `## Soalan ${q.number} (${item.marks} markah)\n\n${q.stem}\n\n`;
      if (item.type === "Objektif")
        for (const key of ["A", "B", "C", "D"])
          text += `${key}. ${q.options[key]}\n\n`;
      else
        text +=
          "Jawapan: ____________________________________________________\n\n____________________________________________________________\n\n";
    }
  } else if (section === "answers") {
    text +=
      "**Untuk kegunaan guru sahaja.** Skema ialah cadangan yang perlu disemak.\n\n";
    for (const q of bank.questions) {
      const item = blueprint.plan[q.number - 1];
      text += `## Soalan ${q.number} · ${item.marks} markah · ${item.bloom} ${item.level}\n\n**Topik:** ${item.topic}\n\n**Jawapan:** ${q.answer}\n\n`;
      if (q.explanation) text += q.explanation + "\n\n";
      if (q.rubric) {
        text += "| Poin pemarkahan | Markah |\n| --- | ---: |\n";
        for (const r of q.rubric) text += `| ${cell(r.point)} | ${r.marks} |\n`;
        text += "\n";
      }
    }
  } else {
    text +=
      "*Bilangan dan markah dikira daripada pelan guru, bukan anggaran AI. Aras Bloom bukan pengesahan aras kesukaran atau format rasmi.*\n\n| Topik | Jenis | C1 | C2 | C3 | C4 | C5 | C6 | Bil. | Markah |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n";
    for (const row of blueprint.rows) {
      const count = row.counts.reduce((a, b) => a + b, 0);
      text += `| ${cell(row.topic)} | ${row.type} | ${row.counts.join(" | ")} | ${count} | ${count * row.marks} |\n`;
    }
    text += `| **Jumlah** | | ${blueprint.bloomTotals.join(" | ")} | **${blueprint.totalQuestions}** | **${blueprint.totalMarks}** |\n\n| No. soalan | Topik | Aras Bloom | Jenis | Markah |\n| --- | --- | --- | --- | ---: |\n`;
    for (const q of blueprint.plan)
      text += `| ${q.number} | ${cell(q.topic)} | ${q.bloom} ${q.level} | ${q.type} | ${q.marks} |\n`;
  }
  return text;
}

export function renderJsuPlan(meta, rows) {
  const b = buildBlueprint(rows);
  if (!meta.title?.trim() || !meta.subject?.trim())
    throw new Error("Isi tajuk dan subjek untuk mengeksport JSU.");
  let text = `# JADUAL SPESIFIKASI UJIAN (JSU)\n\n## ${meta.title}\n\n**Subjek:** ${meta.subject} · **Tingkatan:** ${meta.level}\n\n*Pelan guru; jumlah dikira sistem. Aras Bloom bukan aras kesukaran atau format rasmi.*\n\n| Topik | Jenis | C1 | C2 | C3 | C4 | C5 | C6 | Bil. | Markah |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  for (const row of b.rows) {
    const count = row.counts.reduce((a, c) => a + c, 0);
    text += `| ${cell(row.topic)} | ${row.type} | ${row.counts.join(" | ")} | ${count} | ${count * row.marks} |\n`;
  }
  text += `| **Jumlah** | | ${b.bloomTotals.join(" | ")} | **${b.totalQuestions}** | **${b.totalMarks}** |\n\n| No. soalan | Topik | Aras Bloom | Markah |\n| --- | --- | --- | ---: |\n`;
  for (const q of b.plan)
    text += `| ${q.number} | ${cell(q.topic)} | ${q.bloom} ${q.level} | ${q.marks} |\n`;
  return text;
}
