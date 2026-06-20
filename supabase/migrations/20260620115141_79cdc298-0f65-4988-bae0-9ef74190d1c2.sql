
ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ai_summary text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_items_share_token ON public.library_items(share_token) WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.library_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);
GRANT SELECT, INSERT, DELETE ON public.library_favorites TO authenticated;
GRANT ALL ON public.library_favorites TO service_role;
ALTER TABLE public.library_favorites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='library_favorites' AND policyname='users manage own favorites') THEN
    CREATE POLICY "users manage own favorites" ON public.library_favorites
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_lib_fav_user ON public.library_favorites(user_id);

CREATE TABLE IF NOT EXISTS public.library_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.library_view_events TO authenticated;
GRANT ALL ON public.library_view_events TO service_role;
ALTER TABLE public.library_view_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='library_view_events' AND policyname='users see own views') THEN
    CREATE POLICY "users see own views" ON public.library_view_events
      FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='library_view_events' AND policyname='users log own views') THEN
    CREATE POLICY "users log own views" ON public.library_view_events
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_lib_view_user_at ON public.library_view_events(user_id, viewed_at DESC);

CREATE OR REPLACE FUNCTION public.library_increment_view(_item_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.library_items SET views_count = views_count + 1 WHERE id = _item_id;
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.library_view_events(user_id, item_id) VALUES (auth.uid(), _item_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.library_ensure_share_token(_item_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tok text;
BEGIN
  SELECT share_token INTO _tok FROM public.library_items WHERE id = _item_id;
  IF _tok IS NULL THEN
    _tok := replace(replace(replace(encode(gen_random_bytes(12), 'base64'), '/', ''), '+', ''), '=', '');
    UPDATE public.library_items SET share_token = _tok WHERE id = _item_id;
  END IF;
  RETURN _tok;
END;
$$;
GRANT EXECUTE ON FUNCTION public.library_ensure_share_token(uuid) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='library_items' AND policyname='public read by share token') THEN
    CREATE POLICY "public read by share token" ON public.library_items
      FOR SELECT TO anon USING (share_token IS NOT NULL);
  END IF;
END $$;
GRANT SELECT ON public.library_items TO anon;
