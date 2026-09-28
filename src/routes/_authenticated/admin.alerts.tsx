import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listAlertDeliveries, retryAlertDelivery, type AlertDelivery } from "@/lib/integrations.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/alerts")({
  head: () => ({ meta: [{ title: "Alert deliveries — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: AlertsPage,
});

type Status = "delivered" | "recovered" | "failed";

function AlertsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAlertDeliveries);
  const retryFn = useServerFn(retryAlertDelivery);
  const [filter, setFilter] = useState<"all" | "slack" | "email" | "failed">("all");
  const q = useQuery({ queryKey: ["alert-deliveries"], queryFn: () => listFn() });

  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: (r) => {
      r.ok ? toast.success(r.message) : toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["alert-deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Group attempts under their original delivery so retry status is visible.
  const groups = useMemo(() => {
    const rows = (q.data ?? []) as AlertDelivery[];
    const map = new Map<string, AlertDelivery[]>();
    for (const r of rows) {
      const k = r.retry_of ?? r.id;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.values()].map((attempts) => {
      attempts.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const latest = attempts[0];
      const status: Status = latest.ok ? (attempts.length > 1 ? "recovered" : "delivered") : "failed";
      return { latest, attempts, status };
    }).filter((g) =>
      filter === "all" ? true : filter === "failed" ? g.status === "failed" : g.latest.kind === filter,
    );
  }, [q.data, filter]);

  const all = (q.data ?? []) as AlertDelivery[];
  const failedNow = groups.filter((g) => g.status === "failed").length;

  if (q.isLoading) return <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (q.isError) return <div className="mt-10 text-center text-sm text-destructive">{(q.error as Error).message}</div>;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Attempts (last 200)</div><div className="text-2xl font-semibold">{all.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Delivered</div><div className="text-2xl font-semibold">{all.filter((a) => a.ok).length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Still failing</div><div className="text-2xl font-semibold text-destructive">{failedNow}</div></Card>
      </div>

      <div className="flex gap-2">
        {(["all", "slack", "email", "failed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>

      <Card className="divide-y">
        {groups.length === 0 && <p className="p-5 text-sm text-muted-foreground">No alert deliveries yet. Use "Send test alert" on the Integrations page.</p>}
        {groups.map(({ latest, attempts, status }) => (
          <div key={latest.retry_of ?? latest.id} className="p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="capitalize">{latest.kind}</Badge>
              <Badge variant={status === "failed" ? "destructive" : "secondary"} className="capitalize">{status}</Badge>
              <span className="text-muted-foreground">{latest.target ?? "—"}</span>
              <span className="ml-auto text-xs text-muted-foreground">{attempts.length} attempt{attempts.length > 1 ? "s" : ""}</span>
              {status === "failed" && latest.kind !== "notify" && (
                <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(latest.id)}>
                  <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                </Button>
              )}
            </div>
            <ul className="space-y-1 text-xs">
              {attempts.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className={a.ok ? "text-primary" : "text-destructive"}>#{a.attempt} {a.ok ? "ok" : "failed"}</span>
                  <span className="flex-1 text-muted-foreground">{a.message}</span>
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}
