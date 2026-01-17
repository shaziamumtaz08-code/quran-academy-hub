-- Drop the old unique constraint that only checks student_id + month + year
ALTER TABLE public.student_monthly_plans 
DROP CONSTRAINT IF EXISTS student_monthly_plans_student_id_month_year_key;

-- Add new unique constraint that includes subject_id
-- This allows same student to have different subject plans in same month
ALTER TABLE public.student_monthly_plans 
ADD CONSTRAINT student_monthly_plans_student_subject_month_year_key 
UNIQUE (student_id, subject_id, month, year);

-- Drop existing teacher policy that allows viewing other teacher's students
DROP POLICY IF EXISTS "Teachers can view and manage their students plans" ON public.student_monthly_plans;

-- Create new teacher policy: teachers can ONLY see their own plans (teacher_id = auth.uid())
CREATE POLICY "Teachers can manage their own plans"
ON public.student_monthly_plans
FOR ALL
USING (
  has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid()
);