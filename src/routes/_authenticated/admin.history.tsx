import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { testModel } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Loader2, Search, RefreshCw, GitCompare, X } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/history")({
  head: () => ({ meta: [{ title: "Model test history — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: HistoryPage,
});

type Row = {
  id: string;
  admin_id: string;
  model: string;
  prompt: string;
  output: string | null;
  latency_ms: number | null;
  status: number | null;
  ok: boolean;
  error_message: string | null;
  created_at: string;
};

function HistoryPage() {
  const qc = useQueryClient();
  const rerun = useServerFn(testModel);
  const [q, setQ] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [diffTarget, setDiffTarget] = useState<Row | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["model-test-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("model_test_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Row[];
    },
  });

  const rerunMutation = useMutation({
    mutationFn: async (r: Row) => rerun({ data: { model: r.model, prompt: r.prompt } }),
    onSuccess: (res, r) => {
      const ok = (res as any).ok;
      toast[ok ? "success" : "error"](
        ok ? `Re-ran ${r.model} · ${(res as any).ms}ms` : `Re-run failed: ${(res as any).message ?? "unknown error"}`,
      );
      qc.invalidateQueries({ queryKey: ["model-test-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setRerunning(null),
  });

  const rows = query.data ?? [];
  const models = useMemo(() => Array.from(new Set(rows.map((r) => r.model))), [rows]);
  const filtered = rows.filter((r) => {
    if (modelFilter && r.model !== modelFilter) return false;
    if (!q) return true;
    const hay = `${r.model} ${r.prompt} ${r.output ?? ""} ${r.error_message ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const avg = rows.filter((r) => r.ok && r.latency_ms).reduce((s, r) => s + (r.latency_ms || 0), 0) /
    Math.max(1, rows.filter((r) => r.ok && r.latency_ms).length);
  const successRate = rows.length ? Math.round((rows.filter((r) => r.ok).length / rows.length) * 100) : 0;

  // Build per-model timeseries (chronological)
  const chartData = useMemo(() => buildTimeseries(filtered, models), [filtered, models]);

  const findPrevSameModel = (r: Row): Row | undefined =>
    rows.find((x) => x.model === r.model && new Date(x.created_at).getTime() < new Date(r.created_at).getTime());

  return (
    <div className="mt-6">
      <Card className="p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Cpu className="h-5 w-5" /></div>
          <div className="flex-1 min-w-[240px]">
            <div className="font-display font-semibold">Model test history</div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Every "Test model" run from AI Model Management is logged here — track latency and success trends per model, diff runs against previous ones, and re-run any prompt with a click.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Runs" value={rows.length} />
            <Stat label="Avg latency" value={rows.length ? `${Math.round(avg)}ms` : "—"} />
            <Stat label="Success" value={`${successRate}%`} />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Latency trend (ms) by model</div>
          {chartData.buckets.length === 0 ? (
            <div className="h-56 grid place-items-center text-xs text-muted-foreground">Not enough data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {chartData.modelKeys.map((m, i) => (
                  <Line key={m} type="monotone" dataKey={`${m}__lat`} name={m} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Success rate (%) by model</div>
          {chartData.buckets.length === 0 ? (
            <div className="h-56 grid place-items-center text-xs text-muted-foreground">Not enough data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {chartData.modelKeys.map((m, i) => (
                  <Line key={m} type="monotone" dataKey={`${m}__ok`} name={m} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search prompt / output / model" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="rounded-md border border-border bg-background text-sm px-2 py-2"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
        >
          <option value="">All models</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {query.isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : query.isError ? (
        <div className="mt-10 text-sm text-destructive text-center">{(query.error as Error).message}</div>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-sm text-muted-foreground">No test runs yet — run "Test model" on the AI Model Management page.</Card>
      ) : (
        <div className="mt-4 grid gap-3">
          {filtered.map((r) => {
            const prev = findPrevSameModel(r);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={r.ok ? "secondary" : "destructive"} className="text-[10px]">
                        {r.ok ? `OK · ${r.latency_ms ?? "?"}ms` : `Failed${r.status ? ` · ${r.status}` : ""}`}
                      </Badge>
                      <code className="text-xs text-muted-foreground">{r.model}</code>
                      <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-xs">
                      <div className="font-medium text-muted-foreground">Prompt</div>
                      <div className="whitespace-pre-wrap break-words">{r.prompt}</div>
                    </div>
                    {(r.output || r.error_message) && (
                      <div className="mt-2 text-xs">
                        <div className="font-medium text-muted-foreground">{r.ok ? "Output" : "Error"}</div>
                        <pre className="whitespace-pre-wrap break-words font-sans text-muted-foreground">
                          {r.output ?? r.error_message}
                        </pre>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRerunning(r.id); rerunMutation.mutate(r); }}
                      disabled={rerunning === r.id}
                    >
                      {rerunning === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Re-run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDiffTarget(r)}
                      disabled={!prev}
                      title={prev ? `Compare with previous run of ${r.model}` : "No previous run of this model"}
                    >
                      <GitCompare className="mr-2 h-4 w-4" /> Diff
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {diffTarget && (
        <DiffModal
          current={diffTarget}
          previous={findPrevSameModel(diffTarget)!}
          onClose={() => setDiffTarget(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border px-3 py-2 min-w-[80px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display font-semibold">{value}</div>
    </div>
  );
}

const CHART_COLORS = ["#1d4ed8", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#65a30d"];

function buildTimeseries(rows: Row[], models: string[]) {
  // Chronological ascending, bucket by day.
  const asc = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const dayMap = new Map<string, Record<string, { latSum: number; latN: number; okN: number; totalN: number }>>();
  for (const r of asc) {
    const day = r.created_at.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, {});
    const bucket = dayMap.get(day)!;
    if (!bucket[r.model]) bucket[r.model] = { latSum: 0, latN: 0, okN: 0, totalN: 0 };
    const b = bucket[r.model];
    b.totalN++;
    if (r.ok) {
      b.okN++;
      if (r.latency_ms) { b.latSum += r.latency_ms; b.latN++; }
    }
  }
  const modelKeys = models;
  const buckets = Array.from(dayMap.entries()).map(([label, models]) => {
    const point: Record<string, any> = { label };
    for (const m of modelKeys) {
      const b = models[m];
      point[`${m}__lat`] = b && b.latN ? Math.round(b.latSum / b.latN) : null;
      point[`${m}__ok`] = b && b.totalN ? Math.round((b.okN / b.totalN) * 100) : null;
    }
    return point;
  });
  return { buckets, modelKeys };
}

// -------------- Diff Modal --------------

function DiffModal({ current, previous, onClose }: { current: Row; previous: Row; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="w-full max-w-6xl bg-card border border-border rounded-lg shadow-lg my-8" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-display font-semibold">Compare runs — {current.model}</div>
            <div className="text-xs text-muted-foreground">Previous → Current</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 grid gap-4">
          <ConfigDiff previous={previous} current={current} />
          <DiffPanel title="Prompt" a={previous.prompt} b={current.prompt} />
          <DiffPanel
            title={current.ok || previous.ok ? "Output" : "Error"}
            a={previous.output ?? previous.error_message ?? ""}
            b={current.output ?? current.error_message ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

function ConfigDiff({ previous, current }: { previous: Row; current: Row }) {
  const fields: Array<[string, string, string]> = [
    ["Timestamp", new Date(previous.created_at).toLocaleString(), new Date(current.created_at).toLocaleString()],
    ["Model", previous.model, current.model],
    ["Status", previous.ok ? `OK (${previous.status ?? 200})` : `Failed (${previous.status ?? "?"})`, current.ok ? `OK (${current.status ?? 200})` : `Failed (${current.status ?? "?"})`],
    ["Latency", previous.latency_ms ? `${previous.latency_ms} ms` : "—", current.latency_ms ? `${current.latency_ms} ms` : "—"],
  ];
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 text-xs font-medium">Configuration</div>
      <table className="w-full text-xs">
        <tbody>
          {fields.map(([label, a, b]) => {
            const changed = a !== b;
            return (
              <tr key={label} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground w-28">{label}</td>
                <td className={`px-3 py-2 ${changed ? "bg-destructive/10" : ""}`}>{a}</td>
                <td className={`px-3 py-2 ${changed ? "bg-primary/10 font-medium" : ""}`}>{b}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DiffPanel({ title, a, b }: { title: string; a: string; b: string }) {
  const diff = useMemo(() => diffLines(a, b), [a, b]);
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 text-xs font-medium flex justify-between">
        <span>{title}</span>
        <span className="text-muted-foreground font-normal">
          <span className="text-destructive">− {diff.removed}</span>{" "}
          <span className="text-primary">+ {diff.added}</span>
        </span>
      </div>
      <div className="grid md:grid-cols-2 divide-x divide-border">
        <DiffColumn label="Previous" lines={diff.left} tone="removed" />
        <DiffColumn label="Current" lines={diff.right} tone="added" />
      </div>
    </div>
  );
}

function DiffColumn({ label, lines, tone }: { label: string; lines: DiffLine[]; tone: "removed" | "added" }) {
  return (
    <div>
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">{label}</div>
      <pre className="text-[11px] font-mono max-h-[420px] overflow-auto">
        {lines.length === 0 ? <div className="px-3 py-2 text-muted-foreground">(empty)</div> : lines.map((l, i) => (
          <div
            key={i}
            className={
              l.type === "same"
                ? "px-3 py-0.5 whitespace-pre-wrap break-words"
                : tone === "removed"
                  ? "px-3 py-0.5 bg-destructive/10 text-destructive whitespace-pre-wrap break-words"
                  : "px-3 py-0.5 bg-primary/10 text-primary whitespace-pre-wrap break-words"
            }
          >
            <span className="opacity-50 mr-2">{l.type === "same" ? " " : tone === "removed" ? "−" : "+"}</span>
            {l.text || "\u00A0"}
          </div>
        ))}
      </pre>
    </div>
  );
}

type DiffLine = { type: "same" | "changed"; text: string };

// LCS-based line diff, small and dependency-free.
function diffLines(a: string, b: string): { left: DiffLine[]; right: DiffLine[]; added: number; removed: number } {
  const A = (a || "").split("\n");
  const B = (b || "").split("\n");
  const m = A.length, n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  let i = 0, j = 0, added = 0, removed = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      left.push({ type: "same", text: A[i] });
      right.push({ type: "same", text: B[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ type: "changed", text: A[i] });
      right.push({ type: "same", text: "" });
      removed++; i++;
    } else {
      left.push({ type: "same", text: "" });
      right.push({ type: "changed", text: B[j] });
      added++; j++;
    }
  }
  while (i < m) { left.push({ type: "changed", text: A[i] }); right.push({ type: "same", text: "" }); removed++; i++; }
  while (j < n) { left.push({ type: "same", text: "" }); right.push({ type: "changed", text: B[j] }); added++; j++; }
  return { left, right, added, removed };
}
