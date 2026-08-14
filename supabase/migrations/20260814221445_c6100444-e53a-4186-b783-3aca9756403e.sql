CREATE OR REPLACE FUNCTION public.reject_payment_proof(_invoice_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF COALESCE(_submitter, _student) IS NOT NULL THEN
    INSERT INTO public.notification_queue (
      recipient_id, recipient_type, notification_type, title, message, metadata, status
    ) VALUES (
      COALESCE(_submitter, _student),
      'user',
      'payment_proof_rejected',
      'Payment proof needs attention',
      COALESCE(NULLIF(btrim(_reason), ''), 'Please re-upload or clarify your payment proof.'),
      jsonb_build_object('invoice_id', _invoice_id, 'billing_month', _bm, 'kind', 'payment_proof_rejected'),
      'pending'
    );
  END IF;
END;
$function$;