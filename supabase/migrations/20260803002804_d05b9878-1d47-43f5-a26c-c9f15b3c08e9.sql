CREATE TABLE public.policy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'policy',
  audience text[] NOT NULL DEFAULT ARRAY['all']::text[],
  language text NOT NULL DEFAULT 'en',
  version text NOT NULL DEFAULT 'v1',
  file_path text,
  external_url text,
  is_active boolean NOT NULL DEFAULT true,
  requires_acceptance boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.policy_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_documents TO authenticated;
GRANT ALL ON public.policy_documents TO service_role;

ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active policy documents"
ON public.policy_documents AS PERMISSIVE FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Admins manage policy documents"
ON public.policy_documents AS PERMISSIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_policy_documents_updated_at
BEFORE UPDATE ON public.policy_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  applicant_name text,
  applicant_email text,
  role_context text NOT NULL DEFAULT 'student',
  document_id uuid REFERENCES public.policy_documents(id) ON DELETE SET NULL,
  document_version text,
  acceptance_text text,
  source_url text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.policy_acceptances TO anon;
GRANT SELECT, INSERT ON public.policy_acceptances TO authenticated;
GRANT ALL ON public.policy_acceptances TO service_role;

ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record an acceptance"
ON public.policy_acceptances AS PERMISSIVE FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users read own acceptances"
ON public.policy_acceptances AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins read all acceptances"
ON public.policy_acceptances AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_policy_acceptances_user ON public.policy_acceptances(user_id);

CREATE POLICY "Public read policy document files"
ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated
USING (bucket_id = 'policy-documents');

CREATE POLICY "Admins upload policy document files"
ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'policy-documents' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins update policy document files"
ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'policy-documents' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins delete policy document files"
ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'policy-documents' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));