ALTER TABLE public.vcr_room_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vcr_room_state;