DO $$
DECLARE
  r record;
  _id uuid;
  _sid uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('AQTA Zoom — Shazia Shehzad', 'shazia.aqt@gmail.com', 'Shazia1234', '3016665444', 'XM1fy1', '322559'),
      ('AQTA Zoom — Amna Abdul Ghafoor', 'amna.aqt@gmail.com', 'Amna1234', '5042445359', '0zUU5y', '134587'),
      ('AQTA Zoom — Saniya Safwan', 'saniya.aqt@gmail.com', 'Saniya1234', '8640987589', 'H9VYjV', '563623')
    ) AS t(label, email, pwd, pmi, passcode, host_key)
  LOOP
    SELECT id INTO _id FROM public.zoom_vault_accounts WHERE lower(zoom_email) = lower(r.email);

    IF _id IS NULL THEN
      INSERT INTO public.zoom_vault_accounts (label, zoom_email, google_email, pmi, passcode, host_key, account_type, pool_assignment, status)
      VALUES (r.label, r.email, r.email, r.pmi, r.passcode, r.host_key, 'free'::public.zoom_vault_account_type, 'unassigned'::public.zoom_pool_assignment, 'active'::public.zoom_vault_status)
      RETURNING id INTO _id;
    ELSE
      UPDATE public.zoom_vault_accounts
      SET label = r.label, google_email = r.email, pmi = r.pmi, passcode = r.passcode, host_key = r.host_key, status = 'active'::public.zoom_vault_status
      WHERE id = _id;
    END IF;

    -- Zoom password
    SELECT zoom_password_secret_id INTO _sid FROM public.zoom_vault_accounts WHERE id = _id;
    IF _sid IS NULL THEN
      _sid := vault.create_secret(r.pwd, 'zoom_vault_' || _id::text || '_zoom_password', 'Zoom vault credential');
      UPDATE public.zoom_vault_accounts SET zoom_password_secret_id = _sid WHERE id = _id;
    ELSE
      PERFORM vault.update_secret(_sid, r.pwd, 'zoom_vault_' || _id::text || '_zoom_password', 'Zoom vault credential');
    END IF;

    -- Google password (same credential)
    SELECT google_password_secret_id INTO _sid FROM public.zoom_vault_accounts WHERE id = _id;
    IF _sid IS NULL THEN
      _sid := vault.create_secret(r.pwd, 'zoom_vault_' || _id::text || '_google_password', 'Zoom vault credential');
      UPDATE public.zoom_vault_accounts SET google_password_secret_id = _sid WHERE id = _id;
    ELSE
      PERFORM vault.update_secret(_sid, r.pwd, 'zoom_vault_' || _id::text || '_google_password', 'Zoom vault credential');
    END IF;
  END LOOP;
END $$;