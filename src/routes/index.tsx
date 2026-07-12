import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Target,
  FileSearch,
  BrainCircuit,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const features = [
  { icon: FileSearch, title: "AI Resume Parsing", desc: "Upload PDF or DOCX. Gemini extracts skills, education, experience, projects, and certifications into structured data." },
  { icon: Target, title: "ATS Score 0–100", desc: "Detailed breakdown across formatting, keywords, skills, experience, grammar, and ATS compatibility." },
  { icon: BrainCircuit, title: "JD Semantic Match", desc: "Paste any job description and get similarity %, matched skills, and prioritized skill gaps." },
  { icon: Sparkles, title: "Rewrite Suggestions", desc: "Bullet-level rewrites that quantify achievements and speak recruiter language." },
  { icon: MessageSquare, title: "Career Advisor", desc: "Streaming AI chat for roles, roadmaps, salary insights, and interview prep." },
  { icon: BarChart3, title: "Progress Analytics", desc: "Track ATS score improvement, skill acquisition, and application readiness over time." },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-hero-gradient text-primary-foreground">
        <div className="absolute inset-0 bg-radial-glow opacity-40" />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Powered by advanced AI, NLP & Deep Learning
            </div>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold tracking-tight">
              Your resume,{" "}
              <span className="text-gradient">intelligently analyzed</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-primary-foreground/70 leading-relaxed">
              An enterprise AI platform that scores your resume against ATS systems, matches you with jobs, uncovers skill gaps, and generates a personalized career roadmap — in seconds.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="bg-primary-gradient hover:opacity-90 shadow-glow">
                  Analyze my resume free
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/features">
                <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  See how it works
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-xs text-primary-foreground/60">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Enterprise-grade security</div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4" /> Under 15 seconds</div>
              <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> Gemini + NLP</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Platform capabilities</div>
          <h2 className="mt-3 text-4xl md:text-5xl font-display font-bold">Every tool you need to get hired</h2>
          <p className="mt-4 text-muted-foreground">
            Built with modern NLP, machine learning, and generative AI. Enterprise-ready for candidates, recruiters, and college placement teams.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-elegant hover:-translate-y-1"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary-gradient text-primary-foreground shadow-glow">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-display font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-subtle-gradient py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-primary font-semibold">Workflow</div>
            <h2 className="mt-3 text-4xl md:text-5xl font-display font-bold">Three steps to a stronger resume</h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { n: "01", t: "Upload", d: "Drop your PDF or DOCX. We handle parsing, entity extraction, and secure storage." },
              { n: "02", t: "Analyze", d: "AI evaluates ATS compatibility, keyword density, structure, and content strength." },
              { n: "03", t: "Optimize", d: "Match to jobs, close skill gaps with concrete learning paths, and rewrite weak bullets." },
            ].map((s) => (
              <div key={s.n} className="relative rounded-2xl bg-card border border-border p-8 shadow-card">
                <div className="text-6xl font-display font-bold text-primary/10">{s.n}</div>
                <h3 className="mt-2 text-xl font-display font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-hero-gradient p-12 md:p-16 text-primary-foreground shadow-navy">
          <div className="absolute inset-0 bg-radial-glow opacity-50" />
          <div className="relative text-center">
            <h2 className="text-3xl md:text-5xl font-display font-bold">Ready to level up your resume?</h2>
            <p className="mt-4 text-primary-foreground/70 max-w-xl mx-auto">
              Join thousands of candidates using AI to land interviews faster. Free to start, no credit card required.
            </p>
            <div className="mt-8">
              <Link to="/auth">
                <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-glow">
                  Get started free
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
