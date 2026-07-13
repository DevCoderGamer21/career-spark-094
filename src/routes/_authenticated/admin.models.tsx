import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateModelSetting, testModel } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Cpu, Loader2, Save, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/models")({
  head: () => ({ meta: [{ title: "AI Model Management — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: ModelsPage,
});

const CATALOG = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)", tier: "Default · fast, multimodal" },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", tier: "Balanced quality" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", tier: "Cheapest" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", tier: "Stronger reasoning" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "Complex multimodal" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "Cost-balanced" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "Alt vendor" },
  { id: "openai/gpt-5", label: "GPT-5", tier: "Highest quality" },
];

type Row = {
  id: string;
  feature: string;
  model: string;
  temperature: number;
  enabled: boolean;
  notes: string | null;
  updated_at: string;
};

const FEATURE_LABEL: Record<string, string> = {
  parse: "Resume parsing",
  score: "ATS scoring",
  match: "JD ↔ resume matching",
  improve: "Improvement suggestions",
  chat: "Career advisor chat",
  rank: "Recruiter ranking",
};

function ModelsPage() {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateModelSetting);
  const testFn = useServerFn(testModel);

  const q = useQuery({
    queryKey: ["ai-model-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_model_settings").select("*").order("feature");
      if (error) throw error;
      return data as Row[];
    },
  });

  const [drafts, setDrafts] = useState<Record<string, Partial<Row>>>({});
  const [testing, setTesting] = useState<Record<string, { ok?: boolean; ms?: number; output?: string; message?: string; status?: number }>>({});

  const update = useMutation({
    mutationFn: async (r: Row) => updateFn({
      data: {
        id: r.id,
        model: r.model,
        temperature: Number(r.temperature),
        enabled: r.enabled,
        notes: r.notes ?? "",
      },
    }),
    onSuccess: (_v, r) => {
      toast.success(`Saved ${FEATURE_LABEL[r.feature] ?? r.feature}`);
      qc.invalidateQueries({ queryKey: ["ai-model-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runTest = async (r: Row) => {
    setTesting((t) => ({ ...t, [r.id]: { ms: 0 } }));
    try {
      const res = await testFn({ data: { model: r.model, prompt: "Ping — reply with a one-sentence status confirmation." } });
      setTesting((t) => ({ ...t, [r.id]: res }));
    } catch (e) {
      setTesting((t) => ({ ...t, [r.id]: { ok: false, message: (e as Error).message } }));
    }
  };

  if (q.isLoading) return <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (q.isError) return <div className="mt-10 text-sm text-destructive text-center">{(q.error as Error).message}</div>;

  return (
    <div className="mt-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Cpu className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-semibold">AI Model Management</div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Each feature calls Lovable AI Gateway. Choose the model, sampling temperature, and enable/disable it per feature.
              The API key is server-side and never exposed to the browser. Changes take effect on the next request.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4">
        {(q.data ?? []).map((row) => {
          const d = { ...row, ...(drafts[row.id] ?? {}) } as Row;
          const dirty = JSON.stringify(d) !== JSON.stringify(row);
          const test = testing[row.id];
          return (
            <Card key={row.id} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-display font-semibold">{FEATURE_LABEL[row.feature] ?? row.feature}</div>
                  <div className="text-xs text-muted-foreground">Feature key: <code className="font-mono">{row.feature}</code> · updated {new Date(row.updated_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={d.enabled} onCheckedChange={(v) => setDrafts((x) => ({ ...x, [row.id]: { ...d, enabled: v } }))} />
                  <span className="text-xs text-muted-foreground">{d.enabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label>Model</Label>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {CATALOG.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer text-xs ${
                          d.model === m.id ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          className="mt-0.5"
                          checked={d.model === m.id}
                          onChange={() => setDrafts((x) => ({ ...x, [row.id]: { ...d, model: m.id } }))}
                        />
                        <div className="min-w-0">
                          <div className="font-medium">{m.label}</div>
                          <div className="text-muted-foreground">{m.tier}</div>
                          <code className="text-[10px] text-muted-foreground">{m.id}</code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Temperature ({Number(d.temperature).toFixed(2)})</Label>
                  <Input
                    type="range" min={0} max={1.5} step={0.05}
                    value={d.temperature}
                    onChange={(e) => setDrafts((x) => ({ ...x, [row.id]: { ...d, temperature: Number(e.target.value) } }))}
                  />
                  <div className="text-[11px] text-muted-foreground mt-1">Low = deterministic. High = creative.</div>

                  <Label className="mt-4">Notes</Label>
                  <Textarea
                    rows={3}
                    value={d.notes ?? ""}
                    onChange={(e) => setDrafts((x) => ({ ...x, [row.id]: { ...d, notes: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => runTest(d)} disabled={!!test && test.ms === 0}>
                    {test && test.ms === 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Test model
                  </Button>
                  {test && test.ms !== 0 && (
                    <Badge variant={test.ok ? "secondary" : "destructive"} className="text-[10px]">
                      {test.ok ? `OK · ${test.ms}ms` : `Failed${test.status ? ` · ${test.status}` : ""}`}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  className="bg-primary-gradient"
                  disabled={!dirty || update.isPending}
                  onClick={() => update.mutate(d)}
                >
                  {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </div>

              {test && test.ms !== 0 && (test.output || test.message) && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <div className="font-medium mb-1">{test.ok ? "Response" : "Error"}</div>
                  <pre className="whitespace-pre-wrap break-words text-muted-foreground">{test.output ?? test.message}</pre>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
