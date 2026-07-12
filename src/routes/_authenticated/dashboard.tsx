import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Upload, Target, MessageSquare, TrendingUp, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const { data: resumes } = useQuery({
    queryKey: ["resumes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("id, filename, ats_score, status, created_at, skills")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: matches } = useQuery({
    queryKey: ["matches-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jd_matches")
        .select("id, jd_title, similarity, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const latest = resumes?.[0];
  const analyzedResumes = resumes?.filter((r) => r.status === "analyzed") ?? [];
  const avgScore =
    analyzedResumes.length > 0
      ? Math.round(analyzedResumes.reduce((s, r) => s + (r.ats_score ?? 0), 0) / analyzedResumes.length)
      : 0;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Dashboard</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">Here's how your resume is performing.</p>
        </div>
        <Link to="/upload">
          <Button size="lg" className="bg-primary-gradient shadow-glow">
            <Upload className="mr-2 h-4 w-4" />
            Upload resume
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 p-6 flex flex-col items-center justify-center">
          {latest?.ats_score ? (
            <>
              <ScoreRing score={latest.ats_score} label="Latest ATS" />
              <div className="mt-4 text-sm text-muted-foreground text-center truncate max-w-full">
                {latest.filename}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-primary-gradient text-primary-foreground shadow-glow">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="mt-4 font-display font-semibold">No resume yet</div>
              <p className="text-sm text-muted-foreground mt-1">Upload one to unlock your ATS score.</p>
              <Link to="/upload">
                <Button size="sm" className="mt-4 bg-primary-gradient">Upload now</Button>
              </Link>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Overview</div>
              <h2 className="font-display font-semibold text-lg mt-1">Your career intelligence</h2>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Resumes" value={resumes?.length ?? 0} icon={FileText} />
            <Stat label="Avg ATS" value={avgScore || "—"} icon={Target} />
            <Stat label="JD matches" value={matches?.length ?? 0} icon={Sparkles} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/jd-match">
              <Card className="p-4 hover:shadow-elegant hover:-translate-y-0.5 transition-all cursor-pointer bg-hero-gradient text-primary-foreground border-0">
                <Target className="h-5 w-5" />
                <div className="mt-2 font-display font-semibold">Match to a job</div>
                <div className="text-xs opacity-80 mt-0.5">Paste a JD, get instant fit.</div>
              </Card>
            </Link>
            <Link to="/advisor">
              <Card className="p-4 hover:shadow-elegant hover:-translate-y-0.5 transition-all cursor-pointer bg-primary-gradient text-primary-foreground border-0">
                <MessageSquare className="h-5 w-5" />
                <div className="mt-2 font-display font-semibold">Ask the advisor</div>
                <div className="text-xs opacity-80 mt-0.5">Career questions, answered.</div>
              </Card>
            </Link>
          </div>
        </Card>
      </div>

      {resumes && resumes.length > 0 && (
        <Card className="mt-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Recent resumes</h2>
            <Link to="/resumes"><Button variant="ghost" size="sm">View all</Button></Link>
          </div>
          <div className="space-y-2">
            {resumes.map((r) => (
              <Link key={r.id} to="/resumes/$id" params={{ id: r.id }} className="block">
                <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()} · {r.status}
                      </div>
                    </div>
                  </div>
                  {r.ats_score != null && (
                    <div className="text-right">
                      <div className="text-2xl font-display font-bold text-primary">{r.ats_score}</div>
                      <div className="text-xs text-muted-foreground">ATS</div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-2xl font-display font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
