UPDATE public.zoom_accounts
SET meeting_link = 'https://us05web.zoom.us/j/3016665444?pwd=XM1fy1',
    updated_at = now()
WHERE id = 'bd4131c8-673f-43fe-a007-1cf9a5d45e9a' AND meeting_link IS NULL;