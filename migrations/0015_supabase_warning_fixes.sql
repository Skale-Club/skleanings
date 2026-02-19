-- Supabase Security Advisor warning fixes
-- - Function Search Path Mutable
-- - Extension in Public (vector)

-- Set fixed search_path on the RAG functions (argument types may vary by schema).
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('rag_skleanings', 'rag_skleanings_price_list')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, extensions',
      fn.proname,
      fn.args
    );
  END LOOP;
END $$;

-- Move pgvector extension out of public schema.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'ALTER EXTENSION vector SET SCHEMA extensions';
  END IF;
END $$;
