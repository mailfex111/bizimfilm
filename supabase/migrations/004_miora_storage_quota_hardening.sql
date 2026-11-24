-- ============================================================================
-- Miora Migration 004: Direct-API Storage Quota Enforcement & RPC Hardening
-- ============================================================================
-- Fixes discovered during live Supabase penetration & security audit:
-- 1. Prevents direct Supabase Storage API uploads from bypassing the 500 MB
--    couple quota (requires active reservation + checks real storage.objects bytes).
-- 2. Prevents client file_size spoofing in finalize_media_upload() by reading
--    verified server-side byte sizes directly from storage.objects.metadata.
-- 3. Caps per-user avatars bucket usage at 10 MB to prevent avatar storage abuse.
-- 4. Explicitly revokes EXECUTE from `anon` on all authenticated RPCs & helpers
--    (Supabase default privileges grant EXECUTE to `anon` explicitly).
-- 5. Prevents cross-couple FK probing via user_preferences.last_open_book_id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Storage RLS Guard: Couple Private Buckets Quota & Reservation Verification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_upload_to_couple_bucket(
  target_couple_id UUID,
  incoming_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_used_bytes BIGINT;
  v_quota_bytes BIGINT;
  v_reserved_total BIGINT;
  v_actual_storage_bytes BIGINT;
  v_incoming_bytes BIGINT;
BEGIN
  IF v_user_id IS NULL OR target_couple_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT public.is_couple_member(target_couple_id) THEN
    RETURN FALSE;
  END IF;

  SELECT used_bytes, quota_bytes
  INTO v_used_bytes, v_quota_bytes
  FROM public.storage_usage
  WHERE couple_id = target_couple_id;

  IF v_quota_bytes IS NULL THEN
    v_used_bytes := 0;
    v_quota_bytes := 524288000;
  END IF;

  -- Require an active unexpired quota reservation created via reserve_storage_quota()
  SELECT COALESCE(SUM(reserved_bytes), 0)
  INTO v_reserved_total
  FROM public.storage_quota_reservations
  WHERE couple_id = target_couple_id
    AND user_id = v_user_id
    AND expires_at > NOW();

  IF v_reserved_total <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Parse incoming object byte size from storage.objects.metadata when available
  BEGIN
    v_incoming_bytes := GREATEST(0, COALESCE(NULLIF(incoming_metadata ->> 'size', '')::BIGINT, 0));
  EXCEPTION WHEN invalid_text_representation THEN
    v_incoming_bytes := 0;
  END;

  IF v_incoming_bytes > v_reserved_total THEN
    RETURN FALSE;
  END IF;

  -- Compute actual cumulative bytes stored across all 5 couple buckets
  SELECT COALESCE(SUM(
    CASE
      WHEN (o.metadata ->> 'size') ~ '^[0-9]+$' THEN (o.metadata ->> 'size')::BIGINT
      ELSE 0
    END
  ), 0)
  INTO v_actual_storage_bytes
  FROM storage.objects o
  WHERE o.bucket_id IN ('couple-photos', 'couple-videos', 'couple-music', 'book-assets', 'thumbnails')
    AND (storage.foldername(o.name))[1] = target_couple_id::TEXT;

  IF (GREATEST(v_used_bytes, v_actual_storage_bytes) + v_incoming_bytes) > v_quota_bytes THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Storage RLS Guard: Per-User Avatar Cap (10 MB max total in avatars/{uid}/)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_upload_avatar(
  target_user_id UUID,
  incoming_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_actual_bytes BIGINT;
  v_incoming_bytes BIGINT;
BEGIN
  IF v_user_id IS NULL OR target_user_id IS NULL OR target_user_id <> v_user_id THEN
    RETURN FALSE;
  END IF;

  BEGIN
    v_incoming_bytes := GREATEST(0, COALESCE(NULLIF(incoming_metadata ->> 'size', '')::BIGINT, 0));
  EXCEPTION WHEN invalid_text_representation THEN
    v_incoming_bytes := 0;
  END;

  SELECT COALESCE(SUM(
    CASE
      WHEN (o.metadata ->> 'size') ~ '^[0-9]+$' THEN (o.metadata ->> 'size')::BIGINT
      ELSE 0
    END
  ), 0)
  INTO v_actual_bytes
  FROM storage.objects o
  WHERE o.bucket_id = 'avatars'
    AND (storage.foldername(o.name))[1] = v_user_id::TEXT;

  -- 10 MB total cap per user in avatars bucket (allows replacing existing avatar cleanly)
  RETURN (v_actual_bytes + v_incoming_bytes) <= 10485760;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Replace Storage INSERT/UPDATE RLS Policies with Quota-Enforced Checks
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "avatars_insert_self" ON storage.objects;
CREATE POLICY "avatars_insert_self"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name NOT LIKE '%..%'
    AND public.can_upload_avatar(public.try_parse_uuid((storage.foldername(name))[1]), metadata)
  );

DROP POLICY IF EXISTS "avatars_update_self" ON storage.objects;
CREATE POLICY "avatars_update_self"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND name NOT LIKE '%..%'
    AND public.can_upload_avatar(public.try_parse_uuid((storage.foldername(name))[1]), metadata)
  );

DROP POLICY IF EXISTS "couple_buckets_insert_member" ON storage.objects;
CREATE POLICY "couple_buckets_insert_member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('couple-photos', 'couple-videos', 'couple-music', 'book-assets', 'thumbnails')
    AND name NOT LIKE '%..%'
    AND public.can_upload_to_couple_bucket(public.try_parse_uuid((storage.foldername(name))[1]), metadata)
  );

DROP POLICY IF EXISTS "couple_buckets_update_member" ON storage.objects;
CREATE POLICY "couple_buckets_update_member"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('couple-photos', 'couple-videos', 'couple-music', 'book-assets', 'thumbnails')
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  )
  WITH CHECK (
    bucket_id IN ('couple-photos', 'couple-videos', 'couple-music', 'book-assets', 'thumbnails')
    AND name NOT LIKE '%..%'
    AND public.can_upload_to_couple_bucket(public.try_parse_uuid((storage.foldername(name))[1]), metadata)
  );

-- ----------------------------------------------------------------------------
-- 4. Harden finalize_media_upload(): Verify Storage Existence & Real Byte Size
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_media_upload(
  p_reservation_id UUID,
  p_media_type TEXT,
  p_storage_path TEXT,
  p_thumbnail_path TEXT DEFAULT NULL,
  p_original_filename TEXT DEFAULT NULL,
  p_mime_type TEXT DEFAULT 'application/octet-stream',
  p_file_size BIGINT DEFAULT 0,
  p_width INT DEFAULT NULL,
  p_height INT DEFAULT NULL,
  p_duration NUMERIC DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_memory_date DATE DEFAULT NULL,
  p_dedup_hash TEXT DEFAULT NULL
)
RETURNS public.media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_couple_id UUID;
  v_main_bucket TEXT;
  v_real_main_bytes BIGINT := 0;
  v_real_thumb_bytes BIGINT := 0;
  v_verified_size BIGINT := 0;
  v_usage public.storage_usage;
  v_media public.media;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT couple_id INTO v_couple_id
  FROM public.couple_members
  WHERE user_id = v_user_id;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'NO_COUPLE_SPACE';
  END IF;

  v_main_bucket := CASE p_media_type
    WHEN 'photo' THEN 'couple-photos'
    WHEN 'video' THEN 'couple-videos'
    WHEN 'audio' THEN 'couple-music'
    WHEN 'book_asset' THEN 'book-assets'
    ELSE NULL
  END;

  IF v_main_bucket IS NULL THEN
    RAISE EXCEPTION 'INVALID_MEDIA_TYPE: Geçersiz medya türü.';
  END IF;

  -- Enforce that storage_path starts with caller's verified couple_id and has no traversal
  IF p_storage_path IS NULL
     OR p_storage_path LIKE '%..%'
     OR left(p_storage_path, char_length(v_couple_id::text) + 1) <> (v_couple_id::text || '/') THEN
    RAISE EXCEPTION 'INVALID_STORAGE_PATH: Dosya yolu yetkisiz bir çift alanına işaret ediyor.';
  END IF;

  IF p_thumbnail_path IS NOT NULL
     AND (p_thumbnail_path LIKE '%..%'
          OR left(p_thumbnail_path, char_length(v_couple_id::text) + 1) <> (v_couple_id::text || '/')) THEN
    RAISE EXCEPTION 'INVALID_THUMBNAIL_PATH';
  END IF;

  -- Verify uploaded object exists in storage.objects and read server-verified size
  SELECT
    CASE WHEN (o.metadata ->> 'size') ~ '^[0-9]+$' THEN (o.metadata ->> 'size')::BIGINT ELSE 0 END
  INTO v_real_main_bytes
  FROM storage.objects o
  WHERE o.bucket_id = v_main_bucket
    AND o.name = p_storage_path;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORAGE_OBJECT_NOT_FOUND: Dosya depolama alanında doğrulanamadı.';
  END IF;

  IF p_thumbnail_path IS NOT NULL THEN
    SELECT
      CASE WHEN (o.metadata ->> 'size') ~ '^[0-9]+$' THEN (o.metadata ->> 'size')::BIGINT ELSE 0 END
    INTO v_real_thumb_bytes
    FROM storage.objects o
    WHERE o.bucket_id = 'thumbnails'
      AND o.name = p_thumbnail_path;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'THUMBNAIL_OBJECT_NOT_FOUND: Küçük resim depolama alanında doğrulanamadı.';
    END IF;
  END IF;

  -- Never trust spoofed tiny p_file_size; always use real server-verified byte size
  v_verified_size := CASE
    WHEN (v_real_main_bytes + v_real_thumb_bytes) > 0
      THEN (v_real_main_bytes + v_real_thumb_bytes)
    ELSE GREATEST(1, COALESCE(p_file_size, 0))
  END;

  -- Lock storage_usage row
  SELECT * INTO v_usage
  FROM public.storage_usage
  WHERE couple_id = v_couple_id
  FOR UPDATE;

  IF v_usage.couple_id IS NULL THEN
    INSERT INTO public.storage_usage (couple_id, used_bytes, quota_bytes)
    VALUES (v_couple_id, 0, 524288000)
    RETURNING * INTO v_usage;
  END IF;

  IF p_reservation_id IS NOT NULL THEN
    DELETE FROM public.storage_quota_reservations
    WHERE id = p_reservation_id
      AND couple_id = v_couple_id
      AND user_id = v_user_id;
  END IF;

  IF (v_usage.used_bytes + v_verified_size) > v_usage.quota_bytes THEN
    RAISE EXCEPTION 'STORAGE_QUOTA_EXCEEDED: Depolama kotanız aşıldı.'
      USING ERRCODE = '53100';
  END IF;

  INSERT INTO public.media (
    couple_id, uploaded_by, media_type, storage_path, thumbnail_path,
    original_filename, mime_type, file_size, width, height, duration,
    title, description, memory_date, dedup_hash
  )
  VALUES (
    v_couple_id, v_user_id, p_media_type, p_storage_path, p_thumbnail_path,
    p_original_filename, p_mime_type, v_verified_size, p_width, p_height, p_duration,
    p_title, p_description, p_memory_date, p_dedup_hash
  )
  RETURNING * INTO v_media;

  UPDATE public.storage_usage
  SET used_bytes = used_bytes + v_verified_size
  WHERE couple_id = v_couple_id;

  RETURN v_media;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Prevent Cross-Couple Probing via user_preferences.last_open_book_id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_pref_last_book_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.last_open_book_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.memory_books mb
      JOIN public.couple_members cm ON cm.couple_id = mb.couple_id
      WHERE mb.id = NEW.last_open_book_id
        AND cm.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN_BOOK_REFERENCE: Seçilen anı kitabı çift alanınıza ait değil.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_pref_last_book ON public.user_preferences;
CREATE TRIGGER trg_enforce_user_pref_last_book
  BEFORE INSERT OR UPDATE OF last_open_book_id ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_pref_last_book_owner();

-- ----------------------------------------------------------------------------
-- 6. Explicitly Revoke EXECUTE from `anon` on All Authenticated Functions
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_couple_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_couple_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_couple_with(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_upload_to_couple_bucket(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_upload_avatar(UUID, JSONB) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.notify_partner_event(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_couple_space(TEXT, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_couple_invite(INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_couple_invite(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_couple_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_couple_space() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_storage_quota(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_storage_reservation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_media_upload(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, INT, INT, NUMERIC, TEXT, TEXT, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_media_and_reclaim_quota(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_couple_storage_breakdown() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_memory_page_optimistic(UUID, INT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_couple_content(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_couple_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_couple_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_couple_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_to_couple_bucket(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_avatar(UUID, JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_couple_space(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_couple_invite(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_couple_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_couple_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_couple_space() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_storage_quota(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_storage_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_media_upload(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, INT, INT, NUMERIC, TEXT, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_media_and_reclaim_quota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_couple_storage_breakdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_memory_page_optimistic(UUID, INT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_couple_content(TEXT) TO authenticated;
