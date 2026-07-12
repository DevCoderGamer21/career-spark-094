import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenLine, Plus, Loader2, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { EMPTY_RESUME } from "@/lib/resume-data";

export const Route = createFileRoute("/_authenticated/builder/")({
  head: () => ({ meta: [{ title: "Resume Builder — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: BuilderList,
});

function BuilderList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["builder-resumes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_resumes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("builder_resumes")
        .insert({ user_id: user!.id, title: "Untitled Resume", template: "ats", data: EMPTY_RESUME })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => navigate({ to: "/builder/$id", params: { id: d.id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("builder_resumes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["builder-resumes"] });
    },
  });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Builder</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">Resume Builder</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Build ATS-friendly resumes with live preview and export to PDF or DOCX.
          </p>
        </div>
        <Button className="bg-primary-gradient" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          New resume
        </Button>
      </div>

      <div className="mt-8 grid gap-4">
        {query.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
        {query.data && query.data.length === 0 && (
          <Card className="p-10 text-center">
            <PenLine className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
            <div className="mt-3 font-display font-semibold">No resumes yet</div>
            <p className="text-sm text-muted-foreground mt-1">Click "New resume" to start.</p>
          </Card>
        )}
        {query.data?.map((r) => (
          <Card key={r.id} className="p-5 flex items-center justify-between gap-4">
            <Link
              to="/builder/$id"
              params={{ id: r.id }}
              className="flex items-center gap-3 min-w-0 flex-1 hover:text-primary transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <div className="font-display font-semibold truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {r.template.toUpperCase()} · Updated {new Date(r.updated_at).toLocaleString()}
                </div>
              </div>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm("Delete this resume?")) delMut.mutate(r.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
