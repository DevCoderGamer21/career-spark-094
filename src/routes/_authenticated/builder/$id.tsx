import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EMPTY_RESUME, type BuilderResumeData, type ResumeTemplate } from "@/lib/resume-data";
import { ResumePreview } from "@/components/builder/ResumePreview";
import { exportResumePDF, exportResumeDOCX } from "@/lib/resume-exporters";

export const Route = createFileRoute("/_authenticated/builder/$id")({
  head: () => ({ meta: [{ title: "Edit resume — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: BuilderEditor,
});

function BuilderEditor() {
  const { id } = Route.useParams();
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<ResumeTemplate>("ats");
  const [data, setData] = useState<BuilderResumeData>(EMPTY_RESUME);

  const q = useQuery({
    queryKey: ["builder", id],
    queryFn: async () => {
      const { data: row, error } = await supabase.from("builder_resumes").select("*").eq("id", id).single();
      if (error) throw error;
      return row;
    },
  });

  useEffect(() => {
    if (q.data) {
      setTitle(q.data.title);
      setTemplate((q.data.template as ResumeTemplate) ?? "ats");
      setData({ ...EMPTY_RESUME, ...((q.data.data as unknown as Partial<BuilderResumeData>) ?? {}) } as BuilderResumeData);
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("builder_resumes")
        .update({ title, template, data: data as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = <K extends keyof BuilderResumeData>(key: K, value: BuilderResumeData[K]) =>
    setData((d) => ({ ...d, [key]: value }));
  const updPersonal = (key: keyof BuilderResumeData["personal"], value: string) =>
    setData((d) => ({ ...d, personal: { ...d.personal, [key]: value } }));

  const fileBase = (title || "resume").replace(/[^\w\-]+/g, "_");

  if (q.isLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!q.data) return <div className="p-10">Resume not found.</div>;

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto">
      <Link to="/builder" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All resumes
      </Link>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md text-lg font-display font-semibold" />
        <Select value={template} onValueChange={(v) => setTemplate(v as ResumeTemplate)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ats">ATS-friendly</SelectItem>
            <SelectItem value="modern">Modern</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => exportResumePDF(data, template, fileBase)}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={() => exportResumeDOCX(data, template, fileBase)}>
            <FileDown className="mr-2 h-4 w-4" /> DOCX
          </Button>
          <Button className="bg-primary-gradient" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Personal</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Full name" value={data.personal.fullName} onChange={(v) => updPersonal("fullName", v)} />
              <Field label="Headline" value={data.personal.headline} onChange={(v) => updPersonal("headline", v)} />
              <Field label="Email" value={data.personal.email} onChange={(v) => updPersonal("email", v)} />
              <Field label="Phone" value={data.personal.phone} onChange={(v) => updPersonal("phone", v)} />
              <Field label="Location" value={data.personal.location} onChange={(v) => updPersonal("location", v)} />
              <Field label="LinkedIn" value={data.personal.linkedin} onChange={(v) => updPersonal("linkedin", v)} />
              <Field label="GitHub" value={data.personal.github} onChange={(v) => updPersonal("github", v)} />
              <Field label="Website" value={data.personal.website} onChange={(v) => updPersonal("website", v)} />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Summary</h3>
            <Textarea rows={4} value={data.summary} onChange={(e) => upd("summary", e.target.value)} />
          </Card>

          <ListSection
            title="Experience"
            items={data.experience}
            onChange={(v) => upd("experience", v)}
            factory={() => ({ company: "", title: "", location: "", start: "", end: "", bullets: [""] })}
            render={(it, on) => (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label="Title" value={it.title} onChange={(v) => on({ ...it, title: v })} />
                  <Field label="Company" value={it.company} onChange={(v) => on({ ...it, company: v })} />
                  <Field label="Location" value={it.location} onChange={(v) => on({ ...it, location: v })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Start" value={it.start} onChange={(v) => on({ ...it, start: v })} />
                    <Field label="End" value={it.end} onChange={(v) => on({ ...it, end: v })} />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-xs">Bullets</Label>
                  {it.bullets.map((b, i) => (
                    <div key={i} className="flex gap-2 mt-1">
                      <Textarea
                        rows={2}
                        value={b}
                        onChange={(e) => {
                          const nb = [...it.bullets];
                          nb[i] = e.target.value;
                          on({ ...it, bullets: nb });
                        }}
                      />
                      <Button size="icon" variant="ghost" onClick={() => on({ ...it, bullets: it.bullets.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="mt-1" onClick={() => on({ ...it, bullets: [...it.bullets, ""] })}>
                    <Plus className="h-3 w-3 mr-1" /> Bullet
                  </Button>
                </div>
              </>
            )}
          />

          <ListSection
            title="Education"
            items={data.education}
            onChange={(v) => upd("education", v)}
            factory={() => ({ institution: "", degree: "", field: "", start: "", end: "", gpa: "" })}
            render={(it, on) => (
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Institution" value={it.institution} onChange={(v) => on({ ...it, institution: v })} />
                <Field label="Degree" value={it.degree} onChange={(v) => on({ ...it, degree: v })} />
                <Field label="Field" value={it.field} onChange={(v) => on({ ...it, field: v })} />
                <Field label="GPA" value={it.gpa} onChange={(v) => on({ ...it, gpa: v })} />
                <Field label="Start" value={it.start} onChange={(v) => on({ ...it, start: v })} />
                <Field label="End" value={it.end} onChange={(v) => on({ ...it, end: v })} />
              </div>
            )}
          />

          <ListSection
            title="Projects"
            items={data.projects}
            onChange={(v) => upd("projects", v)}
            factory={() => ({ name: "", tech: "", link: "", description: "" })}
            render={(it, on) => (
              <div className="grid gap-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label="Name" value={it.name} onChange={(v) => on({ ...it, name: v })} />
                  <Field label="Tech" value={it.tech} onChange={(v) => on({ ...it, tech: v })} />
                </div>
                <Field label="Link" value={it.link} onChange={(v) => on({ ...it, link: v })} />
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea rows={2} value={it.description} onChange={(e) => on({ ...it, description: e.target.value })} />
                </div>
              </div>
            )}
          />

          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Skills</h3>
            <Textarea
              rows={3}
              placeholder="Comma-separated skills"
              value={data.skills.join(", ")}
              onChange={(e) => upd("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Certifications</h3>
            <Textarea
              rows={3}
              placeholder="One per line"
              value={data.certifications.join("\n")}
              onChange={(e) => upd("certifications", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            />
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Achievements</h3>
            <Textarea
              rows={3}
              placeholder="One per line"
              value={data.achievements.join("\n")}
              onChange={(e) => upd("achievements", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            />
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Live preview</div>
          <div className="bg-muted/30 p-4 rounded-lg overflow-auto max-h-[calc(100vh-8rem)]">
            <ResumePreview data={data} template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  );
}

function ListSection<T>({
  title,
  items,
  onChange,
  factory,
  render,
}: {
  title: string;
  items: T[];
  onChange: (v: T[]) => void;
  factory: () => T;
  render: (item: T, onItem: (v: T) => void) => React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold">{title}</h3>
        <Button size="sm" variant="outline" onClick={() => onChange([...items, factory()])}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-border p-3 relative">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {render(it, (v) => {
              const next = [...items];
              next[i] = v;
              onChange(next);
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
