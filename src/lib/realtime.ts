"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

interface UseCoupleRealtimeParams {
  coupleId: string | null;
  userId: string | null;
  onMediaChange: () => void;
  onBookChange: () => void;
  onNotesChange: () => void;
  onDatesChange: () => void;
  onNotificationsChange: () => void;
  onAccountChange: () => void;
}

/**
 * Dual-channel couple-scoped Supabase Realtime synchronization:
 * 1. Authorized PRIVATE Broadcast channel (`couple:<couple_id>`, `private: true`)
 *    enforced by `realtime.messages` RLS (`is_couple_member`) for secure DELETE
 *    and invalidation synchronization without relying solely on REPLICA IDENTITY FULL.
 * 2. Scoped `postgres_changes` channel filtered by verified `couple_id` / `user_id`
 *    for live INSERT & UPDATE synchronization.
 */
export function useCoupleRealtime({
  coupleId,
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
    if (!coupleId || !userId) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    const pgChannelName = `miora-pg-${coupleId}-${userId.slice(0, 8)}`;
    const privateBroadcastTopic = `couple:${coupleId}`;

    let pgChannel: ReturnType<typeof supabase.channel> | null = null;
    let privateChannel: ReturnType<typeof supabase.channel> | null = null;

    const dispatchEntityRefresh = (tableName: string | undefined) => {
      switch (tableName) {
        case "media":
        case "playlists":
        case "playlist_tracks":
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

      // 1. Private authorized Broadcast channel for secure DELETE synchronization
      privateChannel = supabase
        .channel(privateBroadcastTopic, {
          config: { private: true },
        })
        .on("broadcast", { event: "couple_delete" }, (msg) => {
          const tableName =
            typeof msg?.payload?.table === "string"
              ? msg.payload.table
              : undefined;
          dispatchEntityRefresh(tableName);
        })
        .on("broadcast", { event: "couple_sync" }, (msg) => {
          const tableName =
            typeof msg?.payload?.table === "string"
              ? msg.payload.table
              : undefined;
          dispatchEntityRefresh(tableName);
        })
        .subscribe();

      // 2. Scoped postgres_changes channel for live INSERT / UPDATE events
      pgChannel = supabase
        .channel(pgChannelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "media",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onMediaChange()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "media",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onMediaChange()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "memory_books",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "memory_books",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "memory_pages",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "memory_pages",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "memory_page_elements",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "memory_page_elements",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notes",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onNotesChange()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notes",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onNotesChange()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "special_dates",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onDatesChange()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "special_dates",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onDatesChange()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => callbacksRef.current.onNotificationsChange()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "couple_members",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onAccountChange()
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "couples",
            filter: `id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onAccountChange()
        )
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
      if (privateChannel) {
        void supabase.removeChannel(privateChannel);
      }
      if (pgChannel) {
        void supabase.removeChannel(pgChannel);
      }
    };
  }, [coupleId, userId]);

  return !coupleId || !userId ? "disconnected" : status;
}
