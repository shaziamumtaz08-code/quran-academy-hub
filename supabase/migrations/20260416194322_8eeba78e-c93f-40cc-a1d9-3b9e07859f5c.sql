
DO $$
DECLARE
  r RECORD;
  fk RECORD;
  target_exists BOOLEAN;
  fixed_count INT := 0;
  failed_count INT := 0;
BEGIN
  FOR r IN
    SELECT p.id AS old_id, au.id AS new_id, p.email
    FROM public.profiles p
    JOIN auth.users au ON lower(au.email) = lower(p.email)
    WHERE au.id <> p.id
  LOOP
    BEGIN
      SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = r.new_id) INTO target_exists;

      -- Repoint every FK referencing public.profiles(id), one column at a time.
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
          -- A row already exists at the new_id position; drop the orphan.
          EXECUTE format('DELETE FROM %I.%I WHERE %I = %L',
                         fk.s, fk.t, fk.c, r.old_id);
        END;
      END LOOP;

      IF target_exists THEN
        DELETE FROM public.profiles WHERE id = r.old_id;
      ELSE
        UPDATE public.profiles SET id = r.new_id WHERE id = r.old_id;
      END IF;

      fixed_count := fixed_count + 1;
    EXCEPTION WHEN others THEN
      failed_count := failed_count + 1;
      RAISE NOTICE 'Could not fix %: %', r.email, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Profile/auth sync: fixed=%, failed=%', fixed_count, failed_count;
END
$$;
