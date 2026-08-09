UPDATE public.tutorial_videos
SET walkthrough_video_path = 'walkthroughs/logging-in.mp4',
    walkthrough_poster_path = 'walkthroughs/logging-in-poster.jpg',
    duration_seconds = 38,
    share_enabled = true,
    share_token = COALESCE(share_token, encode(gen_random_bytes(16), 'hex'))
WHERE id = '59fed1fa-bc71-4d6b-8e74-df3adaef75bf';