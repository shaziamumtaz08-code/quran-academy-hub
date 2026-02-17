
-- Create salary-receipts storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('salary-receipts', 'salary-receipts', true);

-- Create expense-receipts storage bucket  
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', true);

-- RLS policies for salary-receipts
CREATE POLICY "Authenticated users can upload salary receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'salary-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view salary receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'salary-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete salary receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'salary-receipts' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

CREATE POLICY "Admins can update salary receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'salary-receipts' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

-- RLS policies for expense-receipts
CREATE POLICY "Authenticated users can upload expense receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view expense receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete expense receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'expense-receipts' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

CREATE POLICY "Admins can update expense receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'expense-receipts' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));
