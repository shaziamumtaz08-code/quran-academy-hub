ALTER TABLE public.invoice_adjustments DISABLE TRIGGER trg_invoice_adjustments_no_update;

DELETE FROM invoice_adjustments
WHERE invoice_id IN (
  'cd118b41-d5d3-41a3-9bf4-ad83dd50cca2',
  '1ecca0de-d3fe-47a6-be4f-bf24c0831a93',
  'd68fc613-3a65-4910-b625-15f581fde828',
  'eff2f8c7-791a-4f20-8908-88da4c8767be',
  'da1ff6e5-0d1a-4575-a918-8a5a0a663ec7'
);

DELETE FROM payment_transactions
WHERE invoice_id IN (
  'cd118b41-d5d3-41a3-9bf4-ad83dd50cca2',
  '1ecca0de-d3fe-47a6-be4f-bf24c0831a93',
  'd68fc613-3a65-4910-b625-15f581fde828',
  'eff2f8c7-791a-4f20-8908-88da4c8767be',
  'da1ff6e5-0d1a-4575-a918-8a5a0a663ec7'
);

DELETE FROM fee_invoices
WHERE id IN (
  'cd118b41-d5d3-41a3-9bf4-ad83dd50cca2',
  '1ecca0de-d3fe-47a6-be4f-bf24c0831a93',
  'd68fc613-3a65-4910-b625-15f581fde828',
  'eff2f8c7-791a-4f20-8908-88da4c8767be',
  'da1ff6e5-0d1a-4575-a918-8a5a0a663ec7'
);

ALTER TABLE public.invoice_adjustments ENABLE TRIGGER trg_invoice_adjustments_no_update;