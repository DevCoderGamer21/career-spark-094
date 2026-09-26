CREATE TABLE public.security_notification_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  email_enabled boolean NOT NULL DEFAULT false,
  email_recipients text[] NOT NULL DEFAULT '{}',
  slack_enabled boolean NOT NULL DEFAULT false,
  slack_channel text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.security_notification_settings TO authenticated;
GRANT ALL ON public.security_notification_settings TO service_role;
ALTER TABLE public.security_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notification settings" ON public.security_notification_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert notification settings" ON public.security_notification_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update notification settings" ON public.security_notification_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.security_notification_settings (id) VALUES (true);

CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  ok boolean NOT NULL,
  http_status integer,
  message text,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_events_created_idx ON public.integration_events (created_at DESC);
GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read integration events" ON public.integration_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));