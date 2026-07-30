UPDATE public.zoom_accounts
SET teacher_id = '40d969b5-dd67-4629-a8ca-4ce7bc1c0cce',
    display_label = 'Academy Paid Seat (SHAZIA MUMTAZ · Shared Pool)',
    updated_at = now()
WHERE lower(zoom_account_email) = 'alqurantime.academy@gmail.com'
  AND teacher_id IS NULL;

UPDATE public.zoom_vault_accounts
SET assigned_teacher_id = '40d969b5-dd67-4629-a8ca-4ce7bc1c0cce',
    updated_at = now()
WHERE lower(zoom_email) = 'alqurantime.academy@gmail.com'
  AND assigned_teacher_id IS NULL;