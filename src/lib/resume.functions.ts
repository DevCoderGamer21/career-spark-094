import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({ resumeId: z.string().uuid() });
const MatchInput = z.object({
  resumeId: z.string().uuid(),
  jdText: z.string().min(20).max(20000),
  jdTitle: z.string().max(200).optional(),
});
const ImproveInput = z.object({ resumeId: z.string().uuid() });

const PARSE_SYSTEM = `You are an expert resume analyzer. Extract structured data from the resume and evaluate it against modern ATS (Applicant Tracking System) standards. Output ONLY valid JSON, no prose.`;

const PARSE_PROMPT = `Analyze the attached resume file. Return a single JSON object with this exact shape:
{
  "parsed": {
    "name": string | null,
    "email": string | null,
    "phone": string | null,
    "linkedin": string | null,
    "github": string | null,
    "portfolio": string | null,
    "summary": string | null,
    "skills": string[],
    "education": [{"institution": string, "degree": string, "field": string|null, "year": string|null, "gpa": string|null}],
    "experience": [{"company": string, "title": string, "start": string|null, "end": string|null, "description": string, "highlights": string[]}],
    "projects": [{"name": string, "description": string, "tech": string[]}],
    "certifications": string[],
    "languages": string[],
    "achievements": string[]
  },
  "ats_score": integer 0-100,
  "ats_breakdown": {
    "formatting": integer 0-100,
    "keywords": integer 0-100,
    "skills": integer 0-100,
    "experience": integer 0-100,
    "education": integer 0-100,
    "projects": integer 0-100,
    "achievements": integer 0-100,
    "grammar": integer 0-100,
    "ats_compatibility": integer 0-100
  },
  "score_reasoning": string (2-3 sentences explaining the overall score)
}
Be honest and accurate. Missing sections should score low. Use null for missing scalar values, empty arrays for missing lists.`;

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => AnalyzeInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch resume record
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("id, user_id, file_path, filename, mime_type")
      .eq("id", data.resumeId)
      .maybeSingle();
    if (error || !resume) throw new Error("Resume not found");
    if (resume.user_id !== userId) throw new Error("Forbidden");

    await supabase.from("resumes").update({ status: "analyzing" }).eq("id", data.resumeId);

    // Download file bytes
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from("resumes")
      .download(resume.file_path);
    if (dlErr || !fileBlob) throw new Error("Could not read resume file");

    const arrayBuf = await fileBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const mime = resume.mime_type || "application/pdf";
    const dataUrl = `data:${mime};base64,${base64}`;

    // Call Lovable AI Gateway with the file
    const { callGatewayJSON } = await import("./ai.server");
    type AnalyzeResult = {
      parsed: Record<string, unknown> & { skills?: string[] };
      ats_score: number;
      ats_breakdown: Record<string, number>;
      score_reasoning: string;
    };
    const result = await callGatewayJSON<AnalyzeResult>({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: PARSE_PROMPT },
            {
              type: "file",
              file: { filename: resume.filename, file_data: dataUrl },
            },
          ],
        },
      ],
    });

    const skills = Array.isArray(result.parsed?.skills) ? result.parsed.skills : [];
    const atsScore = Math.max(0, Math.min(100, Math.round(result.ats_score ?? 0)));

    const { error: updErr } = await supabase
      .from("resumes")
      .update({
        parsed: result.parsed,
        skills,
        ats_score: atsScore,
        ats_breakdown: { ...result.ats_breakdown, reasoning: result.score_reasoning },
        status: "analyzed",
      })
      .eq("id", data.resumeId);
    if (updErr) throw updErr;

    return { ok: true, ats_score: atsScore };
  });

export const matchJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => MatchInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: resume, error } = await supabase
      .from("resumes")
      .select("id, user_id, parsed, skills")
      .eq("id", data.resumeId)
      .maybeSingle();
    if (error || !resume) throw new Error("Resume not found");
    if (resume.user_id !== userId) throw new Error("Forbidden");

    const { callGatewayJSON } = await import("./ai.server");
    type MatchResult = {
      similarity: number;
      matched_skills: string[];
      missing_skills: string[];
      strengths: string[];
      gaps: string[];
      recommendations: Array<{ skill: string; why: string; resource: string }>;
      summary: string;
    };

    const result = await callGatewayJSON<MatchResult>({
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert technical recruiter. Compare a candidate's resume to a job description. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `RESUME JSON:\n${JSON.stringify(resume.parsed).slice(0, 12000)}\n\nJOB DESCRIPTION:\n${data.jdText}\n\nReturn JSON:
{
  "similarity": integer 0-100,
  "matched_skills": string[],
  "missing_skills": string[],
  "strengths": string[] (bullet points),
  "gaps": string[] (bullet points),
  "recommendations": [{"skill": string, "why": string, "resource": string (course/cert name)}],
  "summary": string (2 sentences)
}`,
        },
      ],
    });

    const sim = Math.max(0, Math.min(100, Math.round(result.similarity ?? 0)));

    const { data: inserted, error: insErr } = await supabase
      .from("jd_matches")
      .insert({
        user_id: userId,
        resume_id: data.resumeId,
        jd_text: data.jdText,
        jd_title: data.jdTitle ?? null,
        similarity: sim,
        matched_skills: result.matched_skills ?? [],
        missing_skills: result.missing_skills ?? [],
        recommendations: {
          strengths: result.strengths ?? [],
          gaps: result.gaps ?? [],
          recommendations: result.recommendations ?? [],
          summary: result.summary ?? "",
        },
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return inserted;
  });

export const improveResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ImproveInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("id, user_id, parsed")
      .eq("id", data.resumeId)
      .maybeSingle();
    if (error || !resume) throw new Error("Resume not found");
    if (resume.user_id !== userId) throw new Error("Forbidden");

    const { callGatewayJSON } = await import("./ai.server");
    type ImproveResult = {
      overall_feedback: string;
      priority_actions: string[];
      section_suggestions: Array<{ section: string; issue: string; fix: string; example?: string }>;
      rewritten_bullets: Array<{ original: string; improved: string }>;
    };
    const result = await callGatewayJSON<ImproveResult>({
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior career coach. Provide sharp, actionable resume improvement advice. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Resume: ${JSON.stringify(resume.parsed).slice(0, 12000)}\n\nReturn JSON:
{
  "overall_feedback": string (2-3 sentences),
  "priority_actions": string[] (top 5),
  "section_suggestions": [{"section": string, "issue": string, "fix": string, "example": string}],
  "rewritten_bullets": [{"original": string, "improved": string}] (5-8 measurable/quantified rewrites)
}`,
        },
      ],
    });

    await supabase
      .from("resumes")
      .update({ improvement_tips: result })
      .eq("id", data.resumeId);

    return result;
  });
