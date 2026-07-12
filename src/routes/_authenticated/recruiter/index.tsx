import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, Loader2, Sparkles, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recruiter/")({
  head: () => ({ meta: [{ title: "Recruiter — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: RecruiterHome,
});

function RecruiterHome() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role);
    },
  });

  const isRecruiter = rolesQuery.data?.includes("recruiter") || rolesQuery.data?.includes("admin");

  const grantMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("grant_self_role", { _role: "recruiter" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recruiter access granted");
      qc.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (rolesQuery.isLoading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isRecruiter) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <Card className="p-8 text-center">
          <Briefcase className="h-10 w-10 mx-auto text-primary" />
          <h1 className="mt-4 text-2xl font-display font-bold">Recruiter workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Post job descriptions, browse ranked candidates with AI-powered similarity scores, and build shortlists.
          </p>
          <Button
            className="mt-6 bg-primary-gradient"
            onClick={() => grantMut.mutate()}
            disabled={grantMut.isPending}
          >
            {grantMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Enable recruiter access
          </Button>
        </Card>
      </div>
    );
  }

  return <RecruiterDashboard userId={user!.id} />;
}

function RecruiterDashboard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const jdsQuery = useQuery({
    queryKey: ["recruiter-jds", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_descriptions")
        .select("*")
        .eq("recruiter_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_descriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job removed");
      qc.invalidateQueries({ queryKey: ["recruiter-jds"] });
    },
  });

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Recruiter</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">Job descriptions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Post roles, run AI-powered candidate ranking, and shortlist top matches.
          </p>
        </div>
        <Button className="bg-primary-gradient" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New job
        </Button>
      </div>

      {open && <NewJDForm userId={userId} onClose={() => setOpen(false)} />}

      <div className="mt-8 grid gap-4">
        {jdsQuery.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
        {jdsQuery.data && jdsQuery.data.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No jobs yet. Click "New job" to post one.
          </Card>
        )}
        {jdsQuery.data?.map((jd) => (
          <Card key={jd.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  to="/recruiter/$id"
                  params={{ id: jd.id }}
                  className="font-display font-semibold text-lg hover:text-primary transition-colors"
                >
                  {jd.title}
                </Link>
                <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-2">
                  {jd.company && <span>{jd.company}</span>}
                  {jd.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {jd.location}
                    </span>
                  )}
                  <span>{new Date(jd.created_at).toLocaleDateString()}</span>
                </div>
                {jd.required_skills && jd.required_skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {jd.required_skills.slice(0, 8).map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button asChild size="sm" variant="outline">
                  <Link to="/recruiter/$id" params={{ id: jd.id }}>Rank candidates</Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Delete this job?")) delMut.mutate(jd.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewJDForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      const required_skills = skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const { error } = await supabase.from("job_descriptions").insert({
        recruiter_id: userId,
        title,
        company: company || null,
        location: location || null,
        description,
        required_skills,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job posted");
      qc.invalidateQueries({ queryKey: ["recruiter-jds"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-display font-semibold text-lg">New job description</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Full-Stack Engineer" />
        </div>
        <div>
          <Label>Company</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <Label>Location</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote / Bangalore" />
        </div>
        <div>
          <Label>Required skills (comma separated)</Label>
          <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Node.js" />
        </div>
      </div>
      <div className="mt-4">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          placeholder="Paste the full job description..."
        />
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          className="bg-primary-gradient"
          disabled={!title || description.length < 20 || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Post job
        </Button>
      </div>
    </Card>
  );
}
