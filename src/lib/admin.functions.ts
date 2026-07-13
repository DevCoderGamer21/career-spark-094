import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin role required");
}

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [profiles, resumes, jds, shortlists, roles, recentResumes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("resumes").select("id, ats_score, status, created_at"),
      supabase.from("job_descriptions").select("id, is_active, created_at"),
      supabase.from("shortlists").select("id, status, created_at"),
      supabase.from("user_roles").select("role"),
      supabase.from("resumes").select("id, filename, ats_score, status, created_at, user_id").order("created_at", { ascending: false }).limit(10),
    ]);

    const resumeRows = resumes.data ?? [];
    const roleCounts: Record<string, number> = {};
    for (const r of roles.data ?? []) roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1;

    const avgAts = resumeRows.filter((r: any) => r.ats_score != null).reduce((s: number, r: any) => s + r.ats_score, 0) /
      Math.max(1, resumeRows.filter((r: any) => r.ats_score != null).length);

    // 30-day daily resume counts
    const now = Date.now();
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 86400000);
      return { date: d.toISOString().slice(0, 10), count: 0 };
    });
    const dayIdx = new Map(days.map((d, i) => [d.date, i]));
    for (const r of resumeRows) {
      const k = (r.created_at as string).slice(0, 10);
      const i = dayIdx.get(k);
      if (i != null) days[i].count++;
    }

    return {
      totals: {
        users: profiles.count ?? 0,
        resumes: resumeRows.length,
        analyzed: resumeRows.filter((r: any) => r.status === "analyzed").length,
        jds: (jds.data ?? []).length,
        activeJds: (jds.data ?? []).filter((j: any) => j.is_active).length,
        shortlists: (shortlists.data ?? []).length,
        avgAts: Math.round(avgAts || 0),
      },
      roleCounts,
      timeline: days,
      recentResumes: recentResumes.data ?? [],
    };
  });

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [profiles, roles] = await Promise.all([
      supabase.from("profiles").select("id, full_name, headline, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    }
    return (profiles.data ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

const RoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "candidate", "recruiter", "placement_officer"]),
  grant: z.boolean(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => RoleInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.grant) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role }).select();
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    return { ok: true };
  });

const ModelUpdate = z.object({
  id: z.string().uuid(),
  model: z.string().min(3),
  temperature: z.number().min(0).max(2),
  enabled: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
});

export const updateModelSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ModelUpdate.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("ai_model_settings")
      .update({
        model: data.model,
        temperature: data.temperature,
        enabled: data.enabled,
        notes: data.notes ?? null,
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const testModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ model: z.string(), prompt: z.string().max(500) }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { callGateway } = await import("./ai.server");
    const t0 = Date.now();
    const res = await callGateway({
      model: data.model,
      messages: [
        { role: "system", content: "Reply concisely." },
        { role: "user", content: data.prompt || "Say hello in one sentence." },
      ],
      temperature: 0.3,
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, ms, status: res.status, message: text.slice(0, 400) };
    }
    const json = (await res.json()) as any;
    return { ok: true, ms, status: 200, output: json?.choices?.[0]?.message?.content ?? "(no content)" };
  });
