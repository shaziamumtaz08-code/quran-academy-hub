-- Backfill class chat groups for all classes that don't have one
DO $$
DECLARE
  c RECORD;
  new_group_id UUID;
  creator_id UUID;
BEGIN
  FOR c IN
    SELECT cc.id AS class_id, cc.name AS class_name, cc.course_id
    FROM public.course_classes cc
    WHERE cc.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.chat_groups cg WHERE cg.class_id = cc.id
      )
  LOOP
    -- Pick creator: first staff member, else first super_admin
    SELECT user_id INTO creator_id
    FROM public.course_class_staff
    WHERE class_id = c.class_id
    LIMIT 1;

    IF creator_id IS NULL THEN
      SELECT user_id INTO creator_id
      FROM public.user_roles
      WHERE role = 'super_admin'
      LIMIT 1;
    END IF;

    IF creator_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.chat_groups (
      name, type, created_by, course_id, class_id,
      channel_mode, is_active, is_dm
    ) VALUES (
      c.class_name || ' — Class Chat', 'group', creator_id, c.course_id, c.class_id,
      'class', true, false
    )
    RETURNING id INTO new_group_id;

    -- Add all active students
    INSERT INTO public.chat_members (group_id, user_id, role)
    SELECT new_group_id, ccs.student_id, 'member'
    FROM public.course_class_students ccs
    WHERE ccs.class_id = c.class_id AND ccs.status = 'active'
    ON CONFLICT DO NOTHING;

    -- Add all staff as admin
    INSERT INTO public.chat_members (group_id, user_id, role)
    SELECT new_group_id, ccs.user_id, 'admin'
    FROM public.course_class_staff ccs
    WHERE ccs.class_id = c.class_id
    ON CONFLICT DO NOTHING;

    -- Ensure creator is a member
    INSERT INTO public.chat_members (group_id, user_id, role)
    VALUES (new_group_id, creator_id, 'admin')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Backfill missing student/staff memberships for existing class chat groups
INSERT INTO public.chat_members (group_id, user_id, role)
SELECT cg.id, ccs.student_id, 'member'
FROM public.chat_groups cg
JOIN public.course_class_students ccs ON ccs.class_id = cg.class_id AND ccs.status='active'
WHERE cg.class_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.group_id = cg.id AND cm.user_id = ccs.student_id
  );

INSERT INTO public.chat_members (group_id, user_id, role)
SELECT cg.id, ccs.user_id, 'admin'
FROM public.chat_groups cg
JOIN public.course_class_staff ccs ON ccs.class_id = cg.class_id
WHERE cg.class_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.group_id = cg.id AND cm.user_id = ccs.user_id
  );