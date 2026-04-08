
-- Video library
CREATE TABLE public.video_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT,
  duration_seconds INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  safety_status TEXT NOT NULL DEFAULT 'review',
  safety_flags JSONB DEFAULT '[]'::jsonb,
  ai_score INTEGER DEFAULT 0,
  content_tags JSONB DEFAULT '[]'::jsonb,
  recommendation_reason TEXT,
  added_by UUID,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  use_count INTEGER DEFAULT 0,
  UNIQUE(youtube_id)
);
ALTER TABLE public.video_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view video library" ON public.video_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert video library" ON public.video_library FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins manage video library" ON public.video_library FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Session playlists
CREATE TABLE public.session_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_plan_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Playlist',
  shared_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view session playlists" ON public.session_playlists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert session playlists" ON public.session_playlists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Creators manage playlists" ON public.session_playlists FOR ALL TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Admins manage all playlists" ON public.session_playlists FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Playlist videos
CREATE TABLE public.playlist_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.session_playlists(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.video_library(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_by UUID,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlist_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view playlist videos" ON public.playlist_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert playlist videos" ON public.playlist_videos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update playlist videos" ON public.playlist_videos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete playlist videos" ON public.playlist_videos FOR DELETE TO authenticated USING (true);

-- Video watch events
CREATE TABLE public.video_watch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.video_library(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES public.session_playlists(id) ON DELETE SET NULL,
  student_id UUID NOT NULL,
  session_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  watched_seconds INTEGER DEFAULT 0,
  total_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  replay_count INTEGER DEFAULT 0,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.video_watch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own watch events" ON public.video_watch_events FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Students create own watch events" ON public.video_watch_events FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students update own watch events" ON public.video_watch_events FOR UPDATE TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Admins view all watch events" ON public.video_watch_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Video filter settings
CREATE TABLE public.video_filter_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  strictness TEXT NOT NULL DEFAULT 'standard',
  rules JSONB DEFAULT '{"block_music": true, "block_mixed_gender": true, "require_islamic_context": true, "prefer_ad_free": true, "flag_non_islamic_channels": true, "require_dress_standards": true, "require_arabic_subtitles": false, "require_female_teacher": false, "require_male_teacher": false, "block_non_arabic_audio": false}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.video_filter_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view filter settings" ON public.video_filter_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage filter settings" ON public.video_filter_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Video insights
CREATE TABLE public.video_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_plan_id UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'engagement',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_action TEXT,
  applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.video_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view video insights" ON public.video_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage video insights" ON public.video_insights FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_video_library_youtube ON public.video_library(youtube_id);
CREATE INDEX idx_playlist_videos_playlist ON public.playlist_videos(playlist_id);
CREATE INDEX idx_video_watch_student ON public.video_watch_events(student_id);
CREATE INDEX idx_video_watch_video ON public.video_watch_events(video_id);
CREATE INDEX idx_video_insights_session ON public.video_insights(session_plan_id);
