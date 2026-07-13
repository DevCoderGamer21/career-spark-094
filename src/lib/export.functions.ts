import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ jdId: z.string().uuid() });

export const getShortlistExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: jd, error: jdErr } = await supabase
      .from("job_descriptions")
      .select("id, recruiter_id, title, company, location, required_skills")
      .eq("id", data.jdId)
      .maybeSingle();
    if (jdErr || !jd) throw new Error("JD not found");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (jd.recruiter_id !== userId && !isAdmin) throw new Error("Forbidden");

    const { data: rows, error } = await supabase
      .from("shortlists")
      .select("id, resume_id, candidate_id, similarity, matched_skills, missing_skills, notes, status, created_at")
      .eq("jd_id", data.jdId)
      .order("similarity", { ascending: false, nullsFirst: false });
    if (error) throw error;

    const resumeIds = (rows ?? []).map((r) => r.resume_id);
    const candIds = (rows ?? []).map((r) => r.candidate_id);

    const [resumesRes, profilesRes] = await Promise.all([
      supabase.from("resumes").select("id, filename, ats_score, ats_breakdown, skills, parsed").in("id", resumeIds.length ? resumeIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("profiles").select("id, full_name, headline, phone, linkedin_url, github_url, college, graduation_year").in("id", candIds.length ? candIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const resumeMap = new Map((resumesRes.data ?? []).map((r: any) => [r.id, r]));
    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

    const candidates = (rows ?? []).map((s: any) => {
      const r = resumeMap.get(s.resume_id) as any;
      const p = profileMap.get(s.candidate_id) as any;
      const parsed = (r?.parsed ?? {}) as any;
      return {
        name: p?.full_name ?? parsed?.name ?? "—",
        headline: p?.headline ?? parsed?.headline ?? null,
        email: parsed?.email ?? null,
        phone: p?.phone ?? parsed?.phone ?? null,
        linkedin: p?.linkedin_url ?? null,
        github: p?.github_url ?? null,
        college: p?.college ?? null,
        graduation_year: p?.graduation_year ?? null,
        filename: r?.filename ?? "",
        ats_score: r?.ats_score ?? null,
        similarity: s.similarity ?? 0,
        matched_skills: s.matched_skills ?? [],
        missing_skills: s.missing_skills ?? [],
        skills: r?.skills ?? [],
        status: s.status,
        notes: s.notes,
        shortlisted_at: s.created_at,
      };
    });

    return { jd, candidates };
  });
