-- Create student_fees table for fee collection
CREATE TABLE public.student_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  month VARCHAR(2) NOT NULL, -- 01-12
  year VARCHAR(4) NOT NULL, -- YYYY
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'partial')),
  payment_method TEXT CHECK (payment_method IN ('bank', 'easypaisa', 'jazzcash', 'cash', 'other')),
  amount_paid NUMERIC(10,2) DEFAULT 0,
  remark TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, month, year)
);

-- Enable RLS
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;

-- Admin can manage all fees
CREATE POLICY "Admin can manage all fees"
ON public.student_fees
FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Teachers can view fees for their students
CREATE POLICY "Teachers can view student fees"
ON public.student_fees
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND 
  student_id IN (SELECT get_teacher_student_ids(auth.uid()))
);

-- Parents can view their children's fees
CREATE POLICY "Parents can view children fees"
ON public.student_fees
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role) AND 
  student_id IN (SELECT get_parent_children_ids(auth.uid()))
);

-- Students can view own fees
CREATE POLICY "Students can view own fees"
ON public.student_fees
FOR SELECT
USING (has_role(auth.uid(), 'student'::app_role) AND student_id = auth.uid());

-- Admin fees role can manage fees
CREATE POLICY "Admin fees can manage fees"
ON public.student_fees
FOR ALL
USING (has_role(auth.uid(), 'admin_fees'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_student_fees_updated_at
BEFORE UPDATE ON public.student_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_student_fees_student ON public.student_fees(student_id);
CREATE INDEX idx_student_fees_period ON public.student_fees(year, month);
CREATE INDEX idx_student_fees_status ON public.student_fees(status);