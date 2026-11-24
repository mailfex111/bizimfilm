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
 * Scoped Supabase Realtime subscription filtered strictly by verified couple_id
 * and own user_id, with stable ref callbacks (prevents WebSocket churn on re-render),
 * explicit JWT auth sync, automatic cleanup on unmount, and online reconnect resync.
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
    const channelName = `miora-couple-${coupleId}-${userId.slice(0, 8)}`;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

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

      activeChannel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "media",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onMediaChange()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memory_books",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memory_pages",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memory_page_elements",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onBookChange()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notes",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => callbacksRef.current.onNotesChange()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
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
            event: "*",
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
      if (activeChannel) {
        void supabase.removeChannel(activeChannel);
      }
    };
  }, [coupleId, userId]);

  return !coupleId || !userId ? "disconnected" : status;
}
