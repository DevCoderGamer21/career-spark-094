import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Ingest endpoint for automated security scan runs (CI + nightly schedule).
 *
 * Auth: HMAC-SHA256 of the raw body using SECURITY_SCAN_INGEST_SECRET,
 * sent as `x-scan-signature`. Writes are service-role only; nothing here
 * reads or returns user data.
 */

const findingSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  level: z.enum(["critical", "warning", "info"]).default("info"),
  detail: z.string().optional(),
  source: z.string().optional(),
});

const payloadSchema = z.object({
  source: z.string().max(40).default("ci"),
  trigger: z.string().max(40).default("push"),
  branch: z.string().max(200).optional(),
  commit_sha: z.string().max(80).optional(),
  run_url: z.string().max(500).optional(),
  status: z.enum(["passed", "failed", "unknown"]).default("unknown"),
  duration_ms: z.number().int().nonnegative().optional(),
  findings: z.array(findingSchema).max(500).default([]),
  logs: z.string().max(200_000).optional(),
});

function verify(rawBody: string, signature: string | null) {
  const secret = process.env["SECURITY_SCAN_INGEST_SECRET"];
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature.replace(/^sha256=/, ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/security-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { logIntegrationEvent, notifySecurityFindings } = await import("@/lib/security-notify.server");
        const fail = async (status: number, message: string) => {
          await logIntegrationEvent(supabaseAdmin, { kind: "ingest", ok: false, http_status: status, message }).catch(() => {});
          return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
        };
        if (!process.env["SECURITY_SCAN_INGEST_SECRET"]) return fail(500, "Ingest secret not configured on the app");
        if (!request.headers.get("x-scan-signature")) return fail(401, "Missing x-scan-signature header");
        if (!verify(raw, request.headers.get("x-scan-signature"))) {
          return fail(401, "Signature mismatch — GitHub secret differs from the app secret");
        }

        let json: unknown;
        try { json = JSON.parse(raw); } catch { return fail(400, "Body is not valid JSON"); }
        const parsed = payloadSchema.safeParse(json);
        if (!parsed.success) {
          return fail(400, "Invalid payload: " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
        }
        const p = parsed.data;

        const counts = { critical: 0, warning: 0, info: 0 };
        for (const f of p.findings) counts[f.level]++;

        // "new" = fingerprints not seen in the previous run on the same branch
        const { data: prev } = await supabaseAdmin
          .from("security_scan_runs")
          .select("findings")
          .eq("branch", p.branch ?? "")
          .order("created_at", { ascending: false })
          .limit(1);
        const seen = new Set(
          (((prev?.[0] as any)?.findings as any[]) ?? []).map((f) => f.id ?? f.title),
        );
        const newFindings = p.findings.filter((f) => !seen.has(f.id ?? f.title)).length;

        const { data, error } = await supabaseAdmin
          .from("security_scan_runs")
          .insert({
            source: p.source,
            trigger: p.trigger,
            branch: p.branch ?? null,
            commit_sha: p.commit_sha ?? null,
            run_url: p.run_url ?? null,
            status: p.status,
            total_findings: p.findings.length,
            critical_count: counts.critical,
            warning_count: counts.warning,
            info_count: counts.info,
            new_findings: newFindings,
            duration_ms: p.duration_ms ?? null,
            findings: p.findings as any,
            logs: p.logs ?? null,
          })
          .select("id")
          .single();

        if (error) return fail(500, "Store failed: " + error.message);

        await logIntegrationEvent(supabaseAdmin, {
          kind: "ingest", ok: true, http_status: 200, run_id: data.id,
          message: `Stored ${p.trigger} run (${p.findings.length} findings)`,
        });

        if (p.trigger === "nightly" && p.findings.length > 0) {
          await notifySecurityFindings(supabaseAdmin, {
            id: data.id, branch: p.branch, run_url: p.run_url, total_findings: p.findings.length,
            critical_count: counts.critical, warning_count: counts.warning, findings: p.findings,
          }).catch((e) => logIntegrationEvent(supabaseAdmin, { kind: "notify", ok: false, message: String(e), run_id: data.id }));
        }

        return new Response(JSON.stringify({ ok: true, id: data.id, new_findings: newFindings }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
