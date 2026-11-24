"use client";

import { useEffect, useState } from "react";
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
 * and own user_id, with automatic cleanup on unmount and reconnect resync.
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

  useEffect(() => {
    if (!coupleId || !userId) {
      return;
    }

    const supabase = createClient();
    const channelName = `miora-couple-${coupleId}-${userId.slice(0, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => onMediaChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memory_books",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => onBookChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memory_pages",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => onBookChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memory_page_elements",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => onBookChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => onNotesChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "special_dates",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => onDatesChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => onNotificationsChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_members",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => onAccountChange()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "couples",
          filter: `id=eq.${coupleId}`,
        },
        () => onAccountChange()
      )
      .subscribe((subStatus) => {
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

    const handleOnline = () => {
      onMediaChange();
      onBookChange();
      onNotesChange();
      onDatesChange();
      onNotificationsChange();
      onAccountChange();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      void supabase.removeChannel(channel);
    };
  }, [
    coupleId,
    userId,
    onMediaChange,
    onBookChange,
    onNotesChange,
    onDatesChange,
    onNotificationsChange,
    onAccountChange,
  ]);

  return !coupleId || !userId ? "disconnected" : status;
}
