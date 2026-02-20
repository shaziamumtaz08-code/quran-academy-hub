
-- Allow parents to view their children's fee invoices
CREATE POLICY "Parents can view children invoices"
ON public.fee_invoices
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND student_id IN (SELECT get_parent_children_ids(auth.uid()))
);

-- Allow students to view their own invoices
CREATE POLICY "Students can view own invoices"
ON public.fee_invoices
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND student_id = auth.uid()
);
