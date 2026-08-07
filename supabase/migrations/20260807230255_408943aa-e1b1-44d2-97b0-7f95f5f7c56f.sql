
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  media_type text NOT NULL DEFAULT 'text',
  media_url text,
  audiences text[] NOT NULL DEFAULT ARRAY['all']::text[],
  division_id uuid,
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_read_targeted" ON public.announcements AS PERMISSIVE FOR SELECT TO authenticated
USING (
  is_published = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    'all' = ANY(audiences)
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = ANY(audiences))
  )
);

CREATE POLICY "announcements_author_manage" ON public.announcements AS PERMISSIVE FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "announcements_admin_manage" ON public.announcements AS PERMISSIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements (is_published, published_at DESC);

CREATE OR REPLACE FUNCTION public.fn_announcement_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_published IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_queue (recipient_id, recipient_type, notification_type, title, message, metadata, status)
  SELECT DISTINCT ur.user_id,
         'user',
         'announcement',
         NEW.title,
         COALESCE(NULLIF(NEW.body, ''), 'New announcement'),
         jsonb_build_object('announcement_id', NEW.id, 'media_type', NEW.media_type, 'link', '/communication?view=announcements'),
         'pending'
  FROM public.user_roles ur
  WHERE ur.user_id <> NEW.created_by
    AND ('all' = ANY(NEW.audiences) OR ur.role::text = ANY(NEW.audiences));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcement_notify ON public.announcements;
CREATE TRIGGER trg_announcement_notify
AFTER INSERT OR UPDATE OF is_published ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.fn_announcement_notify();
