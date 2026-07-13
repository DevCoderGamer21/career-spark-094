import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlacementAnalytics } from "@/lib/placement.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap, Users, Target, Award, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/placement")({
  head: () => ({ meta: [{ title: "Placement — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: PlacementPage,
});

function PlacementPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const rolesQ = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role);
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("grant_self_role", { _role: "placement_officer" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Placement officer access granted");
      qc.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOfficer = rolesQ.data?.includes("placement_officer") || rolesQ.data?.includes("admin");

  if (rolesQ.isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Center>;

  if (!isOfficer) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <Card className="p-8 text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-primary" />
          <h1 className="mt-4 text-2xl font-display font-bold">Placement Officer workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Batch analytics, candidate readiness heatmaps, and job pipeline visibility for placement teams.
          </p>
          <Button className="mt-6 bg-primary-gradient" onClick={() => grant.mutate()} disabled={grant.isPending}>
            {grant.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Enable placement access
          </Button>
        </Card>
      </div>
    );
  }

  return <PlacementDashboard />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="p-10 flex justify-center">{children}</div>;
}

function PlacementDashboard() {
  const fn = useServerFn(getPlacementAnalytics);
  const q = useQuery({ queryKey: ["placement-analytics"], queryFn: async () => fn() });

  if (q.isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Center>;
  if (q.isError) return <Center><span className="text-sm text-destructive">{(q.error as Error).message}</span></Center>;
  const d = q.data!;
  const maxSkill = Math.max(1, ...d.topSkills.map((s) => s.count));
  const totalBucket = d.buckets.high + d.buckets.mid + d.buckets.low + d.buckets.none;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-primary font-semibold">Placement Officer</div>
      <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">Batch analytics</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} label="Candidates" value={d.totals.candidates} />
        <Kpi icon={Award} label="Analyzed resumes" value={d.totals.analyzed} />
        <Kpi icon={Target} label="Active jobs" value={d.totals.jds} />
        <Kpi icon={GraduationCap} label="Shortlisted" value={d.totals.shortlists} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="font-display font-semibold">Readiness distribution</div>
          <div className="mt-4 space-y-2">
            {[
              { k: "high", label: "Placement-ready (≥ 75)", tone: "bg-success" },
              { k: "mid", label: "Needs polishing (50–74)", tone: "bg-primary" },
              { k: "low", label: "Needs work (< 50)", tone: "bg-destructive/70" },
              { k: "none", label: "Not scored", tone: "bg-muted" },
            ].map((row) => {
              const v = (d.buckets as any)[row.k] as number;
              const pct = Math.round((v / Math.max(1, totalBucket)) * 100);
              return (
                <div key={row.k}>
                  <div className="flex justify-between text-xs">
                    <span>{row.label}</span>
                    <span className="text-muted-foreground">{v} · {pct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${row.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-display font-semibold">Top skills across candidates</div>
          <div className="mt-4 space-y-1.5">
            {d.topSkills.map((s) => (
              <div key={s.skill}>
                <div className="flex justify-between text-xs">
                  <span>{s.skill}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary-gradient" style={{ width: `${(s.count / maxSkill) * 100}%` }} />
                </div>
              </div>
            ))}
            {d.topSkills.length === 0 && <div className="text-sm text-muted-foreground">No data yet.</div>}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="font-display font-semibold">Job pipelines</div>
        <p className="text-xs text-muted-foreground">Shortlist volume per open role.</p>
        <div className="mt-4 grid gap-2">
          {d.pipeline.map((p) => (
            <div key={p.jd!.id} className="flex items-center gap-3 border-b border-border pb-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.jd!.title}</div>
                <div className="text-xs text-muted-foreground truncate">{p.jd!.company ?? "—"}</div>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">{p.count} shortlisted</Badge>
              {p.jd!.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Closed</Badge>}
            </div>
          ))}
          {d.pipeline.length === 0 && <div className="text-sm text-muted-foreground">No pipelines yet.</div>}
        </div>
      </Card>

      <Card className="mt-6 p-5 overflow-x-auto">
        <div className="font-display font-semibold">Top-ready candidates</div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs text-muted-foreground text-left">
            <tr><th className="pb-2">Name</th><th className="pb-2">College</th><th className="pb-2">Skills</th><th className="pb-2 text-right">ATS</th></tr>
          </thead>
          <tbody>
            {d.readiness.slice(0, 20).map((r, i) => (
              <tr key={r.user_id + i} className="border-t border-border">
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-muted-foreground">{r.college ?? "—"}</td>
                <td className="py-2 text-muted-foreground">{r.skills}</td>
                <td className="py-2 text-right font-mono">{r.ats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-display font-bold">{value}</div>
        </div>
      </div>
    </Card>
  );
}
