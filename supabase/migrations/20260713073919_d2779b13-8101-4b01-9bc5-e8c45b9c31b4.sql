
-- AI Model settings (admin-controlled)
CREATE TABLE public.ai_model_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL UNIQUE, -- 'parse' | 'score' | 'match' | 'improve' | 'chat' | 'rank'
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  temperature numeric NOT NULL DEFAULT 0.2,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_settings TO authenticated;
GRANT ALL ON public.ai_model_settings TO service_role;
ALTER TABLE public.ai_model_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read model settings" ON public.ai_model_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert model settings" ON public.ai_model_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update model settings" ON public.ai_model_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete model settings" ON public.ai_model_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ai_model_settings_updated BEFORE UPDATE ON public.ai_model_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ai_model_settings (feature, model, temperature, notes) VALUES
  ('parse',    'google/gemini-3-flash-preview', 0.1, 'Resume PDF/DOCX parsing to structured JSON'),
  ('score',    'google/gemini-3-flash-preview', 0.2, 'ATS scoring & sub-scores'),
  ('match',    'google/gemini-3-flash-preview', 0.2, 'JD ↔ resume matching'),
  ('improve',  'google/gemini-3-flash-preview', 0.3, 'AI improvement suggestions'),
  ('chat',     'google/gemini-3-flash-preview', 0.5, 'Career advisor streaming chat'),
  ('rank',     'google/gemini-3-flash-preview', 0.2, 'Recruiter candidate ranking');

-- Extend has_role to also grant placement_officer/admin ability to read cross-user data
-- Add SELECT policies letting admin & placement_officer read aggregate data:
CREATE POLICY "Admin/placement read all resumes" ON public.resumes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'placement_officer'));
CREATE POLICY "Admin/placement read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'placement_officer'));
CREATE POLICY "Admin/placement read all jds" ON public.job_descriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'placement_officer'));
CREATE POLICY "Admin/placement read all shortlists" ON public.shortlists FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'placement_officer'));
CREATE POLICY "Admin read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
