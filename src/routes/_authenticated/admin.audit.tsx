import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollText, Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit logs — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: AuditPage,
});

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

function AuditPage() {
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const query = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const [logsRes, profilesRes] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (logsRes.error) throw logsRes.error;
      const nameMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.full_name]));
      return { rows: logsRes.data as Row[], names: nameMap };
    },
  });

  const rows = query.data?.rows ?? [];
  const names = query.data?.names ?? new Map<string, string>();
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))), [rows]);

  const filtered = rows.filter((r) => {
    if (actionFilter && r.action !== actionFilter) return false;
    if (!q) return true;
    const hay = `${r.action} ${r.target_type ?? ""} ${r.target_id ?? ""} ${JSON.stringify(r.metadata ?? {})} ${names.get(r.actor_id ?? "") ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="mt-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><ScrollText className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-semibold">Audit logs</div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Every admin and placement officer action is recorded here — role grants and revocations, AI model configuration changes, and other privileged operations.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search actor / target / details" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="rounded-md border border-border bg-background text-sm px-2 py-2"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}
        </select>
      </div>

      {query.isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : query.isError ? (
        <div className="mt-10 text-sm text-destructive text-center">{(query.error as Error).message}</div>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-sm text-muted-foreground">No audit events match this filter.</Card>
      ) : (
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
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{names.get(r.actor_id ?? "") ?? "—"}</div>
                    {r.actor_role && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.actor_role}</div>}
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
                      {formatMeta(r.metadata)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function formatMeta(m: any): string {
  if (!m || (typeof m === "object" && Object.keys(m).length === 0)) return "—";
  try {
    return JSON.stringify(m, null, 2);
  } catch {
    return String(m);
  }
}
