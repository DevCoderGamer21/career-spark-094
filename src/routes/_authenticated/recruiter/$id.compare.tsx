import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getShortlistExport } from "@/lib/export.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/recruiter/$id/compare")({
  head: () => ({ meta: [{ title: "Compare candidates — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: ComparePage,
});

type Exp = Awaited<ReturnType<typeof getShortlistExport>>;

function ComparePage() {
  const { id } = Route.useParams();
  const exportFn = useServerFn(getShortlistExport);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["shortlist-export", id],
    queryFn: async () => await exportFn({ data: { jdId: id } }),
  });

  if (q.isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Center>;
  if (q.isError) return <Center><span className="text-destructive text-sm">{(q.error as Error).message}</span></Center>;
  const data = q.data!;
  const chosen = data.candidates.filter((c) => selected.has(c.filename + c.name));

  const toggle = (key: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Union of skills across selected for heatmap columns
  const allSkills = Array.from(
    new Set([...(data.jd.required_skills ?? []), ...chosen.flatMap((c) => [...c.matched_skills, ...c.missing_skills])])
  ).slice(0, 20);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <Link to="/recruiter/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to job
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Compare shortlist</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">{data.jd.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select 2–4 candidates to view side-by-side ATS sub-scores and skill coverage.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCSV(data, chosen.length ? chosen : data.candidates)}>
              <FileDown className="mr-2 h-4 w-4" /> CSV {chosen.length ? `(${chosen.length})` : "(all)"}
            </Button>
            <Button variant="outline" onClick={() => exportPDF(data, chosen.length ? chosen : data.candidates)}>
              <FileText className="mr-2 h-4 w-4" /> PDF {chosen.length ? `(${chosen.length})` : "(all)"}
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {chosen.length ? `Exports include ${chosen.length} selected candidate(s) with ATS explanations` : "Select candidates to export a filtered set"}
          </div>
        </div>
      </div>

      {data.candidates.length === 0 && (
        <Card className="mt-8 p-10 text-center text-sm text-muted-foreground">
          No shortlisted candidates yet. Add candidates from the ranking screen first.
        </Card>
      )}

      {data.candidates.length > 0 && (
        <>
          {/* Selection list */}
          <Card className="mt-8 p-4">
            <div className="text-sm font-display font-semibold mb-3">Shortlisted ({data.candidates.length})</div>
            <div className="grid gap-2 md:grid-cols-2">
              {data.candidates.map((c) => {
                const key = c.filename + c.name;
                return (
                  <label key={key} className="flex items-center gap-3 p-2 rounded-md border border-border hover:bg-muted/30 cursor-pointer">
                    <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.headline ?? c.filename}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">Match</div>
                      <div className="font-semibold text-primary">{c.similarity}%</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          {/* Side-by-side */}
          {chosen.length >= 2 && (
            <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${chosen.length}, minmax(0,1fr))` }}>
              {chosen.map((c) => (
                <Card key={c.filename + c.name} className="p-5">
                  <div className="font-display font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.headline ?? c.filename}</div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <MetricTile label="ATS" value={c.ats_score ?? 0} />
                    <MetricTile label="Match" value={c.similarity} tone="primary" />
                  </div>
                  <SubScores breakdown={(data.candidates.find(x => x === c) as any)} rawId={c.filename} />
                  <div className="mt-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Matched ({c.matched_skills.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {c.matched_skills.slice(0, 12).map((s: string) => (
                        <Badge key={s} className="bg-success/15 text-success border-success/20 text-[10px]">{s}</Badge>
                      ))}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-3 mb-1">Missing ({c.missing_skills.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {c.missing_skills.slice(0, 12).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-[10px] border-destructive/30 text-destructive">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Skill heatmap */}
          {chosen.length >= 2 && (
            <Card className="mt-6 p-4 overflow-x-auto">
              <div className="text-sm font-display font-semibold mb-3 px-2">Skill coverage</div>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 sticky left-0 bg-card">Candidate</th>
                    {allSkills.map((s) => (
                      <th key={s} className="px-2 py-2 font-normal text-muted-foreground whitespace-nowrap">
                        <div className="rotate-[-30deg] origin-bottom-left inline-block">{s}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chosen.map((c) => (
                    <tr key={c.filename + c.name} className="border-t border-border">
                      <td className="px-3 py-2 sticky left-0 bg-card font-medium">{c.name}</td>
                      {allSkills.map((s) => {
                        const has = c.matched_skills.includes(s) || (c.skills ?? []).includes(s);
                        const miss = c.missing_skills.includes(s);
                        const bg = has ? "bg-success/70" : miss ? "bg-destructive/30" : "bg-muted/30";
                        return <td key={s} className="p-1"><div className={`h-6 rounded ${bg}`} /></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {chosen.length < 2 && (
            <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
              Select at least 2 candidates above to compare.
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="p-10 flex justify-center">{children}</div>;
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone?: "primary" }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-display font-bold ${tone === "primary" ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function SubScores({ rawId }: { breakdown: any; rawId: string }) {
  // Fetch ats_breakdown directly by filename would be complex; skip if not present.
  const q = useQuery({
    queryKey: ["res-breakdown", rawId],
    queryFn: async () => {
      const { data } = await supabase.from("resumes").select("ats_breakdown").eq("filename", rawId).limit(1).maybeSingle();
      return data?.ats_breakdown as Record<string, number> | null;
    },
  });
  const b = q.data;
  if (!b) return null;
  return (
    <div className="mt-4 space-y-1.5">
      {Object.entries(b).slice(0, 6).map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="capitalize">{k.replace(/_/g, " ")}</span>
            <span>{v}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary-gradient" style={{ width: `${Math.min(100, Number(v) || 0)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type Candidate = Exp["candidates"][number];

function atsExplanation(c: Candidate): string {
  const parts: string[] = [];
  parts.push(`ATS score: ${c.ats_score ?? "—"}. JD similarity: ${c.similarity}%.`);
  if (c.matched_skills.length) parts.push(`Strengths — matches ${c.matched_skills.length} required skill(s): ${c.matched_skills.slice(0, 10).join(", ")}.`);
  if (c.missing_skills.length) parts.push(`Gaps — missing ${c.missing_skills.length} required skill(s): ${c.missing_skills.slice(0, 10).join(", ")}.`);
  const total = c.matched_skills.length + c.missing_skills.length;
  if (total > 0) {
    const coverage = Math.round((c.matched_skills.length / total) * 100);
    parts.push(`Skill coverage of the JD's required set: ${coverage}%.`);
  }
  if (c.headline) parts.push(`Profile: ${c.headline}.`);
  return parts.join(" ");
}

function exportCSV(data: Exp, candidates: Candidate[]) {
  const headers = [
    "Name","Headline","Email","Phone","LinkedIn","GitHub","College","GraduationYear",
    "ATS","MatchPercent","MatchedSkills","MissingSkills","Status","ShortlistedAt","ATSExplanation",
  ];
  const rows = candidates.map((c) => [
    c.name, c.headline ?? "", c.email ?? "", c.phone ?? "", c.linkedin ?? "", c.github ?? "",
    c.college ?? "", c.graduation_year ?? "",
    c.ats_score ?? "", c.similarity,
    c.matched_skills.join("; "), c.missing_skills.join("; "),
    c.status, c.shortlisted_at, atsExplanation(c),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  triggerDownload(blob, `${slug(data.jd.title)}-shortlist.csv`);
  toast.success(`CSV exported (${candidates.length})`);
}

function exportPDF(data: Exp, candidates: Candidate[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 40;
  const ensureRoom = (needed: number) => {
    if (y + needed > pageH - 40) { doc.addPage(); y = 40; }
  };

  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(`Shortlist: ${data.jd.title}`, 40, y); y += 20;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100);
  doc.text([data.jd.company, data.jd.location].filter(Boolean).join(" · ") || "—", 40, y); y += 14;
  doc.text(`${candidates.length} candidate(s) · Exported ${new Date().toLocaleString()}`, 40, y); y += 20;
  doc.setTextColor(20);

  candidates.forEach((c, i) => {
    ensureRoom(90);
    doc.setDrawColor(220); doc.line(40, y, pageW - 40, y); y += 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(`${i + 1}. ${c.name}`, 40, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Match ${c.similarity}%  ·  ATS ${c.ats_score ?? "—"}`, pageW - 180, y);
    y += 14;

    doc.setTextColor(90);
    const meta = [c.headline, c.email, c.phone, c.linkedin, c.college, c.graduation_year].filter(Boolean).join(" · ");
    if (meta) {
      const lines = doc.splitTextToSize(meta, pageW - 80);
      doc.text(lines, 40, y); y += lines.length * 12;
    }
    doc.setTextColor(20);

    if (c.matched_skills.length) {
      const lines = doc.splitTextToSize("Matched skills: " + c.matched_skills.join(", "), pageW - 80);
      ensureRoom(lines.length * 12 + 4);
      doc.text(lines, 40, y); y += lines.length * 12;
    }
    if (c.missing_skills.length) {
      const lines = doc.splitTextToSize("Missing skills: " + c.missing_skills.join(", "), pageW - 80);
      ensureRoom(lines.length * 12 + 4);
      doc.text(lines, 40, y); y += lines.length * 12;
    }

    // ATS explanation section
    ensureRoom(30);
    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("ATS explanation", 40, y); y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60);
    const expLines = doc.splitTextToSize(atsExplanation(c), pageW - 80);
    ensureRoom(expLines.length * 11 + 4);
    doc.text(expLines, 40, y); y += expLines.length * 11 + 8;
    doc.setTextColor(20);
  });

  doc.save(`${slug(data.jd.title)}-shortlist.pdf`);
  toast.success(`PDF exported (${candidates.length})`);
}

function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
