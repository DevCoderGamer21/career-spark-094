import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getIntegrationStatus, saveNotificationSettings, sendTestNotification } from "@/lib/integrations.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({ meta: [{ title: "Integration status — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: IntegrationsPage,
});

function Check({ ok, warn, label, hint }: { ok: boolean; warn?: boolean; label: string; hint: string }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  const tone = ok ? "text-primary" : warn ? "text-muted-foreground" : "text-destructive";
  return (
    <div className="flex gap-3 py-2">
      <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function IntegrationsPage() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getIntegrationStatus);
  const saveFn = useServerFn(saveNotificationSettings);
  const testFn = useServerFn(sendTestNotification);
  const q = useQuery({ queryKey: ["integration-status"], queryFn: () => statusFn() });

  const [emailOn, setEmailOn] = useState(false);
  const [emails, setEmails] = useState("");
  const [slackOn, setSlackOn] = useState(false);
  const [channel, setChannel] = useState("");

  useEffect(() => {
    const s = q.data?.settings;
    if (!s) return;
    setEmailOn(s.email_enabled);
    setEmails(s.email_recipients.join(", "));
    setSlackOn(s.slack_enabled);
    setChannel(s.slack_channel ?? "");
  }, [q.data?.settings]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          email_enabled: emailOn,
          email_recipients: emails.split(/[,\s]+/).filter(Boolean),
          slack_enabled: slackOn,
          slack_channel: channel.trim() || null,
        },
      }),
    onSuccess: () => { toast.success("Alert settings saved"); qc.invalidateQueries({ queryKey: ["integration-status"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => {
      if (!r.length) toast.info("No alert channel is enabled");
      r.forEach((x) => (x.ok ? toast.success(`${x.kind}: ${x.message}`) : toast.error(`${x.kind}: ${x.message}`)));
      qc.invalidateQueries({ queryKey: ["integration-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (q.isError || !q.data) return <div className="mt-10 text-center text-sm text-destructive">{(q.error as Error)?.message}</div>;
  const d = q.data;
  const ingest = d.events.filter((e) => e.kind === "ingest");
  const lastOk = ingest.find((e) => e.ok);
  const errors = d.events.filter((e) => !e.ok);
  const ingestUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/hooks/security-scan` : "";
  const stale = d.lastRun ? Date.now() - new Date(d.lastRun.created_at).getTime() > 36 * 3600e3 : true;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="font-semibold">Scan-ingest configuration</h2>
        <div className="mt-3 divide-y">
          <Check ok={d.ingestSecretSet && d.ingestSecretStrong} label="Signing secret stored in the app"
            hint={d.ingestSecretSet ? (d.ingestSecretStrong ? "Present and strong." : "Present but shorter than 32 characters.") : "Missing — every delivery will be rejected."} />
          <Check ok={!!lastOk} label="Deliveries received from CI"
            hint={lastOk ? `Last accepted ${new Date(lastOk.created_at).toLocaleString()}` : "None yet. Add SCAN_INGEST_URL and SECURITY_SCAN_INGEST_SECRET as GitHub repository secrets."} />
          <Check ok={!stale} warn={stale && !!d.lastRun} label="Scan history is current"
            hint={d.lastRun ? `Latest ${d.lastRun.trigger} run ${new Date(d.lastRun.created_at).toLocaleString()} (${d.lastRun.status})` : "No scans stored yet."} />
        </div>
        <div className="mt-3 rounded-md bg-muted p-3 text-xs">
          <div className="text-muted-foreground">SCAN_INGEST_URL for GitHub</div>
          <code className="break-all">{ingestUrl}</code>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Nightly finding alerts</h2>
          <span className="text-xs text-muted-foreground">Sent whenever a nightly run has findings</span>
        </div>
        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Slack</Label>
              <Switch checked={slackOn} onCheckedChange={setSlackOn} />
            </div>
            <Input placeholder="#security-alerts" value={channel} onChange={(e) => setChannel(e.target.value)} />
            {!d.slackConnected && <p className="text-xs text-destructive">Slack isn't connected yet.</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Email</Label>
              <Switch checked={emailOn} onCheckedChange={setEmailOn} />
            </div>
            <Input placeholder="you@company.com, team@company.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
            {!d.emailReady && <p className="text-xs text-destructive">A sender email domain must be set up before emails go out.</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              <Send className="mr-1.5 h-4 w-4" /> Send test alert
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h2 className="font-semibold">Recent delivery errors</h2>
        {errors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No errors recorded.</p>
        ) : (
          <div className="mt-3 divide-y">
            {errors.slice(0, 25).map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <Badge variant="destructive">{e.kind}</Badge>
                {e.http_status && <Badge variant="outline">{e.http_status}</Badge>}
                <span className="flex-1">{e.message}</span>
                <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
