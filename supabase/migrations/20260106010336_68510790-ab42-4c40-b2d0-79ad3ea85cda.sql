-- Add country and city fields to profiles for timezone selection
ALTER TABLE public.profiles 
ADD COLUMN country TEXT DEFAULT 'Pakistan',
ADD COLUMN city TEXT DEFAULT 'Karachi';

-- Update existing profiles to have Pakistan/Karachi as default
UPDATE public.profiles 
SET country = 'Pakistan', city = 'Karachi'
WHERE country IS NULL;

-- Add a computed timezone column or reference data
-- Create a table to store country-city-timezone mappings
CREATE TABLE IF NOT EXISTS public.timezone_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(country, city)
);

-- Insert common timezone mappings
INSERT INTO public.timezone_mappings (country, city, timezone) VALUES
  ('Pakistan', 'Karachi', 'Asia/Karachi'),
  ('Pakistan', 'Lahore', 'Asia/Karachi'),
  ('Pakistan', 'Islamabad', 'Asia/Karachi'),
  ('Canada', 'Toronto', 'America/Toronto'),
  ('Canada', 'Vancouver', 'America/Vancouver'),
  ('Canada', 'Calgary', 'America/Edmonton'),
  ('Canada', 'Montreal', 'America/Toronto'),
  ('USA', 'New York', 'America/New_York'),
  ('USA', 'Los Angeles', 'America/Los_Angeles'),
  ('USA', 'Chicago', 'America/Chicago'),
  ('USA', 'Houston', 'America/Chicago'),
  ('UK', 'London', 'Europe/London'),
  ('UK', 'Manchester', 'Europe/London'),
  ('UAE', 'Dubai', 'Asia/Dubai'),
  ('UAE', 'Abu Dhabi', 'Asia/Dubai'),
  ('Saudi Arabia', 'Riyadh', 'Asia/Riyadh'),
  ('Saudi Arabia', 'Jeddah', 'Asia/Riyadh'),
  ('India', 'Mumbai', 'Asia/Kolkata'),
  ('India', 'Delhi', 'Asia/Kolkata'),
  ('India', 'Bangalore', 'Asia/Kolkata'),
  ('Australia', 'Sydney', 'Australia/Sydney'),
  ('Australia', 'Melbourne', 'Australia/Melbourne'),
  ('Australia', 'Perth', 'Australia/Perth')
ON CONFLICT (country, city) DO NOTHING;

-- Enable RLS on timezone_mappings
ALTER TABLE public.timezone_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read timezone mappings
CREATE POLICY "Anyone can view timezone mappings"
  ON public.timezone_mappings
  FOR SELECT
  USING (true);