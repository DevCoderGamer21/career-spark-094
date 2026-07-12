
-- BUILDER RESUMES
CREATE TABLE public.builder_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Resume',
  template TEXT NOT NULL DEFAULT 'ats',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX builder_resumes_user_idx ON public.builder_resumes(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_resumes TO authenticated;
GRANT ALL ON public.builder_resumes TO service_role;
ALTER TABLE public.builder_resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own builder resumes" ON public.builder_resumes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER builder_resumes_updated_at BEFORE UPDATE ON public.builder_resumes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SHORTLISTS
CREATE TABLE public.shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jd_id UUID NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
  resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  similarity INT,
  matched_skills TEXT[],
  missing_skills TEXT[],
  ai_analysis JSONB,
  notes TEXT,
  rank INT,
  status TEXT NOT NULL DEFAULT 'shortlisted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jd_id, resume_id)
);
CREATE INDEX shortlists_jd_idx ON public.shortlists(jd_id);
CREATE INDEX shortlists_recruiter_idx ON public.shortlists(recruiter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlists TO authenticated;
GRANT ALL ON public.shortlists TO service_role;
ALTER TABLE public.shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters view own shortlists; candidates view own; admins all"
  ON public.shortlists FOR SELECT TO authenticated
  USING (
    auth.uid() = recruiter_id
    OR auth.uid() = candidate_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'placement_officer')
  );
CREATE POLICY "Recruiters create shortlists" ON public.shortlists
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recruiter_id AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Recruiters manage shortlists" ON public.shortlists
  FOR UPDATE TO authenticated
  USING (auth.uid() = recruiter_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = recruiter_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters delete shortlists" ON public.shortlists
  FOR DELETE TO authenticated
  USING (auth.uid() = recruiter_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER shortlists_updated_at BEFORE UPDATE ON public.shortlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Self-service role grant (demo). Users can grant themselves recruiter/placement_officer.
CREATE OR REPLACE FUNCTION public.grant_self_role(_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _role = 'admin' THEN
    RAISE EXCEPTION 'Admin role cannot be self-granted';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), _role)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_self_role(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_self_role(public.app_role) TO authenticated;
