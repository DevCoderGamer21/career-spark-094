CREATE TABLE public.security_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'ci',
  trigger text NOT NULL DEFAULT 'push',
  branch text,
  commit_sha text,
  run_url text,
  status text NOT NULL DEFAULT 'unknown',
  total_findings integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  new_findings integer NOT NULL DEFAULT 0,
  duration_ms integer,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  logs text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_scan_runs TO authenticated;
GRANT ALL ON public.security_scan_runs TO service_role;

ALTER TABLE public.security_scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read security scan runs"
  ON public.security_scan_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Placement officers read security scan runs"
  ON public.security_scan_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'placement_officer'::app_role));

CREATE INDEX security_scan_runs_created_at_idx ON public.security_scan_runs (created_at DESC);