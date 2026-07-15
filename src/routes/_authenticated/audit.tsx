import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit logs — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const list = (roles ?? []).map((r) => r.role);
    if (list.includes("admin")) throw redirect({ to: "/admin/audit" });
    if (!list.includes("placement_officer")) throw redirect({ to: "/dashboard" });
  },
  component: PlacementAuditPage,
});

// Re-uses the same UI as admin.audit.tsx but accessible to placement officers.
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollText, Loader2, Search, ArrowLeft } from "lucide-react";
import { useState, useMemo } from "react";

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

function PlacementAuditPage() {
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const query = useQuery({
    queryKey: ["audit-logs-placement"],
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
    const hay = `${r.action} ${r.target_type ?? ""} ${JSON.stringify(r.metadata ?? {})} ${names.get(r.actor_id ?? "") ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <Link to="/placement" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to placement
      </Link>
      <Card className="p-5 mt-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><ScrollText className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-semibold">Audit logs</div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Records of privileged actions performed by admins and placement officers across the platform.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search actor / target / details" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="rounded-md border border-border bg-background text-sm px-2 py-2" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}
        </select>
      </div>

      {query.isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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
                  <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{ACTION_LABEL[r.action] ?? r.action}</Badge></td>
                  <td className="px-3 py-2 max-w-md">
                    <pre className="whitespace-pre-wrap break-words font-sans text-[11px] text-muted-foreground">
                      {(!r.metadata || Object.keys(r.metadata).length === 0) ? "—" : JSON.stringify(r.metadata, null, 2)}
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
