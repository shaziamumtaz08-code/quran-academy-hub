UPDATE public.tutorial_videos t
SET walkthrough_video_path = 'walkthroughs/' || t.tutorial_key || CASE WHEN t.language = 'ur' THEN '-ur' ELSE '' END || '.mp4',
    walkthrough_poster_path = 'walkthroughs/' || t.tutorial_key || CASE WHEN t.language = 'ur' THEN '-ur' ELSE '' END || '.jpg',
    walkthrough_status = 'ready',
    walkthrough_error = NULL,
    walkthrough_generated_at = now(),
    share_enabled = COALESCE(t.share_enabled, true),
    share_token = COALESCE(t.share_token, encode(gen_random_bytes(12), 'hex')),
    updated_at = now()
WHERE t.tutorial_key IN ('dashboard','quick-links','payments','communication','attendance-marking','lesson-planning');