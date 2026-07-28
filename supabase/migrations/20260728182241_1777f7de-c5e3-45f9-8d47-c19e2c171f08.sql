-- 1) Organization basics readable, settings stay admin-only via RPC
GRANT SELECT (id, name, slug, logo_url, code, created_at, updated_at) ON public.organizations TO authenticated;
GRANT UPDATE (name, slug, logo_url, code) ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

-- 2) Module access mechanism (per-user overrides)
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permission_exceptions
    WHERE user_id = _user_id
      AND permission = 'module.' || _module_id
      AND is_granted = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- 3) Quiz collaborators
CREATE TABLE IF NOT EXISTS public.quiz_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_bank_id uuid NOT NULL REFERENCES public.quiz_banks(id) ON DELETE CASCADE,
  user_id uuid,
  invite_email text,
  permission text NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer','editor')),
  invite_token text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_collab_target_chk CHECK (user_id IS NOT NULL OR invite_email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_collab_token ON public.quiz_collaborators(invite_token);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_collab_user ON public.quiz_collaborators(quiz_bank_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_collab_email ON public.quiz_collaborators(quiz_bank_id, lower(invite_email)) WHERE invite_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_collab_quiz ON public.quiz_collaborators(quiz_bank_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_collaborators TO authenticated;
GRANT ALL ON public.quiz_collaborators TO service_role;
ALTER TABLE public.quiz_collaborators ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_quiz_collab_updated_at ON public.quiz_collaborators;
CREATE TRIGGER trg_quiz_collab_updated_at BEFORE UPDATE ON public.quiz_collaborators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Access helpers
CREATE OR REPLACE FUNCTION public.is_quiz_owner(_user_id uuid, _quiz_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.quiz_banks q WHERE q.id = _quiz_id AND q.created_by = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_edit_quiz_bank(_user_id uuid, _quiz_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.is_admin(_user_id)
    OR public.is_quiz_owner(_user_id, _quiz_id)
    OR EXISTS (
      SELECT 1 FROM public.quiz_collaborators c
      WHERE c.quiz_bank_id = _quiz_id AND c.user_id = _user_id
        AND c.permission = 'editor' AND c.accepted_at IS NOT NULL
    )
$$;

CREATE OR REPLACE FUNCTION public.can_view_quiz_bank(_user_id uuid, _quiz_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.can_edit_quiz_bank(_user_id, _quiz_id)
    OR EXISTS (
      SELECT 1 FROM public.quiz_collaborators c
      WHERE c.quiz_bank_id = _quiz_id AND c.user_id = _user_id AND c.accepted_at IS NOT NULL
    )
$$;

-- 5) Quiz bank policies: own quizzes only (admins see all)
DROP POLICY IF EXISTS "Admins manage quiz banks" ON public.quiz_banks;
DROP POLICY IF EXISTS "Course staff manage quiz banks" ON public.quiz_banks;

CREATE POLICY "quiz_banks_select" ON public.quiz_banks AS PERMISSIVE FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.can_view_quiz_bank(auth.uid(), id));

CREATE POLICY "quiz_banks_insert" ON public.quiz_banks AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "quiz_banks_update" ON public.quiz_banks AS PERMISSIVE FOR UPDATE TO authenticated
USING (public.can_edit_quiz_bank(auth.uid(), id))
WITH CHECK (public.can_edit_quiz_bank(auth.uid(), id));

CREATE POLICY "quiz_banks_delete" ON public.quiz_banks AS PERMISSIVE FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 6) Collaborator policies
CREATE POLICY "quiz_collab_select" ON public.quiz_collaborators AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_edit_quiz_bank(auth.uid(), quiz_bank_id));

CREATE POLICY "quiz_collab_manage" ON public.quiz_collaborators AS PERMISSIVE FOR ALL TO authenticated
USING (public.can_edit_quiz_bank(auth.uid(), quiz_bank_id))
WITH CHECK (public.can_edit_quiz_bank(auth.uid(), quiz_bank_id));

-- 7) Accept an invite by token
CREATE OR REPLACE FUNCTION public.accept_quiz_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.quiz_collaborators%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_row FROM public.quiz_collaborators WHERE invite_token = _token;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Invalid invite'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF v_row.user_id IS NOT NULL AND v_row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This invite belongs to another user';
  END IF;
  IF v_row.user_id IS NULL AND v_row.invite_email IS NOT NULL
     AND lower(v_row.invite_email) <> lower(coalesce(v_email,'')) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  UPDATE public.quiz_collaborators
     SET user_id = auth.uid(), accepted_at = coalesce(accepted_at, now())
   WHERE id = v_row.id;

  RETURN v_row.quiz_bank_id;
END;
$$;