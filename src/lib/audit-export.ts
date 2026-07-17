// CSV + PDF export helpers for audit logs.
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";

export type AuditExportRow = {
  created_at: string;
  actor_name?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: unknown;
};

const fmtTs = (iso: string) => {
  const d = new Date(iso);
  // ISO with local offset, consistent across CSV/PDF.
  const pad = (n: number) => String(n).padStart(2, "0");
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const th = pad(Math.floor(Math.abs(tz) / 60));
  const tm = pad(Math.abs(tz) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${th}:${tm}`;
};

const csvCell = (v: unknown) => {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return `"${s.replace(/"/g, '""')}"`;
};

export function exportAuditCSV(rows: AuditExportRow[], fileName = "audit-logs.csv") {
  const header = ["Timestamp", "Actor", "Actor ID", "Actor role", "Action", "Target type", "Target ID", "Details"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      fmtTs(r.created_at),
      r.actor_name ?? "",
      r.actor_id ?? "",
      r.actor_role ?? "",
      r.action,
      r.target_type ?? "",
      r.target_id ?? "",
      r.metadata,
    ].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  saveAs(blob, fileName);
}

export function exportAuditPDF(rows: AuditExportRow[], fileName = "audit-logs.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Audit log export", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${rows.length} record(s) · Generated ${fmtTs(new Date().toISOString())}`, margin, y);
  y += 16;
  doc.setTextColor(0);

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (const r of rows) {
    ensure(70);
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(r.action, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    const ts = fmtTs(r.created_at);
    doc.text(ts, pageW - margin - doc.getTextWidth(ts), y);
    doc.setTextColor(0);
    y += 14;

    doc.setFontSize(9);
    const actor = `Actor: ${r.actor_name ?? "—"}${r.actor_role ? ` (${r.actor_role})` : ""}`;
    doc.text(actor, margin, y);
    y += 12;
    if (r.actor_id) {
      doc.setTextColor(140);
      doc.text(`Actor ID: ${r.actor_id}`, margin, y);
      doc.setTextColor(0);
      y += 12;
    }
    if (r.target_type || r.target_id) {
      doc.text(`Target: ${r.target_type ?? "—"}${r.target_id ? ` · ${r.target_id}` : ""}`, margin, y);
      y += 12;
    }

    if (r.metadata && (typeof r.metadata !== "object" || Object.keys(r.metadata as object).length > 0)) {
      const text = typeof r.metadata === "string" ? r.metadata : JSON.stringify(r.metadata, null, 2);
      const lines = doc.splitTextToSize(text, pageW - margin * 2);
      for (const line of lines) {
        ensure(12);
        doc.setTextColor(80);
        doc.text(line, margin, y);
        y += 11;
      }
      doc.setTextColor(0);
    }
    y += 6;
  }

  doc.save(fileName);
}
