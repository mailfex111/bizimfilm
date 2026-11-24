-- ============================================================================
-- Miora Migration 010: Distributed Serverless Rate Limiting (PostgreSQL-Backed)
-- ============================================================================
-- Shares atomic rate-limit counters across all Vercel Serverless instances
-- without paid Redis/Upstash services (100% Supabase Free Plan compatible).
-- Strictly restricted to server-side `service_role` only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 1 CHECK (attempt_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window
  ON public.auth_rate_limits (window_started_at);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_auth_rate_limit(
  p_bucket_key TEXT,
  p_max_attempts INT,
  p_window_seconds INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INT,
  retry_after_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_row public.auth_rate_limits;
  v_elapsed INT;
BEGIN
  IF p_bucket_key IS NULL OR char_length(trim(p_bucket_key)) = 0 THEN
    RETURN QUERY SELECT FALSE, 0, GREATEST(1, p_window_seconds);
    RETURN;
  END IF;

  -- Serialize concurrent requests for the same rate-limit key across all serverless instances
  PERFORM pg_advisory_xact_lock(hashtext(p_bucket_key));

  -- Opportunistic cleanup of stale buckets older than 24 hours
  DELETE FROM public.auth_rate_limits
  WHERE updated_at < (v_now - INTERVAL '24 hours');

  SELECT * INTO v_row
  FROM public.auth_rate_limits
  WHERE bucket_key = p_bucket_key;

  IF v_row.bucket_key IS NULL THEN
    INSERT INTO public.auth_rate_limits (bucket_key, attempt_count, window_started_at, updated_at)
    VALUES (p_bucket_key, 1, v_now, v_now);

    RETURN QUERY SELECT (1 <= p_max_attempts), 1, 0;
    RETURN;
  END IF;

  v_elapsed := EXTRACT(EPOCH FROM (v_now - v_row.window_started_at))::INT;

  IF v_elapsed >= p_window_seconds THEN
    UPDATE public.auth_rate_limits
    SET attempt_count = 1,
        window_started_at = v_now,
        updated_at = v_now
    WHERE bucket_key = p_bucket_key;

    RETURN QUERY SELECT (1 <= p_max_attempts), 1, 0;
    RETURN;
  END IF;

  IF v_row.attempt_count >= p_max_attempts THEN
    UPDATE public.auth_rate_limits
    SET updated_at = v_now
    WHERE bucket_key = p_bucket_key;

    RETURN QUERY SELECT FALSE, v_row.attempt_count, GREATEST(1, p_window_seconds - v_elapsed);
    RETURN;
  END IF;

  UPDATE public.auth_rate_limits
  SET attempt_count = attempt_count + 1,
      updated_at = v_now
  WHERE bucket_key = p_bucket_key
  RETURNING * INTO v_row;

  RETURN QUERY SELECT TRUE, v_row.attempt_count, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_rate_limit(TEXT, INT, INT) TO service_role;
