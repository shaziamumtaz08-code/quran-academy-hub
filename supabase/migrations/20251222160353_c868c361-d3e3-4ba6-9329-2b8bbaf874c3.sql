-- Add multi-unit learning fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_unit text NOT NULL DEFAULT 'lines',
  ADD COLUMN IF NOT EXISTS daily_target_amount numeric NOT NULL DEFAULT 10;

-- Add input unit and raw input fields to attendance table
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS input_unit text DEFAULT 'lines',
  ADD COLUMN IF NOT EXISTS raw_input_amount numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferred_unit IS 'Student preferred learning unit: lines, pages, rukus, or quarters';
COMMENT ON COLUMN public.profiles.daily_target_amount IS 'Daily target amount in the preferred unit';
COMMENT ON COLUMN public.attendance.input_unit IS 'The unit used for input: lines, pages, rukus, or quarters';
COMMENT ON COLUMN public.attendance.raw_input_amount IS 'The raw input amount before conversion to lines';