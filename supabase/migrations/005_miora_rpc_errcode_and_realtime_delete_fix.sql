-- ============================================================================
-- Miora Migration 005: PostgREST Error Code Fix & Realtime DELETE Sync Support
-- ============================================================================
-- Fixes discovered during live 6-user / 3-couple end-to-end testing:
-- 1. Replaces ERRCODE '40001' (serialization_failure) in save_memory_page_optimistic()
--    with 'P0001' so PostgREST/Supabase gateway returns HTTP 400 immediately
--    instead of retrying for 125s and failing with HTTP 504 upstream timeout.
-- 2. Replaces ERRCODE '53100' (disk_full) in reserve_storage_quota() and
--    finalize_media_upload() with 'P0001' so quota exceeded returns clean HTTP 400
--    instead of HTTP 503 Service Unavailable.
-- 3. Enables REPLICA IDENTITY FULL on Realtime couple tables so filtered DELETE
--    events (filter: couple_id=eq.<uuid>) also synchronize live across devices.
-- ============================================================================

-- 1. Fix save_memory_page_optimistic(): immediate HTTP 400 VERSION_CONFLICT
CREATE OR REPLACE FUNCTION public.save_memory_page_optimistic(
  p_page_id UUID,
  p_expected_version INT,
  p_title TEXT,
  p_content TEXT,
  p_memory_date TEXT,
  p_layout_type TEXT
)
RETURNS public.memory_pages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_couple_id UUID := public.current_user_couple_id();
  v_page public.memory_pages;
BEGIN
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE public.memory_pages
  SET
    title = COALESCE(p_title, ''),
    content = COALESCE(p_content, ''),
    memory_date = COALESCE(p_memory_date, ''),
    layout_type = COALESCE(p_layout_type, layout_type),
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_page_id
    AND couple_id = v_couple_id
    AND version = p_expected_version
  RETURNING * INTO v_page;

  IF v_page.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.memory_pages WHERE id = p_page_id AND couple_id = v_couple_id) THEN
      RAISE EXCEPTION 'VERSION_CONFLICT: Bu sayfa partneriniz tarafından güncellenmiş.'
        USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'PAGE_NOT_FOUND_OR_FORBIDDEN'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN v_page;
END;
$$;

-- 2. Fix reserve_storage_quota(): immediate HTTP 400 STORAGE_QUOTA_EXCEEDED
CREATE OR REPLACE FUNCTION public.reserve_storage_quota(p_bytes BIGINT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_couple_id UUID;
  v_usage public.storage_usage;
  v_active_reserved BIGINT;
  v_reservation_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_bytes IS NULL OR p_bytes <= 0 THEN
    RAISE EXCEPTION 'INVALID_FILE_SIZE: Geçersiz dosya boyutu.';
  END IF;

  SELECT couple_id INTO v_couple_id
  FROM public.couple_members
  WHERE user_id = v_user_id;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'NO_COUPLE_SPACE';
  END IF;

  SELECT * INTO v_usage
  FROM public.storage_usage
  WHERE couple_id = v_couple_id
  FOR UPDATE;

  IF v_usage.couple_id IS NULL THEN
    INSERT INTO public.storage_usage (couple_id, used_bytes, quota_bytes)
    VALUES (v_couple_id, 0, 524288000)
    RETURNING * INTO v_usage;
  END IF;

  DELETE FROM public.storage_quota_reservations
  WHERE couple_id = v_couple_id
    AND expires_at < NOW();

  SELECT COALESCE(SUM(reserved_bytes), 0) INTO v_active_reserved
  FROM public.storage_quota_reservations
  WHERE couple_id = v_couple_id;

  IF (v_usage.used_bytes + v_active_reserved + p_bytes) > v_usage.quota_bytes THEN
    RAISE EXCEPTION 'STORAGE_QUOTA_EXCEEDED: Depolama kotanız doldu (% / % MB).',
      ROUND((v_usage.used_bytes + v_active_reserved)::NUMERIC / 1048576, 1),
      ROUND(v_usage.quota_bytes::NUMERIC / 1048576, 0)
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.storage_quota_reservations (couple_id, user_id, reserved_bytes)
  VALUES (v_couple_id, v_user_id, p_bytes)
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;

-- 3. Fix finalize_media_upload(): immediate HTTP 400 STORAGE_QUOTA_EXCEEDED (keeps 004 storage verification)
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

  v_verified_size := CASE
    WHEN (v_real_main_bytes + v_real_thumb_bytes) > 0
      THEN (v_real_main_bytes + v_real_thumb_bytes)
    ELSE GREATEST(1, COALESCE(p_file_size, 0))
  END;

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
      USING ERRCODE = 'P0001';
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

-- Re-assert strict permissions (revoke anon, allow authenticated only)
REVOKE ALL ON FUNCTION public.save_memory_page_optimistic(UUID, INT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_storage_quota(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_media_upload(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, INT, INT, NUMERIC, TEXT, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_memory_page_optimistic(UUID, INT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_storage_quota(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_media_upload(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, INT, INT, NUMERIC, TEXT, TEXT, DATE, TEXT) TO authenticated;

-- 4. Enable REPLICA IDENTITY FULL on couple Realtime tables so filtered DELETE events propagate live
ALTER TABLE public.media REPLICA IDENTITY FULL;
ALTER TABLE public.memory_books REPLICA IDENTITY FULL;
ALTER TABLE public.memory_pages REPLICA IDENTITY FULL;
ALTER TABLE public.memory_page_elements REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.special_dates REPLICA IDENTITY FULL;
ALTER TABLE public.playlists REPLICA IDENTITY FULL;
ALTER TABLE public.playlist_tracks REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.couple_members REPLICA IDENTITY FULL;
