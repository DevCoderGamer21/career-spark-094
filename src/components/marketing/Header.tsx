import { Link } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-gradient shadow-glow">
            <Brain className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>ResumeAI</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            Features
          </Link>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            Pricing
          </Link>
          <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            About
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="bg-primary-gradient hover:opacity-90">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
