"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

interface UseCoupleRealtimeParams {
  coupleId: string | null;
  realtimeEpoch: string | null;
  userId: string | null;
  onMediaChange: () => void;
  onBookChange: () => void;
  onNotesChange: () => void;
  onDatesChange: () => void;
  onNotificationsChange: () => void;
  onAccountChange: () => void;
}

/**
 * 100% Private-Broadcast-Only Supabase Realtime Synchronization:
 * - Couple channel: `couple:<couple_id>:<realtime_channel_epoch>` (`private: true`)
 *   Authorized strictly by `realtime.messages` SELECT-only RLS (`can_subscribe_couple_broadcast`).
 *   Server triggers emit all INSERT / UPDATE / DELETE invalidations (`couple_change`, `couple_delete`).
 *   When any member leaves, the DB atomically rotates `realtime_channel_epoch`, immediately cutting off
 *   any ex-member's already-open WebSocket from all future couple events.
 * - Personal channel: `user:<user_id>` (`private: true`) for own notifications.
 * - Zero public channels and zero `postgres_changes` subscriptions (100% compatible with
 *   disabling public channel access in Supabase Realtime Settings and Free Plan).
 */
export function useCoupleRealtime({
  coupleId,
  realtimeEpoch,
  userId,
  onMediaChange,
  onBookChange,
  onNotesChange,
  onDatesChange,
  onNotificationsChange,
  onAccountChange,
}: UseCoupleRealtimeParams): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  const callbacksRef = useRef({
    onMediaChange,
    onBookChange,
    onNotesChange,
    onDatesChange,
    onNotificationsChange,
    onAccountChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onMediaChange,
      onBookChange,
      onNotesChange,
      onDatesChange,
      onNotificationsChange,
      onAccountChange,
    };
  });

  useEffect(() => {
    if (!coupleId || !realtimeEpoch || !userId) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    const coupleTopic = `couple:${coupleId}:${realtimeEpoch}`;
    const userTopic = `user:${userId}`;

    let coupleChannel: ReturnType<typeof supabase.channel> | null = null;
    let userChannel: ReturnType<typeof supabase.channel> | null = null;

    const dispatchEntityRefresh = (tableName: string | undefined) => {
      switch (tableName) {
        case "media":
        case "playlists":
        case "playlist_tracks":
        case "storage_usage":
          callbacksRef.current.onMediaChange();
          break;
        case "memory_books":
        case "memory_pages":
        case "memory_page_elements":
          callbacksRef.current.onBookChange();
          break;
        case "notes":
          callbacksRef.current.onNotesChange();
          break;
        case "special_dates":
          callbacksRef.current.onDatesChange();
          break;
        case "couple_members":
        case "couples":
        case "profiles":
          callbacksRef.current.onAccountChange();
          break;
        default:
          callbacksRef.current.onMediaChange();
          callbacksRef.current.onBookChange();
          callbacksRef.current.onNotesChange();
          callbacksRef.current.onDatesChange();
          break;
      }
    };

    const connect = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
      } catch {
        // Proceed with existing session token
      }

      if (cancelled) return;

      // 1. Epoch-scoped private couple Broadcast channel
      coupleChannel = supabase
        .channel(coupleTopic, {
          config: { private: true },
        })
        .on("broadcast", { event: "couple_change" }, (msg) => {
          const tableName =
            typeof msg?.payload?.table === "string"
              ? msg.payload.table
              : undefined;
          dispatchEntityRefresh(tableName);
        })
        .on("broadcast", { event: "couple_delete" }, (msg) => {
          const tableName =
            typeof msg?.payload?.table === "string"
              ? msg.payload.table
              : undefined;
          dispatchEntityRefresh(tableName);
        })
        .on("broadcast", { event: "couple_epoch_rotated" }, () => {
          // Immediately re-verify membership & rotate to new epoch (or disconnect if removed)
          callbacksRef.current.onAccountChange();
        })
        .subscribe((subStatus) => {
          if (cancelled) return;
          if (subStatus === "SUBSCRIBED") {
            setStatus("connected");
          } else if (
            subStatus === "CHANNEL_ERROR" ||
            subStatus === "TIMED_OUT" ||
            subStatus === "CLOSED"
          ) {
            setStatus("disconnected");
          }
        });

      // 2. Personal private Broadcast channel for user notifications
      userChannel = supabase
        .channel(userTopic, {
          config: { private: true },
        })
        .on("broadcast", { event: "user_sync" }, () => {
          callbacksRef.current.onNotificationsChange();
        })
        .subscribe();
    };

    void connect();

    const handleOnline = () => {
      callbacksRef.current.onMediaChange();
      callbacksRef.current.onBookChange();
      callbacksRef.current.onNotesChange();
      callbacksRef.current.onDatesChange();
      callbacksRef.current.onNotificationsChange();
      callbacksRef.current.onAccountChange();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      if (coupleChannel) {
        void supabase.removeChannel(coupleChannel);
      }
      if (userChannel) {
        void supabase.removeChannel(userChannel);
      }
    };
  }, [coupleId, realtimeEpoch, userId]);

  return !coupleId || !realtimeEpoch || !userId ? "disconnected" : status;
}
