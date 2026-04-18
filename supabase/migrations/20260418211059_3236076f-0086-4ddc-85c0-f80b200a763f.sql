
-- 1. Add thumbnail_url to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- 2. Schema introspection RPC (super_admin only)
CREATE OR REPLACE FUNCTION public.get_schema_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'information_schema'
AS $$
DECLARE
  _tables jsonb;
  _fks jsonb;
BEGIN
  -- Gate: super_admin only
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;

  -- Tables with columns
  SELECT jsonb_agg(t ORDER BY t->>'table_name') INTO _tables
  FROM (
    SELECT jsonb_build_object(
      'table_name', c.table_name,
      'columns', (
        SELECT jsonb_agg(jsonb_build_object(
          'column_name', col.column_name,
          'data_type', col.data_type,
          'is_nullable', col.is_nullable = 'YES',
          'is_pk', EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.table_name = col.table_name
              AND tc.constraint_type = 'PRIMARY KEY'
              AND kcu.column_name = col.column_name
          ),
          'is_unique', EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.table_name = col.table_name
              AND tc.constraint_type = 'UNIQUE'
              AND kcu.column_name = col.column_name
          ),
          'is_fk', EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.table_name = col.table_name
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = col.column_name
          ),
          'ordinal', col.ordinal_position
        ) ORDER BY col.ordinal_position)
        FROM information_schema.columns col
        WHERE col.table_schema = 'public' AND col.table_name = c.table_name
      )
    ) AS t
    FROM information_schema.tables c
    WHERE c.table_schema = 'public' AND c.table_type = 'BASE TABLE'
  ) sub;

  -- Foreign-key relationships
  SELECT jsonb_agg(jsonb_build_object(
    'constraint_name', tc.constraint_name,
    'source_table', tc.table_name,
    'source_column', kcu.column_name,
    'target_table', ccu.table_name,
    'target_column', ccu.column_name
  )) INTO _fks
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';

  RETURN jsonb_build_object(
    'tables', COALESCE(_tables, '[]'::jsonb),
    'foreign_keys', COALESCE(_fks, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_schema_overview() TO authenticated;
