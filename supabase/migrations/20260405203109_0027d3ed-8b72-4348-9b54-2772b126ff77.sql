CREATE OR REPLACE FUNCTION public.cascade_fee_package_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_month text;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');

  -- Update billing plans (this is fine — the plan stores CURRENT values)
  UPDATE public.student_billing_plans sbp
  SET 
    currency = NEW.currency,
    duration_surcharge = (NEW.amount * (sbp.session_duration::numeric / 30)) - NEW.amount,
    net_recurring_fee = GREATEST(0, 
      (NEW.amount * (sbp.session_duration::numeric / 30)) 
      - sbp.flat_discount 
      - COALESCE(
        (SELECT CASE 
          WHEN dr.type = 'percentage' THEN (NEW.amount * (sbp.session_duration::numeric / 30)) * (dr.value / 100)
          ELSE dr.value 
        END FROM public.discount_rules dr WHERE dr.id = sbp.global_discount_id),
        0
      )
    ),
    updated_at = now()
  WHERE sbp.base_package_id = NEW.id
    AND sbp.is_active = true;

  -- CRITICAL FIX: Only update PENDING invoices from CURRENT month onward
  -- Never touch paid, partially_paid, or past month invoices
  UPDATE public.fee_invoices fi
  SET 
    amount = sbp.net_recurring_fee,
    currency = NEW.currency,
    updated_at = now()
  FROM public.student_billing_plans sbp
  WHERE fi.plan_id = sbp.id
    AND sbp.base_package_id = NEW.id
    AND sbp.is_active = true
    AND fi.status = 'pending'
    AND fi.billing_month >= current_month;

  RETURN NEW;
END;
$function$;