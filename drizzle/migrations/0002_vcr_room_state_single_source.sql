ALTER TABLE public.vcr_room_state
  ADD COLUMN IF NOT EXISTS view_content text,
  ADD COLUMN IF NOT EXISTS view_library_item_id text,
  ADD COLUMN IF NOT EXISTS view_page integer,
  ADD COLUMN IF NOT EXISTS view_front integer,
  ADD COLUMN IF NOT EXISTS view_font_scale real,
  ADD COLUMN IF NOT EXISTS view_whiteboard boolean,
  ADD COLUMN IF NOT EXISTS view_whiteboard_mode text,
  ADD COLUMN IF NOT EXISTS call_participants jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Atomic, server-side call presence: each client only ever writes its own key,
-- so two clients can never clobber each other's "on the call" flag.
CREATE OR REPLACE FUNCTION public.vcr_set_call_presence(
  p_student_id uuid,
  p_active boolean,
  p_name text DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.vcr_room_state (student_id, updated_by)
  VALUES (p_student_id, uid)
  ON CONFLICT (student_id) DO NOTHING;

  IF p_active THEN
    UPDATE public.vcr_room_state
       SET call_participants = coalesce(call_participants, '{}'::jsonb) || jsonb_build_object(
             uid::text,
             jsonb_build_object('name', coalesce(p_name, 'Participant'), 'role', coalesce(p_role, 'member'), 'ts', extract(epoch from now()))
           )
     WHERE student_id = p_student_id
     RETURNING call_participants INTO result;
  ELSE
    UPDATE public.vcr_room_state
       SET call_participants = coalesce(call_participants, '{}'::jsonb) - uid::text
     WHERE student_id = p_student_id
     RETURNING call_participants INTO result;
  END IF;

  RETURN coalesce(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vcr_set_call_presence(uuid, boolean, text, text) TO authenticated;