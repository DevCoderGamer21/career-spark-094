ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS seq bigint,
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS record_hash text;

CREATE SEQUENCE IF NOT EXISTS public.audit_logs_seq_seq OWNED BY public.audit_logs.seq;

CREATE OR REPLACE FUNCTION public.audit_log_payload(
  _seq bigint, _actor uuid, _actor_role text, _action text,
  _target_type text, _target_id text, _metadata jsonb, _created_at timestamptz, _prev_hash text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $hash$
BEGIN
  RETURN (
  SELECT encode(sha256(convert_to(
    coalesce(_seq::text,'') || '|' || coalesce(_actor::text,'') || '|' || coalesce(_actor_role,'') || '|' ||
    coalesce(_action,'') || '|' || coalesce(_target_type,'') || '|' || coalesce(_target_id,'') || '|' ||
    coalesce(_created_at::text,'') || '|' || coalesce(_metadata::text,'') || '|' ||
    coalesce(_prev_hash,'GENESIS'), 'UTF8')), 'hex')
  );
END;
$hash$;

REVOKE ALL ON FUNCTION public.audit_log_payload(bigint, uuid, text, text, text, text, jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_log_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _prev text;
BEGIN
  NEW.seq := nextval('public.audit_logs_seq_seq');
  SELECT record_hash INTO _prev FROM public.audit_logs ORDER BY seq DESC NULLS LAST LIMIT 1;
  NEW.prev_hash := _prev;
  NEW.record_hash := public.audit_log_payload(
    NEW.seq, NEW.actor_id, NEW.actor_role, NEW.action,
    NEW.target_type, NEW.target_id, NEW.metadata, NEW.created_at, _prev
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_chain() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_logs_chain ON public.audit_logs;
CREATE TRIGGER audit_logs_chain
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.audit_log_chain();

-- Back-fill existing rows into the chain, oldest first.
DO $backfill$
DECLARE
  r record;
  _prev text;
  _seq bigint;
BEGIN
  FOR r IN SELECT * FROM public.audit_logs WHERE record_hash IS NULL ORDER BY created_at, id LOOP
    _seq := nextval('public.audit_logs_seq_seq');
    UPDATE public.audit_logs SET
      seq = _seq,
      prev_hash = _prev,
      record_hash = public.audit_log_payload(_seq, r.actor_id, r.actor_role, r.action, r.target_type, r.target_id, r.metadata, r.created_at, _prev)
    WHERE id = r.id;
    SELECT record_hash INTO _prev FROM public.audit_logs WHERE id = r.id;
  END LOOP;
END;
$backfill$;

CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_seq_key ON public.audit_logs (seq);

CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS TABLE (checked bigint, ok boolean, first_bad_seq bigint, first_bad_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  _prev text;
  _expected text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  checked := 0; ok := true; first_bad_seq := NULL; first_bad_id := NULL;
  FOR r IN SELECT * FROM public.audit_logs ORDER BY seq LOOP
    checked := checked + 1;
    _expected := public.audit_log_payload(r.seq, r.actor_id, r.actor_role, r.action, r.target_type, r.target_id, r.metadata, r.created_at, _prev);
    IF r.record_hash IS DISTINCT FROM _expected OR r.prev_hash IS DISTINCT FROM _prev THEN
      ok := false; first_bad_seq := r.seq; first_bad_id := r.id;
      RETURN NEXT; RETURN;
    END IF;
    _prev := r.record_hash;
  END LOOP;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_audit_chain() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO authenticated;