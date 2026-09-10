import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listSecurityScanRuns, type ScanRun } from "@/lib/security-scans.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert, ShieldCheck, Download, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/scans")({
  head: () => ({ meta: [{ title: "Security scan history — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: ScansPage,
});

function ScansPage() {
  const listFn = useServerFn(listSecurityScanRuns);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [open, setOpen] = useState<string | null>(null);

  const runsQ = useQuery({ queryKey: ["security-scan-runs"], queryFn: async () => listFn() });

  const rows = useMemo(() => {
    const all = (runsQ.data ?? []) as ScanRun[];
    const needle = q.trim().toLowerCase();
    return all.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!needle) return true;
      return [r.branch, r.commit_sha, r.trigger, r.source, ...r.findings.map((f) => f.title)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [runsQ.data, q, statusFilter]);

  const chart = useMemo(
    () =>
      [...rows]
        .reverse()
        .slice(-40)
        .map((r) => ({
          date: new Date(r.created_at).toLocaleDateString(),
          critical: r.critical_count,
          warning: r.warning_count,
          new: r.new_findings,
        })),
    [rows],
  );

  const latest = rows[0];

  const downloadLogs = (r: ScanRun) => {
    const blob = new Blob([r.logs ?? "No log output stored for this run."], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-scan-${new Date(r.created_at).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (runsQ.isLoading) {
    return <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (runsQ.isError) {
    return <div className="mt-10 text-sm text-destructive text-center">{(runsQ.error as Error).message}</div>;
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-lg ${latest?.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {latest?.status === "failed" ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Latest run</div>
            <div className="text-lg font-display font-bold capitalize">{latest?.status ?? "No runs yet"}</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Open findings (latest)</div>
          <div className="text-2xl font-display font-bold">{latest?.total_findings ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">New since previous run</div>
          <div className="text-2xl font-display font-bold">{latest?.new_findings ?? 0}</div>
        </Card>
      </div>

      {chart.length > 0 && (
        <Card className="p-5">
          <div className="font-display font-semibold">Findings over time</div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="critical" stroke="hsl(var(--destructive))" dot={false} />
                <Line type="monotone" dataKey="warning" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="new" stroke="hsl(var(--muted-foreground))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search branch, commit, finding…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          {(["all", "passed", "failed"] as const).map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize">
              {s}
            </Button>
          ))}
          <div className="ml-auto text-xs text-muted-foreground">{rows.length} run{rows.length === 1 ? "" : "s"}</div>
        </div>

        <div className="mt-4 space-y-2">
          {rows.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No scan runs recorded yet. Runs appear here automatically after each automated check.
            </div>
          )}
          {rows.map((r) => {
            const isOpen = open === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-border">
                <button className="w-full flex flex-wrap items-center gap-3 p-3 text-left" onClick={() => setOpen(isOpen ? null : r.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Badge variant={r.status === "failed" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                  <span className="text-sm font-medium">{r.trigger}</span>
                  <span className="text-xs text-muted-foreground">{r.branch ?? "—"} · {(r.commit_sha ?? "").slice(0, 7) || "—"}</span>
                  <span className="text-xs">
                    <span className="text-destructive font-mono">{r.critical_count}</span>
                    {" / "}
                    <span className="font-mono">{r.warning_count}</span>
                    {" / "}
                    <span className="text-muted-foreground font-mono">{r.info_count}</span>
                  </span>
                  {r.new_findings > 0 && <Badge variant="destructive" className="text-[10px]">{r.new_findings} new</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadLogs(r)}>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download log
                      </Button>
                      {r.run_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={r.run_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open CI run
                          </a>
                        </Button>
                      )}
                      {r.duration_ms != null && <span className="self-center text-xs text-muted-foreground">Took {(r.duration_ms / 1000).toFixed(1)}s</span>}
                    </div>

                    {r.findings.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No findings recorded for this run.</div>
                    ) : (
                      <div className="space-y-2">
                        {r.findings.map((f, i) => (
                          <div key={f.id ?? `${f.title}-${i}`} className="rounded-md bg-muted/40 p-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={f.level === "critical" ? "destructive" : "outline"} className="text-[10px] capitalize">{f.level}</Badge>
                              <span className="text-sm font-medium">{f.title}</span>
                              {f.source && <span className="text-[10px] text-muted-foreground">{f.source}</span>}
                            </div>
                            {f.detail && <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{f.detail}</pre>}
                          </div>
                        ))}
                      </div>
                    )}

                    {r.logs && (
                      <pre className="max-h-72 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">{r.logs}</pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
