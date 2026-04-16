
DO $$
DECLARE
  r RECORD;
  fk RECORD;
  fixed INT := 0;
  failed INT := 0;
BEGIN
  FOR r IN
    SELECT p.id AS old_id, au.id AS new_id, p.email
    FROM public.profiles p
    JOIN auth.users au ON lower(au.email) = lower(p.email)
    WHERE au.id <> p.id
  LOOP
    BEGIN
      -- 1) Ensure a profile exists at new_id (insert clone of old if not).
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = r.new_id) THEN
        EXECUTE format(
          'INSERT INTO public.profiles SELECT %L::uuid AS id, %s FROM public.profiles WHERE id = %L',
          r.new_id,
          (
            SELECT string_agg(quote_ident(column_name), ', ')
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='profiles' AND column_name <> 'id'
          ),
          r.old_id
        );
      END IF;

      -- 2) Repoint every FK child column from old_id -> new_id.
      FOR fk IN
        SELECT n.nspname AS s, cl.relname AS t, a.attname AS c
        FROM pg_constraint cn
        JOIN pg_class cl ON cl.oid = cn.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_attribute a ON a.attrelid = cn.conrelid AND a.attnum = ANY(cn.conkey)
        WHERE cn.contype = 'f' AND cn.confrelid = 'public.profiles'::regclass
      LOOP
        BEGIN
          EXECUTE format('UPDATE %I.%I SET %I = %L WHERE %I = %L',
                         fk.s, fk.t, fk.c, r.new_id, fk.c, r.old_id);
        EXCEPTION WHEN unique_violation THEN
          EXECUTE format('DELETE FROM %I.%I WHERE %I = %L',
                         fk.s, fk.t, fk.c, r.old_id);
        END;
      END LOOP;

      -- 3) Delete the leftover old profile row.
      DELETE FROM public.profiles WHERE id = r.old_id;
      fixed := fixed + 1;
    EXCEPTION WHEN others THEN
      failed := failed + 1;
      RAISE NOTICE 'FAILED %: %', r.email, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Done. fixed=% failed=%', fixed, failed;
END
$$;
