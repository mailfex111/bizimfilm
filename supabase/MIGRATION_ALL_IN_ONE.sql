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


-- ============================================================================

-- ============================================================================
-- Miora Migration 002: Deny-by-Default RLS Policies, Auth Triggers & Secure RPCs
-- ============================================================================
-- Every SECURITY DEFINER function pins `search_path = public, pg_temp`,
-- validates `auth.uid()`, and prevents cross-couple access or race conditions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Non-recursive RLS Membership Helper Functions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_couple_member(target_couple_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.couple_members
    WHERE couple_id = target_couple_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_couple_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT couple_id
  FROM public.couple_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.shares_couple_with(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.couple_members cm1
    JOIN public.couple_members cm2
      ON cm1.couple_id = cm2.couple_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = target_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_couple_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_couple_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shares_couple_with(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_couple_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_couple_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_couple_with(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- Automatic Profile & Preferences Bootstrap on Auth Signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  raw_username TEXT;
  clean_username TEXT;
  clean_display TEXT;
BEGIN
  raw_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'user'
  );
  clean_username := regexp_replace(lower(raw_username), '[^a-z0-9._-]', '', 'g');
  IF char_length(clean_username) < 3 THEN
    clean_username := 'miora_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;
  clean_username := left(clean_username, 24);

  -- Append short suffix if username already taken
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(clean_username)) THEN
    clean_username := left(clean_username, 20) || '_' || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;

  clean_display := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    initcap(split_part(COALESCE(NEW.email, 'Kullanıcı'), '@', 1))
  );

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, clean_username, left(clean_display, 80))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- Partner Activity Notification Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_partner_event(
  p_couple_id UUID,
  p_actor_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (couple_id, user_id, notification_type, title, message)
  SELECT cm.couple_id, cm.user_id, p_type, p_title, p_message
  FROM public.couple_members cm
  WHERE cm.couple_id = p_couple_id
    AND cm.user_id <> p_actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_on_media_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  actor_name TEXT;
  notif_type TEXT;
  notif_title TEXT;
  notif_msg TEXT;
BEGIN
  IF NEW.uploaded_by IS NULL OR NEW.media_type = 'book_asset' THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.uploaded_by;
  actor_name := COALESCE(actor_name, 'Partneriniz');

  IF NEW.media_type = 'photo' THEN
    notif_type := 'photo_added';
    notif_title := 'Yeni fotoğraf eklendi';
    notif_msg := actor_name || ' galeriye yeni bir fotoğraf ekledi.';
  ELSIF NEW.media_type = 'video' THEN
    notif_type := 'video_added';
    notif_title := 'Yeni video eklendi';
    notif_msg := actor_name || ' yeni bir video yükledi.';
  ELSIF NEW.media_type = 'audio' THEN
    notif_type := 'audio_added';
    notif_title := 'Yeni şarkı eklendi';
    notif_msg := actor_name || ' müzik listenize yeni bir parça ekledi.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.notify_partner_event(NEW.couple_id, NEW.uploaded_by, notif_type, notif_title, notif_msg);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_notify_partner ON public.media;
CREATE TRIGGER trg_media_notify_partner
  AFTER INSERT ON public.media
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_media_insert();

CREATE OR REPLACE FUNCTION public.trg_notify_on_note_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  actor_name TEXT;
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT display_name INTO actor_name FROM public.profiles WHERE id = NEW.created_by;
  actor_name := COALESCE(actor_name, 'Partneriniz');

  PERFORM public.notify_partner_event(
    NEW.couple_id,
    NEW.created_by,
    'note_added',
    'Yeni not bırakıldı',
    actor_name || ' "' || left(NEW.title, 60) || '" başlıklı bir not yazdı.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notes_notify_partner ON public.notes;
CREATE TRIGGER trg_notes_notify_partner
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_note_insert();

CREATE OR REPLACE FUNCTION public.trg_notify_on_page_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  actor_id UUID;
  actor_name TEXT;
  recently_notified BOOLEAN;
BEGIN
  actor_id := COALESCE(auth.uid(), NEW.created_by);
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Throttle duplicate book_updated notifications within 5 minutes for debounced autosave
  SELECT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE couple_id = NEW.couple_id
      AND notification_type = 'book_updated'
      AND created_at > (NOW() - INTERVAL '5 minutes')
  ) INTO recently_notified;

  IF recently_notified THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO actor_name FROM public.profiles WHERE id = actor_id;
  actor_name := COALESCE(actor_name, 'Partneriniz');

  PERFORM public.notify_partner_event(
    NEW.couple_id,
    actor_id,
    'book_updated',
    'Anı kitabı güncellendi',
    actor_name || ' anı kitabını güncelledi.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memory_pages_notify_partner ON public.memory_pages;
CREATE TRIGGER trg_memory_pages_notify_partner
  AFTER INSERT OR UPDATE OF title, content ON public.memory_pages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_page_change();

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES (DENY BY DEFAULT)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_page_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_quota_reservations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS: profiles (self + active partner only; mutate self only)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_self_or_partner" ON public.profiles;
CREATE POLICY "profiles_select_self_or_partner"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.shares_couple_with(id));

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete_self" ON public.profiles;
CREATE POLICY "profiles_delete_self"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: couples (members read/update only; creation via create_couple_space RPC)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "couples_select_member" ON public.couples;
CREATE POLICY "couples_select_member"
  ON public.couples FOR SELECT
  TO authenticated
  USING (public.is_couple_member(id));

DROP POLICY IF EXISTS "couples_update_member" ON public.couples;
CREATE POLICY "couples_update_member"
  ON public.couples FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(id))
  WITH CHECK (public.is_couple_member(id));

-- ----------------------------------------------------------------------------
-- RLS: couple_members (read own couple only; NO direct client INSERT/UPDATE/DELETE)
-- All membership mutations go strictly through validated SECURITY DEFINER RPCs.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "couple_members_select_own_couple" ON public.couple_members;
CREATE POLICY "couple_members_select_own_couple"
  ON public.couple_members FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: couple_invites (members can view/revoke own couple invites; creation/accept via RPC)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "couple_invites_select_member" ON public.couple_invites;
CREATE POLICY "couple_invites_select_member"
  ON public.couple_invites FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: media (strictly scoped to verified couple_members; INSERT/DELETE via quota RPCs or verified check)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "media_select_member" ON public.media;
CREATE POLICY "media_select_member"
  ON public.media FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "media_update_member" ON public.media;
CREATE POLICY "media_update_member"
  ON public.media FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (
    public.is_couple_member(couple_id)
    AND couple_id = public.current_user_couple_id()
  );

-- Direct DELETE blocked in favor of delete_media_and_reclaim_quota RPC so quota stays exact,
-- OR allowed only via RPC; keep SELECT + UPDATE policies strict.

-- ----------------------------------------------------------------------------
-- RLS: memory_books
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "memory_books_select_member" ON public.memory_books;
CREATE POLICY "memory_books_select_member"
  ON public.memory_books FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "memory_books_insert_member" ON public.memory_books;
CREATE POLICY "memory_books_insert_member"
  ON public.memory_books FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_couple_member(couple_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "memory_books_update_member" ON public.memory_books;
CREATE POLICY "memory_books_update_member"
  ON public.memory_books FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "memory_books_delete_member" ON public.memory_books;
CREATE POLICY "memory_books_delete_member"
  ON public.memory_books FOR DELETE
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: memory_pages
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "memory_pages_select_member" ON public.memory_pages;
CREATE POLICY "memory_pages_select_member"
  ON public.memory_pages FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "memory_pages_insert_member" ON public.memory_pages;
CREATE POLICY "memory_pages_insert_member"
  ON public.memory_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_couple_member(couple_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "memory_pages_update_member" ON public.memory_pages;
CREATE POLICY "memory_pages_update_member"
  ON public.memory_pages FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "memory_pages_delete_member" ON public.memory_pages;
CREATE POLICY "memory_pages_delete_member"
  ON public.memory_pages FOR DELETE
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: memory_page_elements
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "memory_page_elements_select_member" ON public.memory_page_elements;
CREATE POLICY "memory_page_elements_select_member"
  ON public.memory_page_elements FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "memory_page_elements_insert_member" ON public.memory_page_elements;
CREATE POLICY "memory_page_elements_insert_member"
  ON public.memory_page_elements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "memory_page_elements_update_member" ON public.memory_page_elements;
CREATE POLICY "memory_page_elements_update_member"
  ON public.memory_page_elements FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "memory_page_elements_delete_member" ON public.memory_page_elements;
CREATE POLICY "memory_page_elements_delete_member"
  ON public.memory_page_elements FOR DELETE
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: playlists & playlist_tracks
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "playlists_select_member" ON public.playlists;
CREATE POLICY "playlists_select_member"
  ON public.playlists FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "playlists_insert_member" ON public.playlists;
CREATE POLICY "playlists_insert_member"
  ON public.playlists FOR INSERT
  TO authenticated
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "playlists_update_member" ON public.playlists;
CREATE POLICY "playlists_update_member"
  ON public.playlists FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "playlists_delete_member" ON public.playlists;
CREATE POLICY "playlists_delete_member"
  ON public.playlists FOR DELETE
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "playlist_tracks_select_member" ON public.playlist_tracks;
CREATE POLICY "playlist_tracks_select_member"
  ON public.playlist_tracks FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "playlist_tracks_insert_member" ON public.playlist_tracks;
CREATE POLICY "playlist_tracks_insert_member"
  ON public.playlist_tracks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "playlist_tracks_update_member" ON public.playlist_tracks;
CREATE POLICY "playlist_tracks_update_member"
  ON public.playlist_tracks FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "playlist_tracks_delete_member" ON public.playlist_tracks;
CREATE POLICY "playlist_tracks_delete_member"
  ON public.playlist_tracks FOR DELETE
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: special_dates
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "special_dates_select_member" ON public.special_dates;
CREATE POLICY "special_dates_select_member"
  ON public.special_dates FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "special_dates_insert_member" ON public.special_dates;
CREATE POLICY "special_dates_insert_member"
  ON public.special_dates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_couple_member(couple_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "special_dates_update_member" ON public.special_dates;
CREATE POLICY "special_dates_update_member"
  ON public.special_dates FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "special_dates_delete_member" ON public.special_dates;
CREATE POLICY "special_dates_delete_member"
  ON public.special_dates FOR DELETE
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: notes
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notes_select_member" ON public.notes;
CREATE POLICY "notes_select_member"
  ON public.notes FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "notes_insert_member" ON public.notes;
CREATE POLICY "notes_insert_member"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_couple_member(couple_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "notes_update_member" ON public.notes;
CREATE POLICY "notes_update_member"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(couple_id))
  WITH CHECK (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "notes_delete_member" ON public.notes;
CREATE POLICY "notes_delete_member"
  ON public.notes FOR DELETE
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ----------------------------------------------------------------------------
-- RLS: notifications (strictly own notifications)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: user_preferences (strictly own preferences)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: storage_usage (members read only; mutations strictly via quota RPCs)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "storage_usage_select_member" ON public.storage_usage;
CREATE POLICY "storage_usage_select_member"
  ON public.storage_usage FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- storage_quota_reservations: no direct client policies (RPC only)

-- ============================================================================
-- SECURE ATOMIC RPC FUNCTIONS
-- ============================================================================

-- 1. Create a new couple space + default memory book + default playlist + storage quota
CREATE OR REPLACE FUNCTION public.create_couple_space(
  p_couple_name TEXT,
  p_relationship_start_date DATE DEFAULT NULL
)
RETURNS public.couples
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_couple public.couples;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Oturum açmanız gerekiyor.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.couple_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'ALREADY_IN_COUPLE: Zaten aktif bir çift alanına üyesiniz.';
  END IF;

  INSERT INTO public.couples (couple_name, relationship_start_date, created_by)
  VALUES (trim(p_couple_name), p_relationship_start_date, v_user_id)
  RETURNING * INTO v_couple;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_couple.id, v_user_id, 'owner');

  INSERT INTO public.storage_usage (couple_id, used_bytes, quota_bytes)
  VALUES (v_couple.id, 0, 524288000);

  INSERT INTO public.memory_books (couple_id, title, description, created_by)
  VALUES (v_couple.id, 'Bizim Hikayemiz', 'Birlikte biriktirdiğimiz anılar', v_user_id);

  INSERT INTO public.playlists (couple_id, title, is_default)
  VALUES (v_couple.id, 'Bizim Şarkılarımız', TRUE);

  IF p_relationship_start_date IS NOT NULL THEN
    INSERT INTO public.special_dates (couple_id, category, title, description, event_date, repeat_yearly, created_by)
    VALUES (
      v_couple.id,
      'anniversary',
      'İlişkimizin Başlangıcı',
      'Birlikte yola çıktığımız ilk gün.',
      p_relationship_start_date,
      TRUE,
      v_user_id
    );
  END IF;

  RETURN v_couple;
END;
$$;

-- 2. Generate cryptographically secure single-use invite token (stores only SHA-256 hash)
CREATE OR REPLACE FUNCTION public.create_couple_invite(
  p_expires_hours INT DEFAULT 72
)
RETURNS TABLE (
  invite_id UUID,
  invite_code TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_couple_id UUID;
  v_member_count INT;
  v_raw_token TEXT;
  v_hash TEXT;
  v_expires TIMESTAMPTZ;
  v_invite_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT couple_id INTO v_couple_id
  FROM public.couple_members
  WHERE user_id = v_user_id;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'NO_COUPLE_SPACE: Önce bir çift alanı oluşturmalısınız.';
  END IF;

  PERFORM 1 FROM public.couples WHERE id = v_couple_id FOR UPDATE;

  SELECT COUNT(*) INTO v_member_count
  FROM public.couple_members
  WHERE couple_id = v_couple_id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'COUPLE_FULL: Bu çift alanında zaten iki aktif üye bulunuyor.';
  END IF;

  -- Generate 192-bit cryptographic random URL-safe invite token
  v_raw_token := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
  v_expires := NOW() + make_interval(hours => GREATEST(1, LEAST(p_expires_hours, 168)));

  INSERT INTO public.couple_invites (couple_id, token_hash, expires_at, created_by)
  VALUES (v_couple_id, v_hash, v_expires, v_user_id)
  RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT v_invite_id, v_raw_token, v_expires;
END;
$$;

-- 3. Revoke an active invite
CREATE OR REPLACE FUNCTION public.revoke_couple_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_couple_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT couple_id INTO v_couple_id
  FROM public.couple_members
  WHERE user_id = v_user_id;

  UPDATE public.couple_invites
  SET revoked_at = NOW()
  WHERE id = p_invite_id
    AND couple_id = v_couple_id
    AND used_at IS NULL
    AND revoked_at IS NULL;
END;
$$;

-- 4. Atomically accept invite (locks couple row, prevents 3rd member & double use)
CREATE OR REPLACE FUNCTION public.accept_couple_invite(p_token TEXT)
RETURNS public.couples
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hash TEXT;
  v_invite public.couple_invites;
  v_couple public.couples;
  v_member_count INT;
  v_joiner_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Daveti kabul etmek için giriş yapmalısınız.';
  END IF;

  IF p_token IS NULL OR char_length(trim(p_token)) < 16 THEN
    RAISE EXCEPTION 'INVALID_INVITE: Geçersiz davet kodu.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.couple_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'ALREADY_IN_COUPLE: Zaten aktif bir çift alanına üyesiniz.';
  END IF;

  v_hash := encode(digest(lower(trim(p_token)), 'sha256'), 'hex');

  SELECT * INTO v_invite
  FROM public.couple_invites
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INVITE: Davet kodu bulunamadı veya geçersiz.';
  END IF;

  IF v_invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE_ALREADY_USED: Bu davet kodu daha önce kullanılmış.';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE_REVOKED: Bu davet kodu iptal edilmiş.';
  END IF;

  IF v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED: Bu davet kodunun süresi dolmuş.';
  END IF;

  -- Lock target couple row so concurrent acceptances cannot admit a 3rd member
  SELECT * INTO v_couple
  FROM public.couples
  WHERE id = v_invite.couple_id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_member_count
  FROM public.couple_members
  WHERE couple_id = v_couple.id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'COUPLE_FULL: Bu çift alanı zaten dolu (en fazla 2 üye).';
  END IF;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_couple.id, v_user_id, 'partner');

  UPDATE public.couple_invites
  SET used_at = NOW(), used_by = v_user_id
  WHERE id = v_invite.id;

  -- Revoke any other lingering unused invites for this couple
  UPDATE public.couple_invites
  SET revoked_at = NOW()
  WHERE couple_id = v_couple.id
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND id <> v_invite.id;

  SELECT display_name INTO v_joiner_name FROM public.profiles WHERE id = v_user_id;
  v_joiner_name := COALESCE(v_joiner_name, 'Partneriniz');

  PERFORM public.notify_partner_event(
    v_couple.id,
    v_user_id,
    'invite_accepted',
    'Partner daveti kabul edildi',
    v_joiner_name || ' ortak çift alanınıza katıldı.'
  );

  RETURN v_couple;
END;
$$;

-- 5. Non-destructive Leave Couple Space (preserves all shared memories for remaining partner)
CREATE OR REPLACE FUNCTION public.leave_couple_space()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  DELETE FROM public.couple_members
  WHERE user_id = v_user_id;
END;
$$;

-- 6. Atomic Storage Quota Reservation (prevents concurrent upload quota bypass)
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

  -- Lock storage_usage row for atomic quota evaluation
  SELECT * INTO v_usage
  FROM public.storage_usage
  WHERE couple_id = v_couple_id
  FOR UPDATE;

  IF v_usage.couple_id IS NULL THEN
    INSERT INTO public.storage_usage (couple_id, used_bytes, quota_bytes)
    VALUES (v_couple_id, 0, 524288000)
    RETURNING * INTO v_usage;
  END IF;

  -- Clean expired reservations first
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
      USING ERRCODE = '53100';
  END IF;

  INSERT INTO public.storage_quota_reservations (couple_id, user_id, reserved_bytes)
  VALUES (v_couple_id, v_user_id, p_bytes)
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;

-- 7. Release quota reservation on failed/cancelled upload
CREATE OR REPLACE FUNCTION public.release_storage_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  DELETE FROM public.storage_quota_reservations
  WHERE id = p_reservation_id
    AND user_id = auth.uid();
END;
$$;

-- 8. Finalize media upload atomically: insert media row + consume quota + delete reservation
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_couple_id UUID;
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

  -- Enforce that storage_path starts with caller's verified couple_id
  IF left(p_storage_path, char_length(v_couple_id::text) + 1) <> (v_couple_id::text || '/') THEN
    RAISE EXCEPTION 'INVALID_STORAGE_PATH: Dosya yolu yetkisiz bir çift alanına işaret ediyor.';
  END IF;

  IF p_thumbnail_path IS NOT NULL AND left(p_thumbnail_path, char_length(v_couple_id::text) + 1) <> (v_couple_id::text || '/') THEN
    RAISE EXCEPTION 'INVALID_THUMBNAIL_PATH';
  END IF;

  -- Lock storage_usage row
  SELECT * INTO v_usage
  FROM public.storage_usage
  WHERE couple_id = v_couple_id
  FOR UPDATE;

  IF p_reservation_id IS NOT NULL THEN
    DELETE FROM public.storage_quota_reservations
    WHERE id = p_reservation_id
      AND couple_id = v_couple_id
      AND user_id = v_user_id;
  END IF;

  IF (v_usage.used_bytes + p_file_size) > v_usage.quota_bytes THEN
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
    p_original_filename, p_mime_type, p_file_size, p_width, p_height, p_duration,
    p_title, p_description, p_memory_date, p_dedup_hash
  )
  RETURNING * INTO v_media;

  UPDATE public.storage_usage
  SET used_bytes = used_bytes + p_file_size
  WHERE couple_id = v_couple_id;

  RETURN v_media;
END;
$$;

-- 9. Delete media record & accurately reclaim quota (returns storage paths for client/server deletion)
CREATE OR REPLACE FUNCTION public.delete_media_and_reclaim_quota(p_media_id UUID)
RETURNS TABLE (
  deleted_media_type TEXT,
  deleted_storage_path TEXT,
  deleted_thumbnail_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_couple_id UUID;
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

  SELECT * INTO v_media
  FROM public.media
  WHERE id = p_media_id
    AND couple_id = v_couple_id
  FOR UPDATE;

  IF v_media.id IS NULL THEN
    RAISE EXCEPTION 'MEDIA_NOT_FOUND_OR_FORBIDDEN';
  END IF;

  -- Clear default track pointer if this audio file was the default entrance track
  UPDATE public.couples
  SET default_track_media_id = NULL
  WHERE id = v_couple_id
    AND default_track_media_id = p_media_id;

  DELETE FROM public.media
  WHERE id = p_media_id
    AND couple_id = v_couple_id;

  UPDATE public.storage_usage
  SET used_bytes = GREATEST(0, used_bytes - v_media.file_size)
  WHERE couple_id = v_couple_id;

  RETURN QUERY SELECT v_media.media_type, v_media.storage_path, v_media.thumbnail_path;
END;
$$;

-- 10. Real server-side storage breakdown by media type
CREATE OR REPLACE FUNCTION public.get_couple_storage_breakdown()
RETURNS TABLE (
  photos_bytes BIGINT,
  videos_bytes BIGINT,
  audio_bytes BIGINT,
  assets_bytes BIGINT,
  total_used_bytes BIGINT,
  quota_bytes BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_couple_id UUID := public.current_user_couple_id();
BEGIN
  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(m.file_size) FILTER (WHERE m.media_type = 'photo'), 0)::BIGINT AS photos_bytes,
    COALESCE(SUM(m.file_size) FILTER (WHERE m.media_type = 'video'), 0)::BIGINT AS videos_bytes,
    COALESCE(SUM(m.file_size) FILTER (WHERE m.media_type = 'audio'), 0)::BIGINT AS audio_bytes,
    COALESCE(SUM(m.file_size) FILTER (WHERE m.media_type = 'book_asset'), 0)::BIGINT AS assets_bytes,
    su.used_bytes AS total_used_bytes,
    su.quota_bytes AS quota_bytes
  FROM public.storage_usage su
  LEFT JOIN public.media m ON m.couple_id = su.couple_id
  WHERE su.couple_id = v_couple_id
  GROUP BY su.used_bytes, su.quota_bytes;
END;
$$;

-- 11. Optimistic Concurrency Save for Memory Pages (prevents silent partner overwrite)
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
        USING ERRCODE = '40001';
    ELSE
      RAISE EXCEPTION 'PAGE_NOT_FOUND_OR_FORBIDDEN';
    END IF;
  END IF;

  RETURN v_page;
END;
$$;

-- 12. RLS-Scoped Cross-Entity Search within active couple space
CREATE OR REPLACE FUNCTION public.search_couple_content(p_query TEXT)
RETURNS TABLE (
  item_type TEXT,
  item_id UUID,
  title TEXT,
  subtitle TEXT,
  item_date TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_couple_id UUID := public.current_user_couple_id();
  v_pattern TEXT := '%' || COALESCE(trim(p_query), '') || '%';
BEGIN
  IF v_couple_id IS NULL OR char_length(trim(COALESCE(p_query, ''))) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'photo'::TEXT, m.id, COALESCE(m.title, m.original_filename, 'Fotoğraf'), COALESCE(m.description, ''), COALESCE(m.memory_date::TEXT, '')
  FROM public.media m
  WHERE m.couple_id = v_couple_id AND m.media_type = 'photo'
    AND (COALESCE(m.title, '') ILIKE v_pattern OR COALESCE(m.description, '') ILIKE v_pattern)
  UNION ALL
  SELECT 'video'::TEXT, m.id, COALESCE(m.title, m.original_filename, 'Video'), COALESCE(m.description, ''), COALESCE(m.memory_date::TEXT, '')
  FROM public.media m
  WHERE m.couple_id = v_couple_id AND m.media_type = 'video'
    AND (COALESCE(m.title, '') ILIKE v_pattern OR COALESCE(m.description, '') ILIKE v_pattern)
  UNION ALL
  SELECT 'audio'::TEXT, m.id, COALESCE(m.title, m.original_filename, 'Şarkı'), COALESCE(m.description, ''), ''
  FROM public.media m
  WHERE m.couple_id = v_couple_id AND m.media_type = 'audio'
    AND (COALESCE(m.title, '') ILIKE v_pattern OR COALESCE(m.description, '') ILIKE v_pattern)
  UNION ALL
  SELECT 'book_page'::TEXT, mp.id, COALESCE(NULLIF(mp.title, ''), 'Anı Sayfası'), left(COALESCE(mp.content, ''), 120), COALESCE(mp.memory_date, '')
  FROM public.memory_pages mp
  WHERE mp.couple_id = v_couple_id
    AND (COALESCE(mp.title, '') ILIKE v_pattern OR COALESCE(mp.content, '') ILIKE v_pattern)
  UNION ALL
  SELECT 'note'::TEXT, n.id, n.title, left(n.content, 120), to_char(n.created_at, 'YYYY-MM-DD')
  FROM public.notes n
  WHERE n.couple_id = v_couple_id
    AND (n.title ILIKE v_pattern OR n.content ILIKE v_pattern)
  LIMIT 40;
END;
$$;

-- Restrict RPC execute privileges strictly to authenticated users
REVOKE ALL ON FUNCTION public.create_couple_space(TEXT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_couple_invite(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_couple_invite(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_couple_invite(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_couple_space() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_storage_quota(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_storage_reservation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_media_upload(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, INT, INT, NUMERIC, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_media_and_reclaim_quota(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_couple_storage_breakdown() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_memory_page_optimistic(UUID, INT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_couple_content(TEXT) FROM PUBLIC;

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


-- ============================================================================

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
