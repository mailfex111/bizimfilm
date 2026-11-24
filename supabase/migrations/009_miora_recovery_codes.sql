-- ============================================================================
-- Miora Migration 009: Salted-Hashed Single-Use Account Recovery Codes
-- ============================================================================
-- Supports username-first authentication without requiring real emails or SMS.
-- Recovery codes are NEVER stored in plaintext — only per-code random 128-bit
-- salts (`code_salt`) and SHA-256 hex digests (`code_hash`).
-- Strict deny-by-default: RLS enabled with ZERO client policies AND table
-- privileges explicitly revoked from PUBLIC, anon, and authenticated.
-- Accessed exclusively by rate-limited server-side routes using service_role.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_salt TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT account_recovery_codes_hash_len CHECK (char_length(code_hash) = 64),
  CONSTRAINT account_recovery_codes_salt_len CHECK (char_length(code_salt) >= 16)
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_codes_user_active
  ON public.account_recovery_codes (user_id, created_at DESC)
  WHERE used_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.account_recovery_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_recovery_codes FROM PUBLIC, anon, authenticated;
