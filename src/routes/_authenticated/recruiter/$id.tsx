import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { rankCandidatesForJD, shortlistCandidate } from "@/lib/recruiter.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Star,
  StarOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recruiter/$id")({
  head: () => ({ meta: [{ title: "Rank candidates — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: JobDetail,
});

type Ranked = Awaited<ReturnType<typeof rankCandidatesForJD>>;
type RankedItem = Ranked["ranked"][number];

function JobDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const rankFn = useServerFn(rankCandidatesForJD);
  const shortlistFn = useServerFn(shortlistCandidate);
  const [analysis, setAnalysis] = useState<Ranked | null>(null);

  const jdQuery = useQuery({
    queryKey: ["jd", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_descriptions").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const shortlistsQuery = useQuery({
    queryKey: ["shortlists", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shortlists").select("resume_id").eq("jd_id", id);
      if (error) throw error;
      return new Set(data.map((s) => s.resume_id));
    },
  });

  const rankMut = useMutation({
    mutationFn: async () => rankFn({ data: { jdId: id } }),
    onSuccess: (data) => {
      setAnalysis(data);
      toast.success(`Ranked ${data.ranked.length} candidates`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shortlistMut = useMutation({
    mutationFn: async (resumeId: string) => shortlistFn({ data: { jdId: id, resumeId } }),
    onSuccess: () => {
      toast.success("Added to shortlist");
      qc.invalidateQueries({ queryKey: ["shortlists", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Build the union of top skills for the heatmap columns
  const allSkills = useMemo(() => {
    if (!analysis) return [];
    const req = new Set<string>(jdQuery.data?.required_skills ?? []);
    const s = new Set<string>();
    for (const cand of analysis.ranked) {
      for (const sk of cand.matched_skills) s.add(sk);
      for (const sk of cand.missing_skills) s.add(sk);
    }
    // Prioritize required skills first
    const ordered = [
      ...Array.from(req).filter((x) => s.has(x)),
      ...Array.from(s).filter((x) => !req.has(x)),
    ];
    return ordered.slice(0, 12);
  }, [analysis, jdQuery.data]);

  if (jdQuery.isLoading) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!jdQuery.data) return <div className="p-10">Job not found.</div>;

  const jd = jdQuery.data;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <Link to="/recruiter" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">{jd.title}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {[jd.company, jd.location].filter(Boolean).join(" · ")}
          </div>
          {jd.required_skills && jd.required_skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {jd.required_skills.map((s: string) => (
                <Badge key={s} className="bg-primary/10 text-primary border-primary/20">{s}</Badge>
              ))}
            </div>
          )}
        </div>
        <Button
          className="bg-primary-gradient"
          onClick={() => rankMut.mutate()}
          disabled={rankMut.isPending}
        >
          {rankMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Run AI ranking
        </Button>
      </div>

      {!analysis && (
        <Card className="mt-8 p-10 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-primary opacity-60" />
          <div className="mt-3 font-display font-semibold">Run AI ranking to see candidate matches</div>
          <p className="text-sm text-muted-foreground mt-1">
            We'll score every analyzed resume against this JD and highlight matched vs missing skills.
          </p>
        </Card>
      )}

      {analysis && analysis.ranked.length === 0 && (
        <Card className="mt-8 p-10 text-center text-sm text-muted-foreground">
          No analyzed resumes in the system yet.
        </Card>
      )}

      {analysis && analysis.ranked.length > 0 && (
        <>
          {/* Skill heatmap */}
          <Card className="mt-8 p-4 overflow-x-auto">
            <div className="text-sm font-display font-semibold mb-3 px-2">Skill heatmap</div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-card">Candidate</th>
                  <th className="px-2 py-2">Match</th>
                  {allSkills.map((s) => (
                    <th key={s} className="px-2 py-2 font-normal text-muted-foreground whitespace-nowrap">
                      <div className="rotate-[-30deg] origin-bottom-left inline-block">{s}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.ranked.map((c) => (
                  <tr key={c.resume_id} className="border-t border-border">
                    <td className="px-3 py-2 sticky left-0 bg-card font-medium">
                      {c.candidate_name ?? c.filename.slice(0, 24)}
                    </td>
                    <td className="px-2 py-2 font-semibold text-center">{c.similarity}%</td>
                    {allSkills.map((s) => {
                      const has = c.matched_skills.includes(s);
                      const miss = c.missing_skills.includes(s);
                      const bg = has
                        ? "bg-success/70"
                        : miss
                          ? "bg-destructive/30"
                          : "bg-muted/30";
                      return <td key={s} className="p-1"><div className={`h-6 rounded ${bg}`} /></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex gap-4 px-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/70" /> Has skill</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/30" /> Missing (required)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted/30" /> N/A</span>
            </div>
          </Card>

          {/* Candidate cards */}
          <div className="mt-6 grid gap-4">
            {analysis.ranked.map((c, idx) => (
              <CandidateCard
                key={c.resume_id}
                cand={c}
                rank={idx + 1}
                shortlisted={shortlistsQuery.data?.has(c.resume_id) ?? false}
                onShortlist={() => shortlistMut.mutate(c.resume_id)}
                busy={shortlistMut.isPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CandidateCard({
  cand,
  rank,
  shortlisted,
  onShortlist,
  busy,
}: {
  cand: RankedItem;
  rank: number;
  shortlisted: boolean;
  onShortlist: () => void;
  busy: boolean;
}) {
  const tone = cand.similarity >= 75 ? "text-success" : cand.similarity >= 50 ? "text-primary" : "text-muted-foreground";
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">#{rank}</span>
            <div className="font-display font-semibold">{cand.candidate_name ?? cand.filename}</div>
            <Badge variant="secondary" className="text-[10px]">ATS {cand.ats_score ?? "—"}</Badge>
          </div>
          {cand.summary && <p className="mt-2 text-sm text-muted-foreground">{cand.summary}</p>}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {cand.strengths.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Strengths</div>
                <ul className="space-y-1">
                  {cand.strengths.map((s, i) => (
                    <li key={i} className="flex gap-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {cand.gaps.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Gaps</div>
                <ul className="space-y-1">
                  {cand.gaps.map((s, i) => (
                    <li key={i} className="flex gap-1.5 text-xs"><XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-4xl font-display font-bold ${tone}`}>{cand.similarity}%</div>
          <div className="text-[11px] text-muted-foreground">match</div>
          <Button
            size="sm"
            variant={shortlisted ? "secondary" : "outline"}
            className="mt-3"
            disabled={busy || shortlisted}
            onClick={onShortlist}
          >
            {shortlisted ? <><StarOff className="mr-1 h-3.5 w-3.5" /> Shortlisted</> : <><Star className="mr-1 h-3.5 w-3.5" /> Shortlist</>}
          </Button>
        </div>
      </div>
    </Card>
  );
}
