-- 1. Immutability: block UPDATE/DELETE on audit_logs for every role, including service_role
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs records are immutable (attempted %)', TG_OP;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_audit_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.audit_logs TO service_role;

-- 2. Automatic, database-level logging of every privilege change on user_roles
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _actor_role text;
  _target uuid;
  _role app_role;
  _method text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _target := NEW.user_id; _role := NEW.role;
  ELSE
    _target := OLD.user_id; _role := OLD.role;
  END IF;

  IF _actor IS NULL THEN
    _actor_role := 'service';
    _method := 'server';
  ELSIF public.has_role(_actor, 'admin') THEN
    _actor_role := 'admin';
    _method := CASE WHEN _actor = _target THEN 'self' ELSE 'admin' END;
  ELSIF _actor = _target AND TG_OP = 'INSERT' AND _role = 'admin' THEN
    _actor_role := 'user';
    _method := 'claim_first_admin';
  ELSIF _actor = _target THEN
    _actor_role := 'user';
    _method := 'self_service';
  ELSE
    _actor_role := 'user';
    _method := 'other';
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    _actor,
    _actor_role,
    CASE WHEN TG_OP = 'INSERT' THEN 'role.grant' ELSE 'role.revoke' END,
    'user',
    _target::text,
    jsonb_build_object('role', _role, 'method', _method, 'source', 'db_trigger')
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_user_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_user_roles_insert ON public.user_roles;
CREATE TRIGGER audit_user_roles_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();

DROP TRIGGER IF EXISTS audit_user_roles_delete ON public.user_roles;
CREATE TRIGGER audit_user_roles_delete
AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();