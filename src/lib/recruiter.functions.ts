import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RankInput = z.object({ jdId: z.string().uuid() });
const ShortlistInput = z.object({
  jdId: z.string().uuid(),
  resumeId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

type RankItem = {
  resume_id: string;
  candidate_id: string;
  candidate_name: string | null;
  filename: string;
  ats_score: number | null;
  similarity: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  gaps: string[];
  summary: string;
};

/**
 * Ranks every resume in the system against a recruiter's JD using AI.
 * Returns per-candidate similarity + matched/missing skills for heatmap rendering.
 * Results are cached in the shortlists table? No — kept as ephemeral analysis;
 * we only persist rows when the recruiter explicitly shortlists a candidate.
 */
export const rankCandidatesForJD = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => RankInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is a recruiter (or admin) and owns the JD (or admin)
    const { data: isRecruiter } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "recruiter",
    });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isRecruiter && !isAdmin) throw new Error("Recruiter role required");

    const { data: jd, error: jdErr } = await supabase
      .from("job_descriptions")
      .select("id, recruiter_id, title, description, required_skills")
      .eq("id", data.jdId)
      .maybeSingle();
    if (jdErr || !jd) throw new Error("Job description not found");
    if (jd.recruiter_id !== userId && !isAdmin) throw new Error("Forbidden");

    // Fetch analyzed resumes (RLS lets recruiters view all)
    const { data: resumes, error: rErr } = await supabase
      .from("resumes")
      .select("id, user_id, filename, parsed, skills, ats_score")
      .eq("status", "analyzed")
      .limit(50);
    if (rErr) throw rErr;
    if (!resumes || resumes.length === 0) return { jd, ranked: [] as RankItem[] };

    const userIds = Array.from(new Set(resumes.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const { callGatewayJSON } = await import("./ai.server");

    // AI batch scoring: send condensed candidate summaries in one call for efficiency.
    type Candidate = {
      resume_id: string;
      skills: string[];
      summary: string;
      experience: string;
    };
    const candidates: Candidate[] = resumes.map((r) => {
      const p = (r.parsed ?? {}) as Record<string, unknown>;
      const exp = Array.isArray(p.experience)
        ? (p.experience as Array<Record<string, unknown>>)
            .slice(0, 3)
            .map((e) => `${e.title ?? ""} @ ${e.company ?? ""}`)
            .join("; ")
        : "";
      return {
        resume_id: r.id,
        skills: (r.skills ?? []).slice(0, 40),
        summary: typeof p.summary === "string" ? p.summary.slice(0, 400) : "",
        experience: exp,
      };
    });

    type AIResult = {
      results: Array<{
        resume_id: string;
        similarity: number;
        matched_skills: string[];
        missing_skills: string[];
        strengths: string[];
        gaps: string[];
        summary: string;
      }>;
    };

    const ai = await callGatewayJSON<AIResult>({
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert technical recruiter. Rank candidates against a job description. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `JOB TITLE: ${jd.title}\nREQUIRED SKILLS: ${(jd.required_skills ?? []).join(", ")}\n\nJD:\n${jd.description.slice(0, 4000)}\n\nCANDIDATES (JSON):\n${JSON.stringify(candidates).slice(0, 15000)}\n\nReturn JSON:
{
  "results": [
    {
      "resume_id": string (must match input),
      "similarity": integer 0-100,
      "matched_skills": string[] (skills the candidate has that the JD wants),
      "missing_skills": string[] (JD skills the candidate lacks),
      "strengths": string[] (2-3 bullet points),
      "gaps": string[] (2-3 bullet points),
      "summary": string (1 sentence)
    }
  ]
}
Include one entry per candidate. Be strict and honest.`,
        },
      ],
    });

    const byId = new Map(ai.results.map((r) => [r.resume_id, r]));
    const ranked: RankItem[] = resumes
      .map((r) => {
        const s = byId.get(r.id);
        return {
          resume_id: r.id,
          candidate_id: r.user_id,
          candidate_name: nameMap.get(r.user_id) ?? null,
          filename: r.filename,
          ats_score: r.ats_score,
          similarity: s?.similarity ?? 0,
          matched_skills: s?.matched_skills ?? [],
          missing_skills: s?.missing_skills ?? [],
          strengths: s?.strengths ?? [],
          gaps: s?.gaps ?? [],
          summary: s?.summary ?? "",
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    return { jd, ranked };
  });

export const shortlistCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ShortlistInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: resume } = await supabase
      .from("resumes")
      .select("id, user_id")
      .eq("id", data.resumeId)
      .maybeSingle();
    if (!resume) throw new Error("Resume not found");

    const { data: jd } = await supabase
      .from("job_descriptions")
      .select("id, recruiter_id")
      .eq("id", data.jdId)
      .maybeSingle();
    if (!jd) throw new Error("JD not found");
    if (jd.recruiter_id !== userId) throw new Error("Forbidden");

    const { data: row, error } = await supabase
      .from("shortlists")
      .upsert(
        {
          recruiter_id: userId,
          jd_id: data.jdId,
          resume_id: data.resumeId,
          candidate_id: resume.user_id,
          notes: data.notes ?? null,
          status: "shortlisted",
        },
        { onConflict: "jd_id,resume_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });
