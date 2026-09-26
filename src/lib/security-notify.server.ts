// Server-only: sends nightly security alerts and records delivery outcomes.
type Admin = any;

export async function logIntegrationEvent(
  admin: Admin,
  e: { kind: string; ok: boolean; http_status?: number | null; message?: string | null; run_id?: string | null },
) {
  await admin.from("integration_events").insert({
    kind: e.kind,
    ok: e.ok,
    http_status: e.http_status ?? null,
    message: e.message ? e.message.slice(0, 1000) : null,
    run_id: e.run_id ?? null,
  });
}

export type AlertRun = {
  id?: string | null;
  branch?: string | null;
  run_url?: string | null;
  total_findings: number;
  critical_count: number;
  warning_count: number;
  findings: { title: string; level: string }[];
};

function summary(r: AlertRun) {
  const top = r.findings.slice(0, 10).map((f) => `• [${f.level}] ${f.title}`).join("\n");
  return [
    `Nightly security scan found ${r.total_findings} issue(s) on ${r.branch ?? "main"} ` +
      `(${r.critical_count} critical, ${r.warning_count} warning).`,
    top,
    r.run_url ? `Run: ${r.run_url}` : "",
  ].filter(Boolean).join("\n");
}

export async function sendSlack(channel: string, text: string) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const slack = process.env["SLACK_API_KEY"];
  if (!lovable || !slack) return { ok: false, status: null, message: "Slack is not connected" };
  const res = await fetch("https://connector-gateway.lovable.dev/slack/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": slack,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text, username: "Security Alerts" }),
  });
  const body = await res.text();
  let data: any = {};
  try { data = JSON.parse(body); } catch { /* non-JSON */ }
  if (!res.ok || !data.ok) {
    return { ok: false, status: res.status, message: `Slack error: ${data.error ?? body.slice(0, 300)}` };
  }
  return { ok: true, status: res.status, message: `Posted to ${channel}` };
}

export async function sendEmail(_to: string[], _subject: string, _text: string) {
  // Email sending activates once a sender domain is set up for the app.
  return { ok: false, status: null, message: "Email sender domain is not set up yet" };
}

export async function notifySecurityFindings(admin: Admin, run: AlertRun, opts: { test?: boolean } = {}) {
  const { data: s } = await admin.from("security_notification_settings").select("*").eq("id", true).maybeSingle();
  if (!s) return [];
  const text = (opts.test ? "[Test] " : "") + summary(run);
  const results: { kind: string; ok: boolean; message: string }[] = [];
  if (s.slack_enabled && s.slack_channel) {
    const r = await sendSlack(s.slack_channel, text);
    await logIntegrationEvent(admin, { kind: "slack", ok: r.ok, http_status: r.status, message: r.message, run_id: run.id });
    results.push({ kind: "slack", ok: r.ok, message: r.message });
  }
  if (s.email_enabled && s.email_recipients?.length) {
    const r = await sendEmail(s.email_recipients, "Security scan findings", text);
    await logIntegrationEvent(admin, { kind: "email", ok: r.ok, http_status: r.status, message: r.message, run_id: run.id });
    results.push({ kind: "email", ok: r.ok, message: r.message });
  }
  return results;
}
