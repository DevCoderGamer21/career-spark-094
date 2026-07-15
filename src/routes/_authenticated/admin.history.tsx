import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Cpu, Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";

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
  const [q, setQ] = useState("");
  const [modelFilter, setModelFilter] = useState<string>("");

  const query = useQuery({
    queryKey: ["model-test-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("model_test_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Row[];
    },
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

  return (
    <div className="mt-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Cpu className="h-5 w-5" /></div>
          <div className="flex-1">
            <div className="font-display font-semibold">Model test history</div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Every "Test model" run from AI Model Management is logged here — prompt, output, latency, and error responses — so you can compare providers over time.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Runs" value={rows.length} />
            <Stat label="Avg latency" value={rows.length ? `${Math.round(avg)}ms` : "—"} />
            <Stat label="Success" value={`${successRate}%`} />
          </div>
        </div>
      </Card>

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
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
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
              </div>
            </Card>
          ))}
        </div>
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
