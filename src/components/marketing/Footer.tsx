import { Link } from "@tanstack/react-router";
import { Brain } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-display font-bold">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-primary-gradient">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              ResumeAI
            </div>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Enterprise AI resume intelligence for candidates, recruiters, and colleges.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Product</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/features" className="hover:text-foreground">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Company</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground">About</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Get started</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth" className="hover:text-foreground">Sign in</Link></li>
              <li><Link to="/auth" className="hover:text-foreground">Create account</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} ResumeAI. All rights reserved.</span>
          <span>Built with Lovable</span>
        </div>
      </div>
    </footer>
  );
}
