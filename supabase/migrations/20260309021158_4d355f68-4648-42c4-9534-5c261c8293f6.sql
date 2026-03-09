ALTER TABLE salary_payouts 
ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS partial_notes text;