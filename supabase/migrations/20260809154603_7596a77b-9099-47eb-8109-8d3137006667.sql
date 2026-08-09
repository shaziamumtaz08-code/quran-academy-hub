ALTER TABLE public.tutorial_videos
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS tutorial_key text;

ALTER TABLE public.tutorial_videos
  DROP CONSTRAINT IF EXISTS tutorial_videos_language_check;
ALTER TABLE public.tutorial_videos
  ADD CONSTRAINT tutorial_videos_language_check CHECK (language IN ('en','ur'));

UPDATE public.tutorial_videos SET tutorial_key = CASE id
  WHEN '59fed1fa-bc71-4d6b-8e74-df3adaef75bf'::uuid THEN 'logging-in'
  WHEN 'a298d34b-662b-4ece-aa96-a8f48e7d722b'::uuid THEN 'dashboard'
  WHEN 'a1f53264-ccf3-4606-a5bd-12f464f0f8ff'::uuid THEN 'quick-links'
  WHEN 'e083bfa4-7a97-44f6-bc26-6d57f0ff69cc'::uuid THEN 'payments'
  WHEN 'd4210128-f1de-4254-ae1f-4c0d57d21c04'::uuid THEN 'communication'
  ELSE tutorial_key END
WHERE tutorial_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tutorial_videos_key_language_uidx
  ON public.tutorial_videos (tutorial_key, language)
  WHERE tutorial_key IS NOT NULL;