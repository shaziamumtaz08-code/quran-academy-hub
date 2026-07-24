
-- Payment proof: columns + RPCs + storage policies
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS payment_proof_note text,
  ADD COLUMN IF NOT EXISTS payment_proof_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_proof_submitted_by uuid,
  ADD COLUMN IF NOT EXISTS payment_proof_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_proof_rejection_reason text;

-- Student or parent submits proof for a set of their invoices
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  _invoice_ids uuid[],
  _proof_url text,
  _note text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _count integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _proof_url IS NULL OR length(_proof_url) < 5 THEN
    RAISE EXCEPTION 'A proof file is required';
  END IF;

  UPDATE public.fee_invoices fi
     SET payment_proof_url = _proof_url,
         payment_proof_note = _note,
         payment_proof_submitted_at = now(),
         payment_proof_submitted_by = _uid,
         payment_proof_rejected_at = NULL,
         payment_proof_rejection_reason = NULL,
         updated_at = now()
   WHERE fi.id = ANY(_invoice_ids)
     AND fi.voided_at IS NULL
     AND fi.status <> 'paid'
     AND (
       fi.student_id = _uid
       OR EXISTS (
         SELECT 1 FROM public.student_parent_links spl
          WHERE spl.student_id = fi.student_id AND spl.parent_id = _uid
       )
     );

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid[], text, text) TO authenticated;

-- Admin rejects proof, reverts to prior status, notifies parent
CREATE OR REPLACE FUNCTION public.reject_payment_proof(
  _invoice_id uuid,
  _reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _student uuid;
  _submitter uuid;
  _bm text;
BEGIN
  IF NOT (has_role(_uid, 'admin'::app_role)
          OR has_role(_uid, 'super_admin'::app_role)
          OR has_role(_uid, 'admin_fees'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.fee_invoices
     SET payment_proof_url = NULL,
         payment_proof_note = NULL,
         payment_proof_submitted_at = NULL,
         payment_proof_rejected_at = now(),
         payment_proof_rejection_reason = _reason,
         updated_at = now()
   WHERE id = _invoice_id
   RETURNING student_id, payment_proof_submitted_by, billing_month
        INTO _student, _submitter, _bm;

  -- Best-effort notification (ignore if table shape differs)
  BEGIN
    INSERT INTO public.notification_queue (recipient_id, channel, title, body, payload, status)
    VALUES (
      COALESCE(_submitter, _student),
      'in_app',
      'Payment proof needs attention',
      COALESCE(_reason, 'Please re-upload or clarify your payment proof.'),
      jsonb_build_object('invoice_id', _invoice_id, 'billing_month', _bm, 'kind', 'payment_proof_rejected'),
      'pending'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_payment_proof(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_payment_proof(uuid, text) TO authenticated;

-- Storage policies: allow students/parents to upload payment proofs
-- into payment-receipts/proofs/{auth.uid()}/... and read their own.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users upload own payment proof" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users upload own payment proof"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = 'proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users read own payment proof" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users read own payment proof"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = 'proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
