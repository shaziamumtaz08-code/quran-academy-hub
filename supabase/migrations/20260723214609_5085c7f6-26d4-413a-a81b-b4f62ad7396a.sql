
ALTER TABLE public.invoice_adjustments DISABLE TRIGGER trg_invoice_adjustments_no_update;

WITH targets AS (
  SELECT id FROM public.profiles
  WHERE full_name IN ('Mohammad Zohad Abdullah','Sila Roman Naqvi','Umme Aimen Khan','Utfa Munneb Khan')
),
grouped AS (
  SELECT fi.id, fi.student_id, fi.billing_month, fi.plan_id, fi.amount_paid, fi.created_at,
    row_number() OVER (
      PARTITION BY fi.student_id, fi.billing_month
      ORDER BY fi.amount_paid DESC NULLS LAST,
               (fi.plan_id IS NOT NULL) DESC,
               fi.created_at ASC,
               fi.id ASC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY fi.student_id, fi.billing_month) AS cnt
  FROM public.fee_invoices fi
  WHERE fi.student_id IN (SELECT id FROM targets)
),
keepers AS (
  SELECT g.student_id, g.billing_month, g.id AS keeper_id,
         (SELECT plan_id FROM grouped g2
           WHERE g2.student_id=g.student_id AND g2.billing_month=g.billing_month
             AND g2.plan_id IS NOT NULL LIMIT 1) AS any_plan_id
  FROM grouped g WHERE rn=1 AND cnt>1
),
dupes AS (
  SELECT g.id AS dup_id
  FROM grouped g
  WHERE g.rn>1 AND g.cnt>1
),
del_adj AS (
  DELETE FROM public.invoice_adjustments WHERE invoice_id IN (SELECT dup_id FROM dupes) RETURNING invoice_id
),
del_txns AS (
  DELETE FROM public.payment_transactions WHERE invoice_id IN (SELECT dup_id FROM dupes) RETURNING invoice_id
),
fix_keeper AS (
  UPDATE public.fee_invoices fi
  SET plan_id = k.any_plan_id, updated_at = now()
  FROM keepers k
  WHERE fi.id = k.keeper_id AND fi.plan_id IS NULL AND k.any_plan_id IS NOT NULL
  RETURNING fi.id
)
DELETE FROM public.fee_invoices WHERE id IN (SELECT dup_id FROM dupes);

UPDATE public.fee_invoices
SET amount = 700, status = 'paid', updated_at = now()
WHERE id IN (
  'dcd982fe-79fc-41df-ae42-c09a4d1fb3d4',
  '3d259d58-f2ba-428c-a69f-d19659a3fe49',
  'b2259c57-0e09-4f48-bb00-67cd3da78288',
  '16744c9d-6bdd-493b-91ac-8f7681b56e20',
  'c10f6664-eb97-4dff-b560-ea0d319870bd',
  'a936f441-11bf-4a8f-b0da-ec7547783c6f',
  '6392b192-c16f-45d7-abdd-ba469008c159'
);

UPDATE public.student_billing_plans
SET effective_from = '2026-03-01', updated_at = now()
WHERE id IN (
  'b5f7d325-649e-4f4a-89ae-41251b9daca1',
  'cc6db698-6ee1-4d62-9b5f-4be8422004ee',
  'ab4ae701-bf96-407d-9368-095ff3902866',
  'ca7944e2-332e-44b8-b843-1b042f81fd4d',
  '8e2dbc68-cadf-4f05-8197-ea1526e5c18d',
  'f4efd073-ac73-44f1-a1ce-f46287a55faf',
  '2e4b12fe-7f68-499f-81b7-3ea3a4e8e387'
) AND effective_from < '2026-03-01';

ALTER TABLE public.invoice_adjustments ENABLE TRIGGER trg_invoice_adjustments_no_update;
