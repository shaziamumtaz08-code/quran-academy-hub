
ALTER TABLE public.salary_adjustments 
ADD COLUMN IF NOT EXISTS adjustment_mode text NOT NULL DEFAULT 'flat',
ADD COLUMN IF NOT EXISTS percentage_value numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resolved_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS apply_to text DEFAULT 'entire_salary',
ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.profiles(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_bulk boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bulk_batch_id uuid DEFAULT NULL;
