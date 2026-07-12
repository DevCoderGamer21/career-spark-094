import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — ResumeAI" },
      { name: "description", content: "Simple pricing for candidates, recruiters, and colleges. Start free." },
      { property: "og:title", content: "Pricing — ResumeAI" },
      { property: "og:description", content: "Free candidate tier, pro plans for recruiters and placement cells." },
    ],
  }),
  component: PricingPage,
});

const tiers = [
  {
    name: "Candidate",
    price: "Free",
    desc: "For individuals optimizing their own resume.",
    features: ["3 resume uploads", "Full ATS analysis", "5 JD matches / month", "AI career chat", "Rewrite suggestions"],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "$19",
    unit: "/mo",
    desc: "Unlimited AI, priority processing, multiple versions.",
    features: ["Unlimited uploads", "Unlimited JD matches", "Priority AI queue", "Version history & compare", "PDF exports", "Interview prep bank"],
    cta: "Start Pro trial",
    highlight: true,
  },
  {
    name: "Institution",
    price: "Custom",
    desc: "For colleges, placement cells, and recruiters.",
    features: ["Batch resume analytics", "Cohort placement readiness", "Recruiter ranking dashboards", "SSO & audit logs", "SLA support"],
    cta: "Contact sales",
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Pricing</div>
          <h1 className="mt-3 text-4xl md:text-6xl font-display font-bold">Simple, transparent pricing</h1>
          <p className="mt-4 text-muted-foreground">Start free. Upgrade when you're serious about the job hunt.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                "rounded-2xl border p-8 " +
                (t.highlight
                  ? "border-primary bg-hero-gradient text-primary-foreground shadow-navy relative overflow-hidden"
                  : "border-border bg-card shadow-card")
              }
            >
              {t.highlight && (
                <div className="absolute top-4 right-4 rounded-full bg-primary-foreground/20 backdrop-blur px-3 py-1 text-xs font-medium">
                  Most popular
                </div>
              )}
              <h3 className="text-xl font-display font-semibold">{t.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-display font-bold">{t.price}</span>
                {t.unit && <span className="text-sm opacity-70">{t.unit}</span>}
              </div>
              <p className={"mt-2 text-sm " + (t.highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>{t.desc}</p>
              <Link to="/auth" className="block mt-6">
                <Button
                  className={
                    "w-full " +
                    (t.highlight
                      ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                      : "bg-primary-gradient")
                  }
                >
                  {t.cta}
                </Button>
              </Link>
              <ul className="mt-6 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
