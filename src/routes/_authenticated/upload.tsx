import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { analyzeResume } from "@/lib/resume.functions";
import { Upload as UploadIcon, FileCheck2, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload Resume — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: UploadPage,
});

const MAX_SIZE = 10 * 1024 * 1024;

function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeResume);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing">("idle");
  const [progress, setProgress] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      if (!user) return;
      if (file.size > MAX_SIZE) return toast.error("File must be under 10MB");
      const okTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!okTypes.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) {
        return toast.error("Only PDF or DOCX files are supported");
      }
      try {
        setStatus("uploading");
        setProgress("Uploading to secure storage...");
        const ext = file.name.split(".").pop() || "pdf";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, {
          contentType: file.type || "application/pdf",
          upsert: false,
        });
        if (upErr) throw upErr;

        const { data: inserted, error: insErr } = await supabase
          .from("resumes")
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: path,
            mime_type: file.type || "application/pdf",
            status: "pending",
          })
          .select()
          .single();
        if (insErr) throw insErr;

        setStatus("analyzing");
        setProgress("AI is analyzing your resume — parsing entities, scoring ATS compatibility...");
        await analyze({ data: { resumeId: inserted.id } });
        toast.success("Analysis complete");
        navigate({ to: "/resumes/$id", params: { id: inserted.id } });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Upload failed");
        setStatus("idle");
        setProgress("");
      }
    },
    [user, analyze, navigate],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-primary font-semibold">Upload</div>
      <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold">Upload your resume</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        PDF or DOCX, max 10MB. We'll parse, score, and analyze in seconds.
      </p>

      <Card
        className={
          "mt-8 border-2 border-dashed p-12 text-center transition-all " +
          (dragging ? "border-primary bg-primary/5" : "border-border")
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {status === "idle" && (
          <>
            <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-primary-gradient text-primary-foreground shadow-glow">
              <UploadIcon className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-display font-semibold">Drop your resume here</h2>
            <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              id="resume-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <label htmlFor="resume-input" className="inline-block mt-5">
              <Button asChild className="bg-primary-gradient cursor-pointer">
                <span>Choose file</span>
              </Button>
            </label>
          </>
        )}
        {status !== "idle" && (
          <div className="py-8">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <div className="mt-4 font-display font-semibold text-lg">
              {status === "uploading" ? "Uploading..." : "Analyzing with AI..."}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{progress}</p>
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Tip icon={FileCheck2} label="Structured parsing" />
        <Tip icon={FileCheck2} label="ATS scoring 0–100" />
        <Tip icon={AlertCircle} label="Private & encrypted" />
      </div>
    </div>
  );
}

function Tip({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-border p-3">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </div>
  );
}
