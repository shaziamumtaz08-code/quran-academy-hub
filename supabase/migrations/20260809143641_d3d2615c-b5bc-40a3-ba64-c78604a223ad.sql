ALTER TABLE public.tutorial_videos
  ADD COLUMN IF NOT EXISTS flow_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS walkthrough_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS walkthrough_frames jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS walkthrough_error text,
  ADD COLUMN IF NOT EXISTS walkthrough_generated_at timestamptz;

ALTER TABLE public.tutorial_videos
  DROP CONSTRAINT IF EXISTS tutorial_videos_walkthrough_status_check;
ALTER TABLE public.tutorial_videos
  ADD CONSTRAINT tutorial_videos_walkthrough_status_check
  CHECK (walkthrough_status IN ('none','pending','generating','ready','failed','needs_review'));

CREATE POLICY "tutorial_captures_read_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tutorial-captures');

CREATE POLICY "tutorial_captures_admin_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tutorial-captures' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "tutorial_captures_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tutorial-captures' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "tutorial_captures_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutorial-captures' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));