// Client-side PDF + DOCX export for builder resumes.
import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import type { BuilderResumeData, ResumeTemplate } from "./resume-data";

// ---------- PDF ----------

export function exportResumePDF(
  data: BuilderResumeData,
  template: ResumeTemplate,
  fileName: string,
): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const modern = template === "modern";
  const accent: [number, number, number] = modern ? [25, 118, 210] : [0, 0, 0];

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, size: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    const [r, g, b] = opts.color ?? [0, 0, 0];
    doc.setTextColor(r, g, b);
    const lines = doc.splitTextToSize(text, pageW - margin * 2) as string[];
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  const sectionHeader = (title: string) => {
    y += 8;
    ensureSpace(24);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const [r, g, b] = accent;
    doc.setTextColor(r, g, b);
    doc.text(title.toUpperCase(), margin, y);
    y += 4;
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(modern ? 1.2 : 0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setTextColor(0, 0, 0);
  };

  // Header block
  if (data.personal.fullName) {
    doc.setFontSize(modern ? 24 : 20);
    doc.setFont("helvetica", "bold");
    if (modern) {
      const [r, g, b] = accent;
      doc.setTextColor(r, g, b);
    }
    doc.text(data.personal.fullName, margin, y);
    y += modern ? 28 : 24;
    doc.setTextColor(0, 0, 0);
  }
  if (data.personal.headline) {
    writeWrapped(data.personal.headline, 11, { color: [90, 90, 90] });
  }
  const contactBits = [
    data.personal.email,
    data.personal.phone,
    data.personal.location,
    data.personal.linkedin,
    data.personal.github,
    data.personal.website,
  ].filter(Boolean);
  if (contactBits.length) {
    writeWrapped(contactBits.join("  •  "), 9, { color: [90, 90, 90] });
  }

  if (data.summary.trim()) {
    sectionHeader("Summary");
    writeWrapped(data.summary, 10);
  }

  if (data.experience.length) {
    sectionHeader("Experience");
    for (const e of data.experience) {
      ensureSpace(30);
      writeWrapped(`${e.title} — ${e.company}`, 11, { bold: true });
      const meta = [e.location, [e.start, e.end].filter(Boolean).join(" – ")]
        .filter(Boolean)
        .join(" | ");
      if (meta) writeWrapped(meta, 9, { color: [110, 110, 110] });
      for (const b of e.bullets.filter(Boolean)) {
        writeWrapped(`• ${b}`, 10);
      }
      y += 4;
    }
  }

  if (data.projects.length) {
    sectionHeader("Projects");
    for (const p of data.projects) {
      writeWrapped(`${p.name}${p.tech ? ` — ${p.tech}` : ""}`, 11, { bold: true });
      if (p.link) writeWrapped(p.link, 9, { color: [110, 110, 110] });
      if (p.description) writeWrapped(p.description, 10);
      y += 4;
    }
  }

  if (data.education.length) {
    sectionHeader("Education");
    for (const ed of data.education) {
      writeWrapped(`${ed.degree}${ed.field ? `, ${ed.field}` : ""}`, 11, { bold: true });
      const meta = [ed.institution, [ed.start, ed.end].filter(Boolean).join(" – "), ed.gpa && `GPA ${ed.gpa}`]
        .filter(Boolean)
        .join(" | ");
      if (meta) writeWrapped(meta, 9, { color: [110, 110, 110] });
      y += 4;
    }
  }

  if (data.skills.length) {
    sectionHeader("Skills");
    writeWrapped(data.skills.join(" • "), 10);
  }

  if (data.certifications.length) {
    sectionHeader("Certifications");
    for (const c of data.certifications) writeWrapped(`• ${c}`, 10);
  }

  if (data.achievements.length) {
    sectionHeader("Achievements");
    for (const a of data.achievements) writeWrapped(`• ${a}`, 10);
  }

  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

// ---------- DOCX ----------

const dividerParagraph = () =>
  new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "1976D2", space: 1 },
    },
  });

const heading = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: "1976D2" }),
    ],
  });

const line = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 20,
        color: opts.color,
      }),
    ],
  });

const bullet = (text: string) =>
  new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 20 })],
  });

export async function exportResumeDOCX(
  data: BuilderResumeData,
  template: ResumeTemplate,
  fileName: string,
): Promise<void> {
  const modern = template === "modern";

  const children: Paragraph[] = [];

  if (data.personal.fullName) {
    children.push(
      new Paragraph({
        alignment: modern ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: [
          new TextRun({
            text: data.personal.fullName,
            bold: true,
            size: modern ? 44 : 40,
            color: modern ? "0A1929" : "000000",
          }),
        ],
      }),
    );
  }
  if (data.personal.headline) {
    children.push(
      new Paragraph({
        alignment: modern ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: [new TextRun({ text: data.personal.headline, italics: true, size: 22, color: "555555" })],
      }),
    );
  }
  const contactBits = [
    data.personal.email,
    data.personal.phone,
    data.personal.location,
    data.personal.linkedin,
    data.personal.github,
    data.personal.website,
  ].filter(Boolean);
  if (contactBits.length) {
    children.push(
      new Paragraph({
        alignment: modern ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: [new TextRun({ text: contactBits.join("  |  "), size: 18, color: "555555" })],
      }),
    );
  }
  if (modern) children.push(dividerParagraph());

  if (data.summary.trim()) {
    children.push(heading("Summary"));
    children.push(line(data.summary));
  }

  if (data.experience.length) {
    children.push(heading("Experience"));
    for (const e of data.experience) {
      children.push(line(`${e.title} — ${e.company}`, { bold: true, size: 22 }));
      const meta = [e.location, [e.start, e.end].filter(Boolean).join(" – ")]
        .filter(Boolean)
        .join(" | ");
      if (meta) children.push(line(meta, { size: 18, color: "6E6E6E" }));
      for (const b of e.bullets.filter(Boolean)) children.push(bullet(b));
    }
  }

  if (data.projects.length) {
    children.push(heading("Projects"));
    for (const p of data.projects) {
      children.push(line(`${p.name}${p.tech ? ` — ${p.tech}` : ""}`, { bold: true, size: 22 }));
      if (p.link) children.push(line(p.link, { size: 18, color: "6E6E6E" }));
      if (p.description) children.push(line(p.description));
    }
  }

  if (data.education.length) {
    children.push(heading("Education"));
    for (const ed of data.education) {
      children.push(line(`${ed.degree}${ed.field ? `, ${ed.field}` : ""}`, { bold: true, size: 22 }));
      const meta = [ed.institution, [ed.start, ed.end].filter(Boolean).join(" – "), ed.gpa && `GPA ${ed.gpa}`]
        .filter(Boolean)
        .join(" | ");
      if (meta) children.push(line(meta, { size: 18, color: "6E6E6E" }));
    }
  }

  if (data.skills.length) {
    children.push(heading("Skills"));
    children.push(line(data.skills.join(" • ")));
  }
  if (data.certifications.length) {
    children.push(heading("Certifications"));
    for (const c of data.certifications) children.push(bullet(c));
  }
  if (data.achievements.length) {
    children.push(heading("Achievements"));
    for (const a of data.achievements) children.push(bullet(a));
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: modern ? "Calibri" : "Arial", size: 20 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName.endsWith(".docx") ? fileName : `${fileName}.docx`);
}
