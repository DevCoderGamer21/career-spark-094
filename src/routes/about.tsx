import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — ResumeAI" },
      { name: "description", content: "ResumeAI helps candidates, recruiters, and colleges make hiring faster and fairer with modern AI." },
      { property: "og:title", content: "About ResumeAI" },
      { property: "og:description", content: "Modern AI-powered career intelligence for candidates, recruiters, and colleges." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="mx-auto max-w-3xl px-6 py-20 prose prose-lg">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold">About</div>
        <h1 className="mt-3 text-4xl md:text-6xl font-display font-bold">Hiring intelligence, reimagined</h1>
        <div className="mt-6 space-y-6 text-muted-foreground leading-relaxed">
          <p>
            ResumeAI is a modern, enterprise-grade AI platform for the entire hiring loop. We help candidates optimize resumes against ATS systems, recruiters find the right talent faster, and colleges prepare cohorts for placement — all in one intelligent workspace.
          </p>
          <p>
            Under the hood we combine NLP, machine learning, deep learning embeddings, and generative AI to parse, score, match, and coach. The result: measurable outcomes, not vague advice.
          </p>
          <p>
            Built on TanStack Start, Lovable Cloud, and Lovable AI Gateway. Designed for scale, security, and speed.
          </p>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
