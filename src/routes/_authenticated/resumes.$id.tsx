import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { improveResume } from "@/lib/resume.functions";
import { supabase } from "@/integrations/supabase/client";
import { ScoreRing } from "@/components/ScoreRing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Target, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resumes/$id")({
  head: () => ({ meta: [{ title: "Resume Analysis — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: ResumeDetail,
});

type Parsed = {
  name?: string; email?: string; phone?: string; summary?: string;
  linkedin?: string; github?: string; portfolio?: string;
  skills?: string[];
  education?: Array<{ institution: string; degree: string; field?: string | null; year?: string | null; gpa?: string | null }>;
  experience?: Array<{ company: string; title: string; start?: string | null; end?: string | null; description: string; highlights?: string[] }>;
  projects?: Array<{ name: string; description: string; tech?: string[] }>;
  certifications?: string[];
  achievements?: string[];
  languages?: string[];
};

type ImproveTips = {
  overall_feedback: string;
  priority_actions: string[];
  section_suggestions: Array<{ section: string; issue: string; fix: string; example?: string }>;
  rewritten_bullets: Array<{ original: string; improved: string }>;
};

function ResumeDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const improveFn = useServerFn(improveResume);

  const { data: resume, isLoading } = useQuery({
    queryKey: ["resume", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("resumes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const improveMut = useMutation({
    mutationFn: async () => improveFn({ data: { resumeId: id } }),
    onSuccess: () => {
      toast.success("Improvement suggestions generated");
      qc.invalidateQueries({ queryKey: ["resume", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading analysis...</div>;
  if (!resume) return <div className="p-10">Not found.</div>;

  const parsed = (resume.parsed ?? {}) as Parsed;
  const breakdown = (resume.ats_breakdown ?? {}) as Record<string, number | string>;
  const tips = resume.improvement_tips as ImproveTips | null;

  const subMetrics = [
    ["formatting", "Formatting"], ["keywords", "Keywords"], ["skills", "Skills"],
    ["experience", "Experience"], ["education", "Education"], ["projects", "Projects"],
    ["achievements", "Achievements"], ["grammar", "Grammar"], ["ats_compatibility", "ATS Compat"],
  ] as const;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <Link to="/resumes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to resumes
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Analysis</div>
          <h1 className="mt-1 text-3xl font-display font-bold truncate">{resume.filename}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Uploaded {new Date(resume.created_at).toLocaleDateString()} · {resume.status}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/jd-match" search={{ resumeId: id }}>
            <Button variant="outline"><Target className="mr-2 h-4 w-4" />Match to JD</Button>
          </Link>
          <Button
            className="bg-primary-gradient"
            onClick={() => improveMut.mutate()}
            disabled={improveMut.isPending}
          >
            {improveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {tips ? "Re-run suggestions" : "Get suggestions"}
          </Button>
        </div>
      </div>

      {/* Score & Breakdown */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 flex flex-col items-center justify-center bg-hero-gradient text-primary-foreground shadow-navy border-0">
          <ScoreRing score={resume.ats_score ?? 0} size={180} label="Overall" />
          {breakdown.reasoning && (
            <p className="mt-4 text-sm text-primary-foreground/80 text-center leading-relaxed">
              {String(breakdown.reasoning)}
            </p>
          )}
        </Card>
        <Card className="lg:col-span-2 p-6">
          <h2 className="font-display font-semibold text-lg">Sub-score breakdown</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {subMetrics.map(([key, label]) => {
              const val = Number(breakdown[key] ?? 0);
              const tone = val >= 80 ? "bg-success" : val >= 60 ? "bg-primary" : val >= 40 ? "bg-warning" : "bg-destructive";
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{val}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${tone} transition-all`} style={{ width: `${val}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Skills */}
      {resume.skills && resume.skills.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display font-semibold text-lg">Extracted skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {resume.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
          </div>
        </Card>
      )}

      {/* Improvement */}
      {tips && (
        <Card className="mt-6 p-6">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Improvement Suggestions
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{tips.overall_feedback}</p>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-widest text-primary font-semibold">Priority actions</div>
            <ul className="mt-2 space-y-2">
              {tips.priority_actions?.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />{a}
                </li>
              ))}
            </ul>
          </div>

          {tips.rewritten_bullets && tips.rewritten_bullets.length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-widest text-primary font-semibold">Rewritten bullets</div>
              <div className="mt-3 space-y-3">
                {tips.rewritten_bullets.map((b, i) => (
                  <div key={i} className="rounded-lg border border-border p-4 bg-muted/30">
                    <div className="text-xs text-muted-foreground line-through">{b.original}</div>
                    <div className="mt-1 text-sm font-medium">{b.improved}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tips.section_suggestions && tips.section_suggestions.length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-widest text-primary font-semibold">Section-by-section</div>
              <div className="mt-3 space-y-3">
                {tips.section_suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      {s.section}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.issue}</div>
                    <div className="mt-2 text-sm"><span className="font-medium">Fix:</span> {s.fix}</div>
                    {s.example && <div className="mt-1 text-xs text-muted-foreground italic">Example: {s.example}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Parsed data */}
      <Card className="mt-6 p-6">
        <h2 className="font-display font-semibold text-lg">Parsed data</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
          <Field label="Name" value={parsed.name} />
          <Field label="Email" value={parsed.email} />
          <Field label="Phone" value={parsed.phone} />
          <Field label="LinkedIn" value={parsed.linkedin} />
          <Field label="GitHub" value={parsed.github} />
          <Field label="Portfolio" value={parsed.portfolio} />
        </div>

        {parsed.summary && (
          <>
            <h3 className="mt-6 font-semibold">Summary</h3>
            <p className="mt-1 text-sm text-muted-foreground">{parsed.summary}</p>
          </>
        )}

        {parsed.experience && parsed.experience.length > 0 && (
          <>
            <h3 className="mt-6 font-semibold">Experience</h3>
            <div className="mt-2 space-y-3">
              {parsed.experience.map((e, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="font-medium">{e.title} · {e.company}</div>
                  <div className="text-xs text-muted-foreground">{e.start} – {e.end || "Present"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{e.description}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {parsed.education && parsed.education.length > 0 && (
          <>
            <h3 className="mt-6 font-semibold">Education</h3>
            <div className="mt-2 space-y-2">
              {parsed.education.map((e, i) => (
                <div key={i} className="text-sm">
                  <div className="font-medium">{e.degree}{e.field ? `, ${e.field}` : ""}</div>
                  <div className="text-muted-foreground">{e.institution} · {e.year}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {parsed.projects && parsed.projects.length > 0 && (
          <>
            <h3 className="mt-6 font-semibold">Projects</h3>
            <div className="mt-2 space-y-2">
              {parsed.projects.map((p, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.description}</div>
                  {p.tech && p.tech.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.tech.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
