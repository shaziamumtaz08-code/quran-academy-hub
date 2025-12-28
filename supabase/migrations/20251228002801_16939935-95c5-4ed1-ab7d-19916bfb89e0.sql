-- Add manzil_notes column to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS manzil_notes text;