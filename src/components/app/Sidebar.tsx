import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Upload, Target, MessageSquare, LogOut, Brain, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { User as AuthUser } from "@supabase/supabase-js";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Resume", icon: Upload },
  { to: "/resumes", label: "My Resumes", icon: FileText },
  { to: "/jd-match", label: "JD Matcher", icon: Target },
  { to: "/advisor", label: "AI Advisor", icon: MessageSquare },
] as const;

export function AppSidebar({ user }: { user: AuthUser | null }) {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  return (
    <aside className="hidden md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground min-h-screen sticky top-0">
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-gradient shadow-glow">
            <Brain className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>ResumeAI</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/80">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-accent">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-xs">{user?.email ?? "Guest"}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
