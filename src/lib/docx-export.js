import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  AlignmentType,
  LevelFormat,
  Footer,
  PageNumber,
  TableLayoutType,
  BorderStyle,
  PageOrientation,
} from "docx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
const clean = (value) =>
  String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
function runs(node, style = {}) {
  if (
    node.type === "html" ||
    node.type === "image" ||
    node.type === "imageReference"
  )
    return [];
  if (node.type === "break") return [new TextRun({ break: 1 })];
  if (node.type === "text" || node.type === "inlineCode")
    return [
      new TextRun({
        text: clean(node.value),
        ...style,
        ...(node.type === "inlineCode" ? { font: "Consolas" } : {}),
      }),
    ];
  const next = {
    ...style,
    ...(node.type === "strong" ? { bold: true } : {}),
    ...(node.type === "emphasis" ? { italics: true } : {}),
    ...(node.type === "delete" ? { strike: true } : {}),
  };
  return (node.children || []).flatMap((child) => runs(child, next));
}
export async function buildDocx(content, { title = "Dokumen GuruKit" } = {}) {
  if (typeof content !== "string" || !content.trim() || content.length > 200000)
    throw new Error("Kandungan eksport kosong atau terlalu besar.");
  const root = unified().use(remarkParse).use(remarkGfm).parse(content),
    numbering = [];
  const landscape = root.children.some(
    (node) => node.type === "table" && node.children[0]?.children.length >= 8,
  );
  const pageWidth = landscape ? 16838 : 11906;
  const pageHeight = landscape ? 11906 : 16838;
  let listId = 0;
  function blocks(nodes, depth = 0) {
    return nodes.flatMap((node) => {
      if (
        node.type === "html" ||
        node.type === "image" ||
        node.type === "definition"
      )
        return [];
      if (node.type === "paragraph")
        return [
          new Paragraph({ children: runs(node), spacing: { after: 140 } }),
        ];
      if (node.type === "heading")
        return [
          new Paragraph({
            children: runs(node),
            heading: [
              HeadingLevel.HEADING_1,
              HeadingLevel.HEADING_2,
              HeadingLevel.HEADING_3,
              HeadingLevel.HEADING_4,
              HeadingLevel.HEADING_5,
              HeadingLevel.HEADING_6,
            ][node.depth - 1],
            spacing: { before: 200, after: 120 },
            keepNext: true,
          }),
        ];
      if (node.type === "code")
        return clean(node.value)
          .split("\n")
          .map(
            (line) =>
              new Paragraph({
                children: [
                  new TextRun({ text: line, font: "Consolas", size: 20 }),
                ],
                shading: { fill: "F4F0F7" },
                spacing: { after: 40 },
              }),
          );
      if (node.type === "blockquote")
        return node.children.flatMap((child) =>
          child.type === "paragraph"
            ? [
                new Paragraph({
                  children: runs(child, { italics: true }),
                  indent: { left: 360 },
                  border: {
                    left: {
                      color: "AA8BC6",
                      size: 12,
                      style: BorderStyle.SINGLE,
                    },
                  },
                  spacing: { after: 120 },
                }),
              ]
            : blocks([child], depth + 1),
        );
      if (node.type === "thematicBreak")
        return [
          new Paragraph({
            border: {
              bottom: { color: "D7C7E2", size: 4, style: BorderStyle.SINGLE },
            },
            spacing: { after: 180 },
          }),
        ];
      if (node.type === "list") {
        const reference = `list-${++listId}`,
          level = Math.min(depth, 8);
        numbering.push({
          reference,
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: node.ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: node.ordered ? `%${i + 1}.` : "•",
            start: node.start || 1,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 720 * (i + 1), hanging: 260 } },
            },
          })),
        });
        return node.children.flatMap((item) => {
          let first = true;
          return item.children.flatMap((child) => {
            if (child.type === "paragraph") {
              const result = new Paragraph({
                children: runs(child),
                ...(first
                  ? { numbering: { reference, level } }
                  : { indent: { left: 720 * (level + 1) } }),
                spacing: { after: 90 },
              });
              first = false;
              return [result];
            }
            return blocks([child], depth + 1);
          });
        });
      }
      if (node.type === "table")
        return [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            columnWidths: Array(node.children[0].children.length).fill(
              Math.floor((pageWidth - 2268) / node.children[0].children.length),
            ),
            rows: node.children.map(
              (row, index) =>
                new TableRow({
                  tableHeader: index === 0,
                  children: row.children.map(
                    (cell) =>
                      new TableCell({
                        shading: index === 0 ? { fill: "EEE5F5" } : undefined,
                        margins: {
                          top: 100,
                          bottom: 100,
                          left: 110,
                          right: 110,
                        },
                        children: [
                          new Paragraph({
                            children: runs(cell, { bold: index === 0 }),
                            spacing: { after: 60 },
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          }),
          new Paragraph({ spacing: { after: 100 } }),
        ];
      return node.children ? blocks(node.children, depth) : [];
    });
  }
  const children = blocks(root.children);
  const document = new Document({
    creator: "GuruKit",
    title: clean(title).slice(0, 160),
    description: "Dokumen boleh sunting untuk semakan guru.",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, color: "49355D" },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, color: "49355D" },
        },
      ],
    },
    numbering: { config: numbering },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidth,
              height: pageHeight,
              orientation: landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "GuruKit · Halaman ", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}
