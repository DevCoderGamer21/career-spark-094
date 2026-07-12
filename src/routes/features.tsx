import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — ResumeAI" },
      { name: "description", content: "Explore ResumeAI features: AI parsing, ATS scoring, JD matching, skill gap detection, resume improvement, and career advisor." },
      { property: "og:title", content: "Features — ResumeAI" },
      { property: "og:description", content: "AI-powered resume intelligence: parsing, ATS scoring, JD matching, career guidance." },
    ],
  }),
  component: FeaturesPage,
});

const sections = [
  {
    title: "AI Resume Parsing",
    body: "Upload PDF or DOCX. Our Gemini-powered pipeline extracts name, contact, education, skills, work history, projects, certifications, achievements, and languages into structured JSON — ready for scoring and matching.",
    bullets: ["PDF & DOCX support", "Named entity recognition", "Skill normalization", "Multi-page resumes"],
  },
  {
    title: "ATS Score with Full Breakdown",
    body: "Get a 0–100 overall score plus sub-scores for formatting, keywords, skills, experience, education, projects, achievements, grammar, and ATS compatibility. Each score comes with plain-English reasoning.",
    bullets: ["9 sub-metrics", "Explainable scoring", "Actionable weak-spots", "Score history tracking"],
  },
  {
    title: "Semantic JD Matching",
    body: "Paste any job description. We compute a similarity percentage using semantic embeddings, list matched vs missing skills, and rank recommendations by impact.",
    bullets: ["Similarity %", "Missing skill detection", "Learning resource suggestions", "Strengths & gaps summary"],
  },
  {
    title: "Actionable Rewrite Suggestions",
    body: "AI-generated bullet-level rewrites that quantify achievements, use strong verbs, and align with recruiter language — plus section-by-section fixes.",
    bullets: ["5–8 rewritten bullets", "Section critiques", "Grammar & clarity fixes", "Achievement quantification"],
  },
  {
    title: "AI Career Advisor",
    body: "Streaming chat that answers questions about roles, roadmaps, salary bands, interview prep, and certifications. Grounded in your resume.",
    bullets: ["Streaming responses", "Role-specific guidance", "Interview prep", "Salary insights"],
  },
];

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Features</div>
          <h1 className="mt-3 text-4xl md:text-6xl font-display font-bold">Everything the modern candidate needs</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            A complete AI-powered career intelligence platform, built on Lovable AI Gateway.
          </p>
        </div>

        <div className="mt-16 space-y-16">
          {sections.map((s, i) => (
            <div key={s.title} className={`grid gap-8 md:grid-cols-2 items-center ${i % 2 ? "md:[direction:rtl]" : ""}`}>
              <div className="[direction:ltr]">
                <h2 className="text-2xl md:text-3xl font-display font-semibold">{s.title}</h2>
                <p className="mt-3 text-muted-foreground leading-relaxed">{s.body}</p>
                <ul className="mt-5 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="[direction:ltr] rounded-2xl bg-hero-gradient p-10 text-primary-foreground shadow-navy min-h-64 grid place-items-center">
                <div className="text-6xl font-display font-bold text-gradient opacity-80">
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
