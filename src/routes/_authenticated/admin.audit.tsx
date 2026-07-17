import { createFileRoute } from "@tanstack/react-router";
import { AuditView } from "@/components/audit/AuditView";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit logs — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <div className="mt-6">
      <AuditView queryKey="audit-logs-admin" />
    </div>
  );
}
