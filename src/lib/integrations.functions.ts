import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: any) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admin role required");
}

export type IntegrationEvent = {
  id: string; kind: string; ok: boolean; http_status: number | null; message: string | null; created_at: string;
};

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const [settings, events, lastRun] = await Promise.all([
      sb.from("security_notification_settings").select("*").eq("id", true).maybeSingle(),
      sb.from("integration_events").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("security_scan_runs").select("created_at, trigger, status").order("created_at", { ascending: false }).limit(1),
    ]);
    const secret = process.env["SECURITY_SCAN_INGEST_SECRET"] ?? "";
    return {
      ingestSecretSet: secret.length > 0,
      ingestSecretStrong: secret.length >= 32,
      slackConnected: !!process.env["SLACK_API_KEY"],
      emailReady: false,
      lastRun: (lastRun.data?.[0] ?? null) as { created_at: string; trigger: string; status: string } | null,
      settings: settings.data as {
        email_enabled: boolean; email_recipients: string[]; slack_enabled: boolean; slack_channel: string | null;
      } | null,
      events: (events.data ?? []) as IntegrationEvent[],
    };
  });

export const saveNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email_enabled: z.boolean(),
      email_recipients: z.array(z.string().trim().email()).max(20),
      slack_enabled: z.boolean(),
      slack_channel: z.string().trim().max(80).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("security_notification_settings")
      .upsert({ id: true, ...data, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifySecurityFindings } = await import("./security-notify.server");
    return notifySecurityFindings(supabaseAdmin, {
      branch: "main", total_findings: 1, critical_count: 0, warning_count: 1,
      findings: [{ title: "Example finding (test alert)", level: "warning" }],
    }, { test: true });
  });
