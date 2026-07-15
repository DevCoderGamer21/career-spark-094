-- Model test history
CREATE TABLE public.model_test_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL,
  prompt text NOT NULL,
  output text,
  latency_ms integer,
  status integer,
  ok boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.model_test_history TO authenticated;
GRANT ALL ON public.model_test_history TO service_role;
ALTER TABLE public.model_test_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all model tests" ON public.model_test_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Placement officers view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'placement_officer'));

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_model_test_history_created_at ON public.model_test_history(created_at DESC);
CREATE INDEX idx_model_test_history_admin ON public.model_test_history(admin_id);