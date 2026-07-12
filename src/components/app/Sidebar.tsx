import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, FileText, Upload, Target, MessageSquare, LogOut, Brain, User, Briefcase, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { User as AuthUser } from "@supabase/supabase-js";

const candidateNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Resume", icon: Upload },
  { to: "/resumes", label: "My Resumes", icon: FileText },
  { to: "/jd-match", label: "JD Matcher", icon: Target },
  { to: "/builder", label: "Resume Builder", icon: PenLine },
  { to: "/advisor", label: "AI Advisor", icon: MessageSquare },
] as const;

const recruiterNav = [{ to: "/recruiter", label: "Recruiter", icon: Briefcase }] as const;

export function AppSidebar({ user }: { user: AuthUser | null }) {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => setRoles((data ?? []).map((r) => r.role)));
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const isRecruiter = roles.includes("recruiter") || roles.includes("admin");

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
        <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">
          Candidate
        </div>
        {candidateNav.map((item) => (
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
        {isRecruiter && (
          <>
            <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">
              Recruiter
            </div>
            {recruiterNav.map((item) => (
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
          </>
        )}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/80">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-accent">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-xs">{user?.email ?? "Guest"}</div>
            {roles.length > 0 && (
              <div className="truncate text-[10px] text-sidebar-foreground/50 uppercase">
                {roles.join(" · ")}
              </div>
            )}
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
