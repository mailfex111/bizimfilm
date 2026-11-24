-- ============================================================================
-- Miora Migration 008 (Optional UX Enhancement): Live Profile & Storage Broadcast
-- ============================================================================
-- Broadcasts partner profile updates (display_name, username, avatar_path) and
-- direct storage_usage updates onto the couple's authorized private epoch channel.
-- Also ensures column-level immutability of couples.realtime_channel_epoch.
-- ============================================================================

REVOKE UPDATE (realtime_channel_epoch) ON public.couples FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_broadcast_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime, pg_temp
AS $$
DECLARE
  v_couple_id UUID;
  v_epoch UUID;
BEGIN
  SELECT cm.couple_id, c.realtime_channel_epoch
  INTO v_couple_id, v_epoch
  FROM public.couple_members cm
  JOIN public.couples c ON c.id = cm.couple_id
  WHERE cm.user_id = NEW.id
  LIMIT 1;

  IF v_couple_id IS NULL OR v_epoch IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'table', 'profiles',
        'action', 'UPDATE',
        'id', NEW.id
      ),
      'couple_change',
      'couple:' || v_couple_id::TEXT || ':' || v_epoch::TEXT,
      TRUE
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_broadcast_profile_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_broadcast_change ON public.profiles;
CREATE TRIGGER trg_profiles_broadcast_change
  AFTER UPDATE OF display_name, username, avatar_path ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_profile_change();

DROP TRIGGER IF EXISTS trg_storage_usage_broadcast_change ON public.storage_usage;
CREATE TRIGGER trg_storage_usage_broadcast_change
  AFTER UPDATE OF used_bytes, quota_bytes ON public.storage_usage
  FOR EACH ROW EXECUTE FUNCTION public.trg_broadcast_couple_change();
