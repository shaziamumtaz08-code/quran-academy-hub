-- Trigger function: when course_class_staff row is inserted, add user to all chat groups for that class
CREATE OR REPLACE FUNCTION public.fn_auto_add_staff_to_class_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_members (group_id, user_id, role)
  SELECT cg.id, NEW.user_id, 'member'
  FROM public.chat_groups cg
  WHERE cg.class_id = NEW.class_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_auto_add_staff_to_class_chats ON public.course_class_staff;
CREATE TRIGGER trg_auto_add_staff_to_class_chats
AFTER INSERT ON public.course_class_staff
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_add_staff_to_class_chats();

-- One-time backfill: add every existing staff member to every chat group for their class
INSERT INTO public.chat_members (group_id, user_id, role)
SELECT DISTINCT cg.id, ccs.user_id, 'member'
FROM public.course_class_staff ccs
JOIN public.chat_groups cg ON cg.class_id = ccs.class_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_members cm
  WHERE cm.group_id = cg.id AND cm.user_id = ccs.user_id
);