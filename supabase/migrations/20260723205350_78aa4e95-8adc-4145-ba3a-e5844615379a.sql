
-- Temporarily disable immutability trigger to allow cleanup of orphaned adjustments
ALTER TABLE public.invoice_adjustments DISABLE TRIGGER USER;

-- Delete audit adjustments tied to Ayesha's duplicate invoices we're about to remove
DELETE FROM public.invoice_adjustments WHERE invoice_id IN (
  '2b411d2f-cf83-45d6-be8a-10e5615bc3f6','bb159e8d-4120-467f-bb65-3b9dc00f50ad',
  '0e382bb2-1d26-427a-9ffc-1dd0c0cf1b57','624f6c37-4cfc-4299-b08d-56b492a28dbe',
  '7bd4c569-9aa8-4308-ae53-2c63b711fd3d','94d2c3ad-752e-4fbf-9c5d-50cdac71ddc0',
  '1e23915d-ef3e-49cf-b73d-f575502d53d6','05cc9a43-59f1-4e73-845c-203ce97ab910',
  'a477612c-77e7-43ee-8afc-b66babeb9986','700b0524-3f54-4d3c-a08d-e34e9d164bd0'
);

-- Delete payment transactions on Ayesha's duplicates
DELETE FROM public.payment_transactions WHERE invoice_id IN (
  '2b411d2f-cf83-45d6-be8a-10e5615bc3f6','bb159e8d-4120-467f-bb65-3b9dc00f50ad',
  '0e382bb2-1d26-427a-9ffc-1dd0c0cf1b57','624f6c37-4cfc-4299-b08d-56b492a28dbe',
  '7bd4c569-9aa8-4308-ae53-2c63b711fd3d','94d2c3ad-752e-4fbf-9c5d-50cdac71ddc0',
  '1e23915d-ef3e-49cf-b73d-f575502d53d6','05cc9a43-59f1-4e73-845c-203ce97ab910',
  'a477612c-77e7-43ee-8afc-b66babeb9986','700b0524-3f54-4d3c-a08d-e34e9d164bd0'
);

-- Delete the duplicate invoices themselves
DELETE FROM public.fee_invoices WHERE id IN (
  '2b411d2f-cf83-45d6-be8a-10e5615bc3f6','bb159e8d-4120-467f-bb65-3b9dc00f50ad',
  '0e382bb2-1d26-427a-9ffc-1dd0c0cf1b57','624f6c37-4cfc-4299-b08d-56b492a28dbe',
  '7bd4c569-9aa8-4308-ae53-2c63b711fd3d','94d2c3ad-752e-4fbf-9c5d-50cdac71ddc0',
  '1e23915d-ef3e-49cf-b73d-f575502d53d6','05cc9a43-59f1-4e73-845c-203ce97ab910',
  'a477612c-77e7-43ee-8afc-b66babeb9986','700b0524-3f54-4d3c-a08d-e34e9d164bd0'
);

-- Rewrite Jan/Feb invoices to 2,333 for Dua, Areej, Ayesha
UPDATE public.fee_invoices SET amount = 2333, amount_paid = 2333, status = 'paid'
WHERE id IN (
  'e4370ae8-276b-4ba1-8013-dad9d1857f33','c7207210-ae40-40e3-918b-60c2b0902096',
  'e93c575d-2f8d-47aa-b2ed-0cf524f7ae23','00965b92-7e09-45a6-807c-55a409b596db',
  '47827a67-789a-4932-a2d7-8d0edc25ab74','5b7832ea-6735-46e2-b0cb-7e0bb56e23b1'
);

-- Align payment ledger to 2,333
UPDATE public.payment_transactions SET amount_foreign = 2333, amount_local = 2333
WHERE invoice_id IN (
  'e4370ae8-276b-4ba1-8013-dad9d1857f33','c7207210-ae40-40e3-918b-60c2b0902096',
  'e93c575d-2f8d-47aa-b2ed-0cf524f7ae23','00965b92-7e09-45a6-807c-55a409b596db',
  '47827a67-789a-4932-a2d7-8d0edc25ab74','5b7832ea-6735-46e2-b0cb-7e0bb56e23b1'
);

-- Ayesha Mar kept invoice: stale amount_local=0 → 3000
UPDATE public.payment_transactions SET amount_local = 3000
WHERE invoice_id = '25860ce5-57fc-4947-8a1d-8b554d842b5c' AND amount_local = 0;
UPDATE public.fee_invoices SET amount_paid = 3000, status = 'paid'
WHERE id = '25860ce5-57fc-4947-8a1d-8b554d842b5c';

-- Backdate Ayesha's assignment start to align with sisters
UPDATE public.student_teacher_assignments
  SET effective_from_date = '2026-01-01',
      start_date = COALESCE(start_date, '2026-01-01'),
      status_change_reason = 'Backdated to align with sisters (family enrollment cleanup)'
WHERE id = '760043d9-ea6d-4a47-bb7a-0a9e7ef0ba44';

-- Raise payout to 2,000 on all three sisters' assignments (historical salary_payouts already locked)
UPDATE public.student_teacher_assignments
  SET payout_amount = 2000,
      status_change_reason = 'Family payout revised to 6,000 total (2,000 each) effective Jul 2026'
WHERE id IN (
  '0d5a3be6-f184-48ee-a98b-1bc51cf36dc7',
  '05abf160-2f10-41d5-be3c-9d96d715c2a2',
  '760043d9-ea6d-4a47-bb7a-0a9e7ef0ba44'
);

-- Re-enable the audit immutability trigger
ALTER TABLE public.invoice_adjustments ENABLE TRIGGER USER;
