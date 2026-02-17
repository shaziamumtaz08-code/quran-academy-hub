
-- Add disbursement_method to cash_advances
ALTER TABLE public.cash_advances ADD COLUMN IF NOT EXISTS disbursement_method text NOT NULL DEFAULT 'cash';
