
-- Add super_admin SELECT policies to fee_invoices, payment_transactions, profiles, and student_teacher_assignments

CREATE POLICY "Super admins can view fee_invoices"
ON public.fee_invoices FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view payment_transactions"
ON public.payment_transactions FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all assignments"
ON public.student_teacher_assignments FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));
