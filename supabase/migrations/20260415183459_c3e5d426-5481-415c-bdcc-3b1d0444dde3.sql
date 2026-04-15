ALTER TABLE public.chat_groups ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.course_classes(id) ON DELETE CASCADE;

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS student_dm_mode TEXT NOT NULL DEFAULT 'disabled';

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS community_chat_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.content_kits ADD COLUMN IF NOT EXISTS pushed_to_class BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.content_kits ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;