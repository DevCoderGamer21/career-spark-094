import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPlacementAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("has_role", { _user_id: userId, _role: "placement_officer" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!allowed && !isAdmin) throw new Error("Placement officer role required");

    const [profiles, resumes, jds, shortlists] = await Promise.all([
      supabase.from("profiles").select("id, full_name, college, graduation_year"),
      supabase.from("resumes").select("id, user_id, ats_score, status, skills"),
      supabase.from("job_descriptions").select("id, title, company, is_active, created_at"),
      supabase.from("shortlists").select("id, jd_id, candidate_id, status, created_at"),
    ]);

    const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const analyzed = (resumes.data ?? []).filter((r: any) => r.status === "analyzed");

    // Readiness buckets by ATS
    const buckets = { high: 0, mid: 0, low: 0, none: 0 };
    for (const r of analyzed) {
      if (r.ats_score == null) buckets.none++;
      else if (r.ats_score >= 75) buckets.high++;
      else if (r.ats_score >= 50) buckets.mid++;
      else buckets.low++;
    }

    // Top skills across candidates
    const skillTally: Record<string, number> = {};
    for (const r of analyzed) {
      for (const s of r.skills ?? []) skillTally[s] = (skillTally[s] ?? 0) + 1;
    }
    const topSkills = Object.entries(skillTally).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([skill, count]) => ({ skill, count }));

    // Graduation year distribution
    const gradYear: Record<string, number> = {};
    for (const p of profiles.data ?? []) {
      if (p.graduation_year) gradYear[String(p.graduation_year)] = (gradYear[String(p.graduation_year)] ?? 0) + 1;
    }

    // Placements per JD (shortlist counts)
    const jdMap = new Map((jds.data ?? []).map((j: any) => [j.id, j]));
    const jdCounts = new Map<string, number>();
    for (const s of shortlists.data ?? []) jdCounts.set(s.jd_id, (jdCounts.get(s.jd_id) ?? 0) + 1);
    const pipeline = Array.from(jdCounts.entries())
      .map(([jdId, count]) => ({ jd: jdMap.get(jdId), count }))
      .filter((x) => x.jd)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Candidate readiness list
    const readiness = analyzed
      .map((r: any) => ({
        user_id: r.user_id,
        name: (profileMap.get(r.user_id) as any)?.full_name ?? "—",
        college: (profileMap.get(r.user_id) as any)?.college ?? null,
        ats: r.ats_score ?? 0,
        skills: (r.skills ?? []).length,
      }))
      .sort((a, b) => b.ats - a.ats)
      .slice(0, 50);

    return {
      totals: {
        candidates: (profiles.data ?? []).length,
        analyzed: analyzed.length,
        jds: (jds.data ?? []).length,
        shortlists: (shortlists.data ?? []).length,
      },
      buckets,
      topSkills,
      gradYear,
      pipeline,
      readiness,
    };
  });
