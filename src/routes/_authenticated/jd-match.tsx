import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { matchJobDescription } from "@/lib/resume.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Loader2, CheckCircle2, XCircle, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ resumeId: z.string().optional() });

export const Route = createFileRoute("/_authenticated/jd-match")({
  head: () => ({ meta: [{ title: "JD Matcher — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (raw) => searchSchema.parse(raw),
  component: JDMatchPage,
});

type MatchResult = {
  id: string;
  similarity: number;
  matched_skills: string[];
  missing_skills: string[];
  recommendations: {
    strengths?: string[];
    gaps?: string[];
    recommendations?: Array<{ skill: string; why: string; resource: string }>;
    summary?: string;
  };
  jd_title: string | null;
};

function JDMatchPage() {
  const { resumeId: initialResumeId } = Route.useSearch();
  const [resumeId, setResumeId] = useState<string>(initialResumeId ?? "");
  const [jdTitle, setJdTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const matchFn = useServerFn(matchJobDescription);

  const { data: resumes } = useQuery({
    queryKey: ["resumes-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("id, filename, ats_score")
        .eq("status", "analyzed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!resumeId && resumes && resumes.length > 0) setResumeId(resumes[0].id);
  }, [resumes, resumeId]);

  const mut = useMutation({
    mutationFn: async () => matchFn({ data: { resumeId, jdText, jdTitle: jdTitle || undefined } }),
    onSuccess: (data) => {
      setResult(data as unknown as MatchResult);
      toast.success("Match analysis complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canRun = resumeId && jdText.length >= 20 && !mut.isPending;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-primary font-semibold">Matcher</div>
      <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">JD Matcher</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a job description to score how well your resume matches and get prioritized skill gaps.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label>Choose resume</Label>
              <Select value={resumeId} onValueChange={setResumeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a resume" />
                </SelectTrigger>
                <SelectContent>
                  {resumes?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.filename} {r.ats_score ? `· ATS ${r.ats_score}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {resumes && resumes.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Upload and analyze a resume first.</p>
              )}
            </div>
            <div>
              <Label htmlFor="jdt">Job title (optional)</Label>
              <Input id="jdt" placeholder="Senior Full-Stack Engineer" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="jd">Job description</Label>
              <Textarea
                id="jd"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={12}
                placeholder="Paste the full job description here..."
                className="mt-1"
              />
            </div>
            <Button
              className="w-full bg-primary-gradient"
              disabled={!canRun}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
              Analyze match
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-hero-gradient text-primary-foreground border-0 shadow-navy relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-glow opacity-30" />
          <div className="relative">
            {!result && (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto opacity-40" />
                <div className="mt-3 font-display font-semibold text-lg">Your match report will appear here</div>
                <p className="text-sm text-primary-foreground/70 mt-1">Similarity, matched & missing skills, and learning recommendations.</p>
              </div>
            )}
            {result && (
              <>
                <div className="text-center">
                  <div className="text-6xl font-display font-bold text-gradient">{result.similarity}%</div>
                  <div className="mt-1 text-sm text-primary-foreground/70">Overall match</div>
                </div>
                {result.recommendations?.summary && (
                  <p className="mt-4 text-sm text-primary-foreground/80 leading-relaxed">
                    {result.recommendations.summary}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {result && (
        <>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="font-display font-semibold">Matched skills ({result.matched_skills.length})</h3>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.matched_skills.map((s) => <Badge key={s} className="bg-success/10 text-success hover:bg-success/20 border-success/20">{s}</Badge>)}
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <h3 className="font-display font-semibold">Missing skills ({result.missing_skills.length})</h3>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.missing_skills.map((s) => <Badge key={s} variant="outline" className="border-destructive/40 text-destructive">{s}</Badge>)}
              </div>
            </Card>
          </div>

          {result.recommendations?.recommendations && result.recommendations.recommendations.length > 0 && (
            <Card className="mt-6 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-display font-semibold">Recommended learning</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {result.recommendations.recommendations.map((r, i) => (
                  <div key={i} className="rounded-lg border border-border p-4">
                    <div className="font-semibold text-sm">{r.skill}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{r.why}</div>
                    <Badge variant="secondary" className="mt-2 text-xs">{r.resource}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {result.recommendations?.strengths && result.recommendations.strengths.length > 0 && (
              <Card className="p-6">
                <h3 className="font-display font-semibold">Strengths</h3>
                <ul className="mt-3 space-y-2">
                  {result.recommendations.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {result.recommendations?.gaps && result.recommendations.gaps.length > 0 && (
              <Card className="p-6">
                <h3 className="font-display font-semibold">Gaps to address</h3>
                <ul className="mt-3 space-y-2">
                  {result.recommendations.gaps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
