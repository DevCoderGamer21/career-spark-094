import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminAnalytics, listUsersWithRoles, setUserRole } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Users, FileText, Briefcase, Star, Cpu, ScrollText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: AdminShell,
});

function AdminShell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const rolesQ = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role);
    },
  });

  const anyAdminQ = useQuery({
    queryKey: ["any-admin"],
    queryFn: async () => {
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
      return (count ?? 0) > 0;
    },
  });

  const claim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("claim_first_admin");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You are now the admin");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (rolesQ.isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Center>;

  const isAdmin = rolesQ.data?.includes("admin");

  if (!isAdmin) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <Card className="p-8 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto text-primary" />
          <h1 className="mt-4 text-2xl font-display font-bold">Admin console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            System analytics, user role management, and AI model configuration.
          </p>
          {anyAdminQ.data === false ? (
            <>
              <p className="mt-4 text-xs text-muted-foreground">No admin exists yet. Claim this workspace as the first admin.</p>
              <Button className="mt-4 bg-primary-gradient" onClick={() => claim.mutate()} disabled={claim.isPending}>
                {claim.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Claim admin access
              </Button>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">An admin has already been assigned. Ask them to grant you admin access.</p>
          )}
        </Card>
      </div>
    );
  }

  const isRoot = pathname === "/admin" || pathname === "/admin/";
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Admin</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">System console</h1>
        </div>
        <nav className="flex gap-2">
          <Button asChild size="sm" variant={isRoot ? "default" : "outline"}><Link to="/admin">Overview</Link></Button>
          <Button asChild size="sm" variant={pathname.startsWith("/admin/models") ? "default" : "outline"}>
            <Link to="/admin/models"><Cpu className="mr-1.5 h-3.5 w-3.5" /> AI models</Link>
          </Button>
        </nav>
      </div>
      {isRoot ? <AdminOverview /> : <Outlet />}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="p-10 flex justify-center">{children}</div>;
}

function AdminOverview() {
  const analyticsFn = useServerFn(getAdminAnalytics);
  const usersFn = useServerFn(listUsersWithRoles);
  const setRoleFn = useServerFn(setUserRole);
  const qc = useQueryClient();

  const a = useQuery({ queryKey: ["admin-analytics"], queryFn: async () => analyticsFn() });
  const u = useQuery({ queryKey: ["admin-users"], queryFn: async () => usersFn() });

  const roleMut = useMutation({
    mutationFn: async (v: { userId: string; role: "admin" | "candidate" | "recruiter" | "placement_officer"; grant: boolean }) =>
      setRoleFn({ data: v }),
    onSuccess: () => {
      toast.success("Roles updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (a.isLoading) return <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (a.isError) return <div className="mt-10 text-sm text-destructive text-center">{(a.error as Error).message}</div>;
  const d = a.data!;
  const maxDay = Math.max(1, ...d.timeline.map((t) => t.count));

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} label="Users" value={d.totals.users} />
        <Kpi icon={FileText} label={`Resumes (${d.totals.analyzed} analyzed)`} value={d.totals.resumes} />
        <Kpi icon={Briefcase} label={`Jobs (${d.totals.activeJds} active)`} value={d.totals.jds} />
        <Kpi icon={Star} label={`Avg ATS ${d.totals.avgAts}`} value={d.totals.shortlists} sub="shortlists" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="font-display font-semibold">Resumes uploaded (30 days)</div>
          <div className="mt-4 flex items-end gap-1 h-32">
            {d.timeline.map((t) => (
              <div key={t.date} className="flex-1 flex items-end" title={`${t.date}: ${t.count}`}>
                <div className="w-full bg-primary/60 rounded-t" style={{ height: `${(t.count / maxDay) * 100}%` }} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-display font-semibold">Roles</div>
          <div className="mt-4 space-y-2">
            {Object.entries(d.roleCounts).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between text-sm">
                <span className="capitalize">{role.replace(/_/g, " ")}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
            {Object.keys(d.roleCounts).length === 0 && <div className="text-sm text-muted-foreground">No roles yet.</div>}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5 overflow-x-auto">
        <div className="font-display font-semibold flex items-center gap-2"><ScrollText className="h-4 w-4" /> Recent uploads</div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs text-muted-foreground text-left">
            <tr><th className="pb-2">File</th><th className="pb-2">Status</th><th className="pb-2">ATS</th><th className="pb-2">When</th></tr>
          </thead>
          <tbody>
            {d.recentResumes.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2 truncate max-w-[240px]">{r.filename}</td>
                <td className="py-2"><Badge variant="outline" className="text-[10px]">{r.status}</Badge></td>
                <td className="py-2 font-mono">{r.ats_score ?? "—"}</td>
                <td className="py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6 p-5 overflow-x-auto">
        <div className="font-display font-semibold">Users & roles</div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs text-muted-foreground text-left">
            <tr><th className="pb-2">Name</th><th className="pb-2">Headline</th><th className="pb-2">Roles</th><th className="pb-2 text-right">Manage</th></tr>
          </thead>
          <tbody>
            {(u.data ?? []).map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2">{p.full_name ?? "—"}</td>
                <td className="py-2 text-muted-foreground truncate max-w-[240px]">{p.headline ?? "—"}</td>
                <td className="py-2"><div className="flex flex-wrap gap-1">
                  {(p.roles as string[]).map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                  ))}
                </div></td>
                <td className="py-2 text-right space-x-1">
                  {(["recruiter", "placement_officer", "admin"] as const).map((role) => {
                    const has = (p.roles as string[]).includes(role);
                    return (
                      <Button
                        key={role}
                        size="sm"
                        variant={has ? "secondary" : "outline"}
                        className="text-[10px] h-7"
                        disabled={roleMut.isPending}
                        onClick={() => roleMut.mutate({ userId: p.id, role, grant: !has })}
                      >
                        {has ? "− " : "+ "}{role.slice(0, 3)}
                      </Button>
                    );
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground truncate">{label}</div>
          <div className="text-2xl font-display font-bold">{value}{sub && <span className="text-xs text-muted-foreground ml-1">{sub}</span>}</div>
        </div>
      </div>
    </Card>
  );
}
