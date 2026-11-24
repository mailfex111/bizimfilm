-- ============================================================================
-- Miora Migration 003: Private Storage Buckets, Storage RLS & Realtime
-- ============================================================================

-- 1. Create 6 Private Buckets (public = false strictly enforced)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', FALSE, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('couple-photos', 'couple-photos', FALSE, 20971520, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('couple-videos', 'couple-videos', FALSE, 52428800, ARRAY['video/mp4', 'video/webm', 'video/quicktime']),
  ('couple-music', 'couple-music', FALSE, 26214400, ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/webm']),
  ('book-assets', 'book-assets', FALSE, 20971520, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('thumbnails', 'thumbnails', FALSE, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS Policies: Avatars ({user_id}/{uuid}.webp)
DROP POLICY IF EXISTS "avatars_select_self_or_partner" ON storage.objects;
CREATE POLICY "avatars_select_self_or_partner"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
      OR public.shares_couple_with(public.try_parse_uuid((storage.foldername(name))[1]))
    )
  );

DROP POLICY IF EXISTS "avatars_insert_self" ON storage.objects;
CREATE POLICY "avatars_insert_self"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
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
    AND public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
  );

DROP POLICY IF EXISTS "avatars_delete_self" ON storage.objects;
CREATE POLICY "avatars_delete_self"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
  );

-- 3. Storage RLS Policies: Couple-scoped private buckets ({couple_id}/{uuid}.{ext})
DROP POLICY IF EXISTS "couple_buckets_select_member" ON storage.objects;
CREATE POLICY "couple_buckets_select_member"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('couple-photos', 'couple-videos', 'couple-music', 'book-assets', 'thumbnails')
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS "couple_buckets_insert_member" ON storage.objects;
CREATE POLICY "couple_buckets_insert_member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('couple-photos', 'couple-videos', 'couple-music', 'book-assets', 'thumbnails')
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
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
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS "couple_buckets_delete_member" ON storage.objects;
CREATE POLICY "couple_buckets_delete_member"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('couple-photos', 'couple-videos', 'couple-music', 'book-assets', 'thumbnails')
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  );

-- 4. Enable Supabase Realtime on Couple Tables (RLS still filters every event!)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'media',
    'memory_books',
    'memory_pages',
    'memory_page_elements',
    'playlists',
    'playlist_tracks',
    'notes',
    'special_dates',
    'notifications',
    'profiles',
    'couple_members',
    'couples',
    'storage_usage'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    END IF;
  END LOOP;
END;
$$;
