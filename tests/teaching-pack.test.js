import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { buildDocx } from "../src/lib/docx-export.js";
import { safeFilename } from "../src/lib/export.js";
import {
  DEFAULT_RPH_TEMPLATE,
  validateRphTemplate,
  validateLesson,
  parseGeneratedRph,
  renderRph,
  blankRph,
} from "../src/lib/rph-template.js";
import {
  buildBlueprint,
  validateQuestions,
  parseGeneratedBank,
  validateBank,
  renderBank,
  renderJsuPlan,
} from "../src/lib/question-bank.js";
import { prepareGeneration } from "../server/generation.js";
const rows = [
  { topic: "Algebra", type: "Objektif", marks: 1, counts: [1, 1, 0, 0, 0, 0] },
  {
    topic: "Penaakulan",
    type: "Struktur",
    marks: 3,
    counts: [0, 0, 1, 0, 0, 0],
  },
];
const questions = [
  {
    number: 1,
    stem: "Pilih ungkapan algebra.",
    options: { A: "x + 2", B: "4", C: "5", D: "6" },
    answer: "A",
    explanation: "RAHSIA-SKEMA-OBJEKTIF",
  },
  {
    number: 2,
    stem: "Pilih hasil ringkasan.",
    options: { A: "x", B: "2x", C: "3x", D: "4x" },
    answer: "B",
    explanation: "Penerangan guru.",
  },
  {
    number: 3,
    stem: "Selesaikan persamaan dengan langkah kerja.",
    answer: "RAHSIA-SKEMA-SUBJEKTIF",
    rubric: [
      { point: "Kaedah tepat", marks: 1 },
      { point: "Hasil tepat", marks: 2 },
    ],
  },
];
const meta = {
  title: "Ujian Algebra",
  subject: "Matematik",
  level: "Tingkatan 4",
  duration: 60,
  instructions: "Jawab semua soalan.",
  school: "MRSM Ujian",
  teacher: "Cikgu",
};
const bank = { version: 1, meta, rows, questions };
const sections = Object.fromEntries(
  DEFAULT_RPH_TEMPLATE.sections.map((s) => [
    s.key,
    s.key === "refleksi"
      ? "Diisi selepas PdPc: ____________________"
      : `Isi ${s.key} untuk guru.`,
  ]),
);
const clone = (value) => structuredClone(value);

test("JSU assigns contiguous numbers, cognitive levels and exact marks", () => {
  const result = buildBlueprint(rows);
  assert.equal(result.totalQuestions, 3);
  assert.equal(result.totalMarks, 5);
  assert.deepEqual(result.bloomTotals, [1, 1, 1, 0, 0, 0]);
  assert.deepEqual(
    result.plan.map((q) => [q.number, q.bloom, q.marks]),
    [
      [1, "C1", 1],
      [2, "C2", 1],
      [3, "C3", 3],
    ],
  );
});
for (const [name, change] of [
  ["zero questions", (r) => r[0].counts.fill(0)],
  ["negative count", (r) => (r[0].counts[0] = -1)],
  ["fractional count", (r) => (r[0].counts[0] = 1.5)],
  ["too many", (r) => (r[0].counts[0] = 20)],
  ["objective marks", (r) => (r[0].marks = 2)],
  ["objective creation", (r) => (r[0].counts[5] = 1)],
])
  test(`JSU rejects ${name}`, () => {
    const data = clone(rows);
    change(data);
    assert.throws(() => buildBlueprint(data));
  });
test("invalid blueprint never reaches model preparation", () => {
  assert.throws(() =>
    prepareGeneration({
      toolId: "bank-soalan-jsu",
      values: { subjek: "Matematik", blueprint: "invalid" },
    }),
  );
  assert.throws(() =>
    prepareGeneration({
      toolId: "bank-soalan-jsu",
      values: { subjek: "Matematik", blueprint: "[]" },
    }),
  );
  const value = prepareGeneration({
    toolId: "bank-soalan-jsu",
    values: {
      subjek: "Matematik",
      tingkatan: "Tingkatan 4",
      blueprint: JSON.stringify(rows),
    },
  });
  assert.equal(value.blueprint.totalMarks, 5);
  assert.ok(value.prompt.includes("PELAN JSU DISAHKAN"));
  assert.ok(value.systemPrompt.includes("JSON sahaja"));
});
test("bank requires exact count, order and four distinct options", () => {
  const p = buildBlueprint(rows);
  assert.equal(parseGeneratedBank(JSON.stringify({ questions }), p).length, 3);
  assert.throws(() => validateQuestions(questions.slice(1), p));
  const bad = clone(questions);
  bad[1].number = 3;
  assert.throws(() => validateQuestions(bad, p));
  bad[1].number = 2;
  bad[0].options.B = bad[0].options.A;
  assert.throws(() => validateQuestions(bad, p));
});
test("rubric points must add to planned marks", () => {
  const bad = clone(questions);
  bad[2].rubric[1].marks = 1;
  assert.throws(() => validateQuestions(bad, buildBlueprint(rows)));
});
test("invalid question content and answer rejected", () => {
  for (const mutate of [
    (q) => (q[0].answer = "E"),
    (q) => (q[1].stem = ""),
    (q) => (q[2].rubric = []),
    (q) => (q[2].rubric[0].marks = 0),
  ]) {
    const data = clone(questions);
    mutate(data);
    assert.throws(() => validateQuestions(data, buildBlueprint(rows)));
  }
});
test("saved bank normalized, bounded and independent of forged metadata", () => {
  const value = validateBank(bank);
  assert.equal(value.rows.length, 2);
  const bad = clone(bank);
  bad.meta.duration = 0;
  assert.throws(() => validateBank(bad));
  const forged = clone(questions);
  forged[0].marks = 99;
  assert.equal(
    validateQuestions(forged, buildBlueprint(rows))[0].marks,
    undefined,
  );
});
test("student paper excludes all answer and rubric fields", () => {
  const paper = renderBank(bank, "paper");
  assert.ok(paper.includes("x + 2"));
  assert.ok(!paper.includes("RAHSIA-SKEMA"));
  assert.ok(!paper.includes("Kaedah tepat"));
  assert.ok(!paper.includes("Skema"));
  assert.ok(renderBank(bank, "answers").includes("RAHSIA-SKEMA-SUBJEKTIF"));
  assert.ok(renderBank(bank, "answers").includes("Kaedah tepat"));
});
test("JSU export contains deterministic totals and mappings, never answers", () => {
  const content = renderBank(bank, "jsu");
  assert.ok(content.includes("**3**"));
  assert.ok(content.includes("**5**"));
  assert.ok(content.includes("C3 Mengaplikasi"));
  assert.ok(!content.includes("RAHSIA-SKEMA"));
  assert.ok(renderJsuPlan(meta, rows).includes("**5**"));
});
test("RPH template keeps all mandatory sections, unique labels and order", () => {
  const t = clone(DEFAULT_RPH_TEMPLATE);
  t.sections.reverse();
  t.sections[0].label = "Refleksi selepas kelas";
  assert.equal(validateRphTemplate(t).sections[0].key, "refleksi");
  t.sections.pop();
  assert.throws(() => validateRphTemplate(t));
  const d = clone(DEFAULT_RPH_TEMPLATE);
  d.sections[1].label = d.sections[0].label;
  assert.throws(() => validateRphTemplate(d));
});
test("RPH template rejects injected multiline or HTML headings", () => {
  for (const title of ["<script>x</script>", "A\nB", "| table |", ""])
    assert.throws(() =>
      validateRphTemplate({ ...DEFAULT_RPH_TEMPLATE, title }),
    );
});
test("RPH session validates real dates including leap years", () => {
  assert.equal(validateLesson({ date: "2028-02-29" }).date, "2028-02-29");
  for (const date of ["2026-02-29", "2026-13-10", "not-a-date"])
    assert.throws(() => validateLesson({ date }));
  assert.throws(() => validateLesson(null));
});
test("RPH structured response requires all teaching sections", () => {
  assert.deepEqual(
    parseGeneratedRph("```json\n" + JSON.stringify({ sections }) + "\n```"),
    sections,
  );
  const bad = { ...sections };
  delete bad.aktiviti;
  assert.throws(() => parseGeneratedRph(JSON.stringify({ sections: bad })));
  assert.throws(() => parseGeneratedRph("# Plain text"));
});
test("RPH renders custom section order and deterministic teacher metadata", () => {
  const t = clone(DEFAULT_RPH_TEMPLATE);
  t.title = "RPH MAKTAB CIKGU";
  [t.sections[0], t.sections[1]] = [t.sections[1], t.sections[0]];
  const text = renderRph(sections, t, {
    teacher: "Guru Ujian",
    context: { maktab: "MRSM | Contoh", bilanganMurid: "30" },
    values: { subjek: "Matematik", tahun: "Tingkatan 4", tempoh: "60" },
    lesson: { date: "2026-11-12", time: "8–9 pagi", className: "4 Bestari" },
  });
  assert.ok(text.startsWith("# RPH MAKTAB"));
  assert.ok(text.indexOf("## Objektif") < text.indexOf("## Standard"));
  assert.ok(text.includes("MRSM \\| Contoh"));
  assert.ok(text.includes("4 Bestari"));
  assert.ok(text.includes("2026-11-12"));
  assert.ok(!text.includes("undefined"));
});
test("RPH table and blank template work without an AI request", () => {
  const content = blankRph({
    ...DEFAULT_RPH_TEMPLATE,
    layout: "Jadual ringkasan",
  });
  assert.ok(content.includes("| Komponen |"));
  assert.ok(content.includes("Diisi selepas PdPc"));
});
test("server prepares structured RPH only for explicit template requests", () => {
  const values = { subjek: "Matematik", tahun: "Tingkatan 4" };
  assert.equal(
    prepareGeneration({ toolId: "rph-kssm", values }).rphTemplate,
    null,
  );
  const value = prepareGeneration({
    toolId: "rph-kssm",
    values,
    rphTemplate: DEFAULT_RPH_TEMPLATE,
    lesson: { date: "2026-11-12" },
  });
  assert.ok(value.systemPrompt.includes("## GK_STANDARD"));
  assert.equal(value.rphTemplate.title, DEFAULT_RPH_TEMPLATE.title);
  assert.throws(() =>
    prepareGeneration({
      toolId: "rph-kssm",
      values,
      rphTemplate: { title: "bad" },
    }),
  );
});
test("DOCX contains editable headings, tables, lists, Unicode and page numbering", async () => {
  const blob = await buildDocx(
    "# Ujian Cikgu 🌙\n\n**Tebal** dan *condong*, x < y & z.\n\n1. Langkah satu\n2. Langkah dua\n\n| Topik | Markah |\n| --- | ---: |\n| Algebra | 5 |",
    { title: "Ujian Cikgu" },
  );
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer())),
    xml = strFromU8(files["word/document.xml"]);
  assert.ok(files["[Content_Types].xml"]);
  assert.ok(xml.includes("<w:tbl>"));
  assert.ok(xml.includes("Langkah satu"));
  assert.ok(xml.includes("Heading1"));
  assert.ok(xml.includes("🌙"));
  assert.ok(xml.includes("&lt;"));
  assert.ok(xml.includes("&amp;"));
  assert.ok(files["word/numbering.xml"]);
  assert.ok(Object.keys(files).some((k) => k.startsWith("word/footer")));
});
test("DOCX does not embed raw HTML, images, scripts or active external links", async () => {
  const blob = await buildDocx(
    "Tex selamat\n\n<script>RAHSIA-HTML</script>\n\n![foto](https://example.invalid/image.png)\n\n[Pautan](javascript:alert(1))",
  );
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer())),
    xml = strFromU8(files["word/document.xml"]);
  assert.ok(!xml.includes("RAHSIA-HTML"));
  assert.ok(!Object.keys(files).some((k) => k.startsWith("word/media/")));
  assert.ok(
    !Object.values(files).some((value) =>
      strFromU8(value).includes("javascript:"),
    ),
  );
});
test("Word exports preserve paper/key separation at OOXML level", async () => {
  for (const section of ["paper", "answers", "jsu"]) {
    const blob = await buildDocx(renderBank(bank, section));
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer())),
      xml = strFromU8(files["word/document.xml"]);
    assert.equal(xml.includes("RAHSIA-SKEMA-SUBJEKTIF"), section === "answers");
  }
});
test("Word export rejects empty input and sanitizes filenames", async () => {
  await assert.rejects(() => buildDocx(""));
  assert.equal(safeFilename("CON"), "Dokumen GuruKit");
  assert.ok(!/[<>:"/\\|?*]/.test(safeFilename("A/B:C*D?")));
  assert.equal(safeFilename("RPH Matematik"), "RPH Matematik");
});

test("wide JSU tables export as landscape A4", async () => {
  const blob = await buildDocx(renderBank(bank, "jsu"));
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(
    strFromU8(files["word/document.xml"]).includes('w:orient="landscape"'),
  );
});

test("RPH never fabricates post-lesson reflection and allows model to omit it", () => {
  const data = structuredClone(sections);
  delete data.refleksi;
  assert.ok(
    parseGeneratedRph(JSON.stringify({ sections: data })).refleksi.includes(
      "Diisi selepas PdPc",
    ),
  );
  data.refleksi = "Semua pelajar telah berjaya";
  assert.ok(
    !parseGeneratedRph(JSON.stringify({ sections: data })).refleksi.includes(
      "Semua pelajar",
    ),
  );
});

test("Markdown RPH machine sections are mapped to custom labels", () => {
  const text = Object.entries(sections)
    .filter(([key]) => key !== "refleksi")
    .map(([key, value]) => `## GK_${key.toUpperCase()}\n${value}`)
    .join("\n\n");
  const parsed = parseGeneratedRph(text);
  assert.equal(parsed.aktiviti, sections.aktiviti);
  assert.ok(parsed.refleksi.includes("Diisi selepas PdPc"));
  assert.throws(() => parseGeneratedRph(text + "\n## GK_STANDARD\nduplicate"));
});
