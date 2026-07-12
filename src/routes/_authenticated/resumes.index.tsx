import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/resumes/")({
  head: () => ({ meta: [{ title: "My Resumes — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: ResumesPage,
});

function ResumesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["resumes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("id, filename, ats_score, status, created_at, skills")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Resumes</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">My resumes</h1>
        </div>
        <Link to="/upload">
          <Button className="bg-primary-gradient"><Upload className="mr-2 h-4 w-4" />Upload new</Button>
        </Link>
      </div>

      {isLoading && <div className="mt-8 text-muted-foreground text-sm">Loading...</div>}
      {!isLoading && (!data || data.length === 0) && (
        <Card className="mt-8 p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <div className="mt-3 font-display font-semibold">No resumes yet</div>
          <p className="text-sm text-muted-foreground mt-1">Upload your first resume to get started.</p>
          <Link to="/upload"><Button className="mt-4 bg-primary-gradient">Upload resume</Button></Link>
        </Card>
      )}

      <div className="mt-8 space-y-3">
        {data?.map((r) => (
          <Link key={r.id} to="/resumes/$id" params={{ id: r.id }}>
            <Card className="p-5 hover:shadow-elegant hover:-translate-y-0.5 transition-all cursor-pointer">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.filename}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(r.created_at).toLocaleDateString()} · {r.status} · {r.skills?.length ?? 0} skills
                    </div>
                  </div>
                </div>
                {r.ats_score != null ? (
                  <div className="text-right">
                    <div className="text-3xl font-display font-bold text-primary">{r.ats_score}</div>
                    <div className="text-xs text-muted-foreground">ATS Score</div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Analyzing...</span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
