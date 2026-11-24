-- ============================================================================
-- Miora Migration 001: Core Relational PostgreSQL Schema
-- ============================================================================
-- Enforce strict referential integrity, couple_id consistency across tables,
-- max 2 active members per couple, and 1 active couple per user.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Helper: Safe UUID parser (prevents cast exceptions in storage/RLS policies)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_parse_uuid(input_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN input_text::UUID;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- Helper: Automatic updated_at timestamp trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. profiles (linked 1:1 with auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_username_format CHECK (
    char_length(username) BETWEEN 3 AND 32
    AND username ~ '^[a-zA-Z0-9._-]+$'
  ),
  CONSTRAINT profiles_display_name_length CHECK (
    char_length(trim(display_name)) BETWEEN 1 AND 80
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username));

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. couples
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_name TEXT NOT NULL,
  relationship_start_date DATE,
  cover_image_path TEXT,
  default_track_media_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT couples_name_length CHECK (char_length(trim(couple_name)) BETWEEN 1 AND 120)
);

DROP TRIGGER IF EXISTS trg_couples_updated_at ON public.couples;
CREATE TRIGGER trg_couples_updated_at
  BEFORE UPDATE ON public.couples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. couple_members (max 1 active couple per user, max 2 members per couple)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.couple_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'partner' CHECK (role IN ('owner', 'partner')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_couple_members_couple_id
  ON public.couple_members (couple_id);

CREATE OR REPLACE FUNCTION public.enforce_max_two_couple_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  member_count INT;
BEGIN
  -- Serialize membership mutations per couple row to prevent race conditions
  PERFORM 1 FROM public.couples WHERE id = NEW.couple_id FOR UPDATE;

  SELECT COUNT(*) INTO member_count
  FROM public.couple_members
  WHERE couple_id = NEW.couple_id
    AND id IS DISTINCT FROM NEW.id;

  IF member_count >= 2 THEN
    RAISE EXCEPTION 'COUPLE_MEMBER_LIMIT_REACHED: Bu çift alanında en fazla 2 aktif üye bulunabilir.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_two_couple_members ON public.couple_members;
CREATE TRIGGER trg_enforce_max_two_couple_members
  BEFORE INSERT OR UPDATE OF couple_id ON public.couple_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_two_couple_members();

-- ----------------------------------------------------------------------------
-- 4. couple_invites (single-use, expiring, revocable, SHA-256 token hash only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.couple_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT couple_invites_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_couple_invites_couple_id
  ON public.couple_invites (couple_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. media (photos, videos, audio, book assets — private storage paths only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'audio', 'book_asset')),
  storage_path TEXT NOT NULL UNIQUE,
  thumbnail_path TEXT,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  width INT CHECK (width IS NULL OR width > 0),
  height INT CHECK (height IS NULL OR height > 0),
  duration NUMERIC(10,2) CHECK (duration IS NULL OR duration >= 0),
  title TEXT,
  description TEXT,
  memory_date DATE,
  dedup_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_id_couple_unique UNIQUE (id, couple_id)
);

CREATE INDEX IF NOT EXISTS idx_media_couple_type_created
  ON public.media (couple_id, media_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_couple_memory_date
  ON public.media (couple_id, memory_date DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_couple_dedup_hash
  ON public.media (couple_id, dedup_hash)
  WHERE dedup_hash IS NOT NULL;

-- Ensure couples.default_track_media_id always references media from the same couple
CREATE OR REPLACE FUNCTION public.enforce_couple_default_track_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.default_track_media_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.media
      WHERE id = NEW.default_track_media_id
        AND couple_id = NEW.id
        AND media_type = 'audio'
    ) THEN
      RAISE EXCEPTION 'INVALID_DEFAULT_TRACK: Seçilen giriş şarkısı bu çift alanına ait bir ses dosyası değil.'
        USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_couple_default_track ON public.couples;
CREATE TRIGGER trg_enforce_couple_default_track
  BEFORE INSERT OR UPDATE OF default_track_media_id ON public.couples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_couple_default_track_owner();

-- ----------------------------------------------------------------------------
-- 6. memory_books
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_media_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT memory_books_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 140),
  CONSTRAINT memory_books_id_couple_unique UNIQUE (id, couple_id),
  CONSTRAINT memory_books_cover_same_couple_fk
    FOREIGN KEY (cover_media_id, couple_id)
    REFERENCES public.media (id, couple_id)
    ON DELETE SET NULL (cover_media_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_books_couple_updated
  ON public.memory_books (couple_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_memory_books_updated_at ON public.memory_books;
CREATE TRIGGER trg_memory_books_updated_at
  BEFORE UPDATE ON public.memory_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. memory_pages (with optimistic concurrency `version`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL,
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  page_order INT NOT NULL DEFAULT 0 CHECK (page_order >= 0),
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  memory_date TEXT DEFAULT '',
  layout_type TEXT NOT NULL DEFAULT 'photo-text' CHECK (
    layout_type IN (
      'single-photo',
      'two-photos',
      'photo-text',
      'polaroid',
      'full-text',
      'video-note',
      'minimal-collage'
    )
  ),
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  dedup_hash TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT memory_pages_id_couple_unique UNIQUE (id, couple_id),
  CONSTRAINT memory_pages_book_same_couple_fk
    FOREIGN KEY (book_id, couple_id)
    REFERENCES public.memory_books (id, couple_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_pages_book_order
  ON public.memory_pages (book_id, page_order ASC);

CREATE INDEX IF NOT EXISTS idx_memory_pages_couple
  ON public.memory_pages (couple_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_pages_book_dedup
  ON public.memory_pages (book_id, dedup_hash)
  WHERE dedup_hash IS NOT NULL;

DROP TRIGGER IF EXISTS trg_memory_pages_updated_at ON public.memory_pages;
CREATE TRIGGER trg_memory_pages_updated_at
  BEFORE UPDATE ON public.memory_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. memory_page_elements (strictly scoped to same couple's page & media)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_page_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL,
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  element_type TEXT NOT NULL CHECK (element_type IN ('photo', 'video', 'text', 'caption')),
  media_id UUID,
  text_content TEXT,
  position_x NUMERIC(8,2) NOT NULL DEFAULT 0,
  position_y NUMERIC(8,2) NOT NULL DEFAULT 0,
  width NUMERIC(8,2) NOT NULL DEFAULT 100 CHECK (width > 0),
  height NUMERIC(8,2) NOT NULL DEFAULT 100 CHECK (height > 0),
  rotation NUMERIC(6,2) NOT NULL DEFAULT 0,
  layer_order INT NOT NULL DEFAULT 0,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT memory_page_elements_page_same_couple_fk
    FOREIGN KEY (page_id, couple_id)
    REFERENCES public.memory_pages (id, couple_id)
    ON DELETE CASCADE,
  CONSTRAINT memory_page_elements_media_same_couple_fk
    FOREIGN KEY (media_id, couple_id)
    REFERENCES public.media (id, couple_id)
    ON DELETE SET NULL (media_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_page_elements_page_layer
  ON public.memory_page_elements (page_id, layer_order ASC);

DROP TRIGGER IF EXISTS trg_memory_page_elements_updated_at ON public.memory_page_elements;
CREATE TRIGGER trg_memory_page_elements_updated_at
  BEFORE UPDATE ON public.memory_page_elements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. playlists & 10. playlist_tracks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT playlists_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  CONSTRAINT playlists_id_couple_unique UNIQUE (id, couple_id)
);

CREATE INDEX IF NOT EXISTS idx_playlists_couple
  ON public.playlists (couple_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL,
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  media_id UUID NOT NULL,
  track_order INT NOT NULL DEFAULT 0 CHECK (track_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT playlist_tracks_playlist_same_couple_fk
    FOREIGN KEY (playlist_id, couple_id)
    REFERENCES public.playlists (id, couple_id)
    ON DELETE CASCADE,
  CONSTRAINT playlist_tracks_media_same_couple_fk
    FOREIGN KEY (media_id, couple_id)
    REFERENCES public.media (id, couple_id)
    ON DELETE CASCADE,
  CONSTRAINT playlist_tracks_unique_track UNIQUE (playlist_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order
  ON public.playlist_tracks (playlist_id, track_order ASC);

-- ----------------------------------------------------------------------------
-- 11. special_dates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.special_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'custom' CHECK (
    category IN ('met', 'dating', 'anniversary', 'birthday', 'wedding', 'custom')
  ),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date DATE NOT NULL,
  repeat_yearly BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT special_dates_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_special_dates_couple_date
  ON public.special_dates (couple_id, event_date ASC);

-- ----------------------------------------------------------------------------
-- 12. notes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'note' CHECK (note_type IN ('note', 'letter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notes_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 140),
  CONSTRAINT notes_content_length CHECK (char_length(trim(content)) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_notes_couple_created
  ON public.notes (couple_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 13. notifications (user-scoped)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (
    notification_type IN ('invite_accepted', 'photo_added', 'video_added', 'audio_added', 'book_updated', 'note_added', 'system')
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

-- ----------------------------------------------------------------------------
-- 14. user_preferences
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  autoplay_music BOOLEAN NOT NULL DEFAULT FALSE,
  music_volume NUMERIC(3,2) NOT NULL DEFAULT 0.75 CHECK (music_volume >= 0 AND music_volume <= 1),
  theme TEXT NOT NULL DEFAULT 'dark',
  notification_preferences JSONB NOT NULL DEFAULT '{"partner_uploads":true,"book_updates":true,"notes":true,"invites":true}'::jsonb,
  last_open_book_id UUID REFERENCES public.memory_books(id) ON DELETE SET NULL,
  last_open_page_order INT NOT NULL DEFAULT 0 CHECK (last_open_page_order >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 15. storage_usage & atomic concurrent upload reservations (500 MB default)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storage_usage (
  couple_id UUID PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  quota_bytes BIGINT NOT NULL DEFAULT 524288000 CHECK (quota_bytes > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_storage_usage_updated_at ON public.storage_usage;
CREATE TRIGGER trg_storage_usage_updated_at
  BEFORE UPDATE ON public.storage_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.storage_quota_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reserved_bytes BIGINT NOT NULL CHECK (reserved_bytes > 0),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_reservations_couple_expiry
  ON public.storage_quota_reservations (couple_id, expires_at);
