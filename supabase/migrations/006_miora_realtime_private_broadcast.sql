-- ============================================================================
-- Miora Migration 006: Realtime Private Broadcast Authorization for DELETE Sync
-- ============================================================================
-- Implements Supabase Realtime Authorization (realtime.messages RLS) +
-- server-side AFTER DELETE triggers using private Broadcast channels
-- (`couple:<couple_uuid>` with private=true) so DELETE synchronization does
-- NOT rely solely on REPLICA IDENTITY FULL and strictly isolates couples.
-- 100% compatible with Supabase Free Plan.
-- ============================================================================

-- 1. Realtime Authorization Policies on realtime.messages (Private Broadcast SELECT Only)
-- Client-side INSERT is intentionally omitted/dropped so clients cannot forge
-- couple_delete broadcasts; only server-side AFTER DELETE triggers emit events.
DROP POLICY IF EXISTS "couple_broadcast_select_member" ON realtime.messages;
CREATE POLICY "couple_broadcast_select_member"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND split_part(realtime.topic(), ':', 1) = 'couple'
    AND public.is_couple_member(public.try_parse_uuid(split_part(realtime.topic(), ':', 2)))
  );

DROP POLICY IF EXISTS "couple_broadcast_insert_member" ON realtime.messages;

-- 2. Server-Side AFTER DELETE Private Broadcast Trigger Function
-- Emits minimal non-sensitive invalidation payload to private topic `couple:<couple_id>`
CREATE OR REPLACE FUNCTION public.trg_broadcast_couple_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime, pg_temp
AS $$
BEGIN
  IF OLD.couple_id IS NULL THEN
    RETURN OLD;
  END IF;

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'action', 'DELETE',
        'id', OLD.id
      ),
      'couple_delete',
      'couple:' || OLD.couple_id::TEXT,
      TRUE
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block legitimate data deletion if Realtime broadcast partition is unavailable
    NULL;
  END;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_broadcast_couple_delete() FROM PUBLIC, anon, authenticated;

-- 3. Attach AFTER DELETE Triggers to All Couple-Scoped Tables
DROP TRIGGER IF EXISTS trg_media_broadcast_delete ON public.media;
CREATE TRIGGER trg_media_broadcast_delete
  AFTER DELETE ON public.media
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_memory_books_broadcast_delete ON public.memory_books;
CREATE TRIGGER trg_memory_books_broadcast_delete
  AFTER DELETE ON public.memory_books
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_memory_pages_broadcast_delete ON public.memory_pages;
CREATE TRIGGER trg_memory_pages_broadcast_delete
  AFTER DELETE ON public.memory_pages
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_memory_page_elements_broadcast_delete ON public.memory_page_elements;
CREATE TRIGGER trg_memory_page_elements_broadcast_delete
  AFTER DELETE ON public.memory_page_elements
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_notes_broadcast_delete ON public.notes;
CREATE TRIGGER trg_notes_broadcast_delete
  AFTER DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_special_dates_broadcast_delete ON public.special_dates;
CREATE TRIGGER trg_special_dates_broadcast_delete
  AFTER DELETE ON public.special_dates
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_playlists_broadcast_delete ON public.playlists;
CREATE TRIGGER trg_playlists_broadcast_delete
  AFTER DELETE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_playlist_tracks_broadcast_delete ON public.playlist_tracks;
CREATE TRIGGER trg_playlist_tracks_broadcast_delete
  AFTER DELETE ON public.playlist_tracks
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();

DROP TRIGGER IF EXISTS trg_couple_members_broadcast_delete ON public.couple_members;
CREATE TRIGGER trg_couple_members_broadcast_delete
  AFTER DELETE ON public.couple_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_delete();
