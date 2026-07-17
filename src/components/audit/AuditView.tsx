import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollText, Loader2, Search, Download, FileText, ChevronLeft, ChevronRight, X } from "lucide-react";
import { exportAuditCSV, exportAuditPDF, type AuditExportRow } from "@/lib/audit-export";

type Row = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: any;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  "role.grant": "Role granted",
  "role.revoke": "Role revoked",
  "model.update": "Model setting updated",
};

const PAGE_SIZE = 25;

export function AuditView({
  title = "Audit logs",
  description = "Every admin and placement officer action is recorded here — role grants and revocations, AI model configuration changes, and other privileged operations.",
  queryKey = "audit-logs",
  showActorId = true,
}: {
  title?: string;
  description?: string;
  queryKey?: string;
  showActorId?: boolean;
}) {
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const [logsRes, profilesRes] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (logsRes.error) throw logsRes.error;
      const nameMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.full_name as string]));
      return { rows: logsRes.data as Row[], names: nameMap };
    },
  });

  const rows = query.data?.rows ?? [];
  const names = query.data?.names ?? new Map<string, string>();
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))), [rows]);
  const actors = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) {
      if (r.actor_id) set.set(r.actor_id, names.get(r.actor_id) ?? r.actor_id.slice(0, 8));
    }
    return Array.from(set.entries());
  }, [rows, names]);
  const targetTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.target_type).filter(Boolean))) as string[], [rows]);

  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : -Infinity;
    const toMs = to ? new Date(to).getTime() + 86400000 : Infinity;
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      if (actionFilter && r.action !== actionFilter) return false;
      if (actorFilter && r.actor_id !== actorFilter) return false;
      if (targetFilter && r.target_type !== targetFilter) return false;
      const t = new Date(r.created_at).getTime();
      if (t < fromMs || t > toMs) return false;
      if (!needle) return true;
      const hay = `${r.action} ${r.target_type ?? ""} ${r.target_id ?? ""} ${JSON.stringify(r.metadata ?? {})} ${names.get(r.actor_id ?? "") ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, actionFilter, actorFilter, targetFilter, from, to, names]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toExportRows = (rs: Row[]): AuditExportRow[] => rs.map((r) => ({
    created_at: r.created_at,
    actor_name: names.get(r.actor_id ?? "") ?? null,
    actor_id: r.actor_id,
    actor_role: r.actor_role,
    action: r.action,
    target_type: r.target_type,
    target_id: r.target_id,
    metadata: r.metadata,
  }));

  const filtersActive = q || actionFilter || actorFilter || targetFilter || from || to;
  const clearFilters = () => {
    setQ(""); setActionFilter(""); setActorFilter(""); setTargetFilter(""); setFrom(""); setTo(""); setPage(0);
  };

  return (
    <div>
      <Card className="p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><ScrollText className="h-5 w-5" /></div>
          <div className="flex-1 min-w-[240px]">
            <div className="font-display font-semibold">{title}</div>
            <p className="text-xs text-muted-foreground max-w-2xl">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportAuditCSV(toExportRows(filtered))} disabled={!filtered.length}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportAuditPDF(toExportRows(filtered))} disabled={!filtered.length}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-3">
        <div className="grid gap-2 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search actor / target / details" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <select
            className="rounded-md border border-border bg-background text-sm px-2 py-2"
            value={actorFilter}
            onChange={(e) => { setActorFilter(e.target.value); setPage(0); }}
          >
            <option value="">All actors</option>
            {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select
            className="rounded-md border border-border bg-background text-sm px-2 py-2"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          >
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}
          </select>
          <select
            className="rounded-md border border-border bg-background text-sm px-2 py-2"
            value={targetFilter}
            onChange={(e) => { setTargetFilter(e.target.value); setPage(0); }}
          >
            <option value="">All targets</option>
            {targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="text-xs" />
          </div>
          <div className="flex items-center gap-1 md:col-start-6">
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="text-xs" />
          </div>
        </div>
        {filtersActive && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} of {rows.length} events</span>
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" /> Clear filters
            </Button>
          </div>
        )}
      </Card>

      {query.isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : query.isError ? (
        <div className="mt-10 text-sm text-destructive text-center">{(query.error as Error).message}</div>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-sm text-muted-foreground">No audit events match this filter.</Card>
      ) : (
        <>
          <Card className="mt-4 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{names.get(r.actor_id ?? "") ?? "—"}</div>
                      {r.actor_role && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.actor_role}</div>}
                      {showActorId && r.actor_id && <code className="text-[10px] text-muted-foreground break-all">{r.actor_id}</code>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-[10px]">{ACTION_LABEL[r.action] ?? r.action}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {r.target_type && <div className="text-muted-foreground">{r.target_type}</div>}
                      {r.target_id && <code className="text-[10px] break-all">{r.target_id}</code>}
                    </td>
                    <td className="px-3 py-2 max-w-md">
                      <pre className="whitespace-pre-wrap break-words font-sans text-[11px] text-muted-foreground">
                        {!r.metadata || (typeof r.metadata === "object" && Object.keys(r.metadata).length === 0) ? "—" : JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div>Page {safePage + 1} of {pageCount} · {filtered.length} events</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
