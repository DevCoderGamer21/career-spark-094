import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { AuditView } from "@/components/audit/AuditView";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit logs — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const list = (roles ?? []).map((r) => r.role);
    if (list.includes("admin")) throw redirect({ to: "/admin/audit" });
    if (!list.includes("placement_officer")) throw redirect({ to: "/dashboard" });
  },
  component: PlacementAuditPage,
});

function PlacementAuditPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <Link to="/placement" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to placement
      </Link>
      <div className="mt-4">
        <AuditView
          queryKey="audit-logs-placement"
          description="Records of privileged actions performed by admins and placement officers across the platform."
          showActorId={false}
        />
      </div>
    </div>
  );
}
