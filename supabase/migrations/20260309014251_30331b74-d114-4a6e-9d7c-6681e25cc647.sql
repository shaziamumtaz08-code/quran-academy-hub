
ALTER TABLE salary_payouts 
ADD COLUMN IF NOT EXISTS receipt_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
ADD COLUMN IF NOT EXISTS reverted_by uuid,
ADD COLUMN IF NOT EXISTS revert_reason text;

-- Migrate existing single receipt_url to array
UPDATE salary_payouts 
SET receipt_urls = ARRAY[receipt_url] 
WHERE receipt_url IS NOT NULL AND receipt_url != '' AND (receipt_urls IS NULL OR receipt_urls = '{}');
