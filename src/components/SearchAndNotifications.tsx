"use client";

import React, { useEffect, useState } from "react";
import { Search, Bell, X, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  type NavTab,
  type NotificationItem,
  type SearchResultItem,
} from "@/types";

export function SearchModal({
  isOpen,
  onClose,
  onSelectTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavTab) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("search_couple_content", {
          p_query: trimmed,
        });
        setResults((data || []) as SearchResultItem[]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const visibleResults = query.trim() ? results : [];

  if (!isOpen) return null;

  const mapTypeToTab = (t: SearchResultItem["item_type"]): NavTab => {
    switch (t) {
      case "photo":
        return "fotograflar";
      case "video":
        return "videolar";
      case "audio":
        return "muzik";
      case "book_page":
        return "ani-kitabi";
      case "note":
        return "notlar";
    }
  };

  const mapTypeLabel = (t: SearchResultItem["item_type"]): string => {
    switch (t) {
      case "photo":
        return "Fotoğraf";
      case "video":
        return "Video";
      case "audio":
        return "Müzik";
      case "book_page":
        return "Anı Kitabı";
      case "note":
        return "Not";
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-20 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-[#343438] bg-[#18181B] p-5 text-[#F5F5F7] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[#343438] pb-3.5">
          <Search className="h-4 w-4 text-[#A1A1A6]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fotoğraflar, videolar, kitap sayfaları, müzikler ve notlarda ara..."
            className="flex-1 bg-transparent text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
          {searching ? (
            <p className="py-6 text-center text-[13px] text-[#A1A1A6]">Aranıyor...</p>
          ) : !query.trim() ? (
            <p className="py-6 text-center text-[13px] text-[#A1A1A6]">
              Çift alanınızda arama yapmak için bir kelime yazın.
            </p>
          ) : visibleResults.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#A1A1A6]">
              Sonuç bulunamadı.
            </p>
          ) : (
            visibleResults.map((item) => (
              <button
                key={`${item.item_type}-${item.item_id}`}
                type="button"
                onClick={() => {
                  onSelectTab(mapTypeToTab(item.item_type));
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg bg-[#101012] hover:bg-[#222226] px-3.5 py-2.5 text-left transition-apple cursor-pointer"
              >
                <div className="min-w-0 pr-3">
                  <div className="text-[13px] font-medium text-[#F5F5F7] truncate">
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <p className="text-[12px] text-[#A1A1A6] truncate">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                <span className="text-[11px] font-medium text-[#D88A96] shrink-0">
                  {mapTypeLabel(item.item_type)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onSelectTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onSelectTab: (tab: NavTab) => void;
}) {
  if (!isOpen) return null;

  const targetTabFor = (type: NotificationItem["notification_type"]): NavTab => {
    switch (type) {
      case "photo_added":
        return "fotograflar";
      case "video_added":
        return "videolar";
      case "audio_added":
        return "muzik";
      case "book_updated":
        return "ani-kitabi";
      case "note_added":
        return "notlar";
      default:
        return "biz";
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 pt-16 pr-4 sm:pr-8 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-[#343438] bg-[#18181B] p-4 text-[#F5F5F7] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#343438] pb-3 mb-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <Bell className="h-4 w-4 text-[#D88A96]" />
            <span>Bildirimler</span>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.is_read) && (
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                className="inline-flex items-center gap-1 text-[11px] text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Tümünü Oku</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#A1A1A6]">
              Henüz bildiriminiz bulunmuyor.
            </p>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.is_read) void onMarkRead(item.id);
                  onSelectTab(targetTabFor(item.notification_type));
                  onClose();
                }}
                className={`w-full rounded-lg border p-3 text-left transition-apple cursor-pointer ${
                  item.is_read
                    ? "border-[#343438]/50 bg-[#101012]/60"
                    : "border-[#D88A96]/40 bg-[#101012]"
                }`}
              >
                <div className="flex items-center justify-between text-[13px] font-medium text-[#F5F5F7] mb-1">
                  <span>{item.title}</span>
                  {!item.is_read && (
                    <span className="h-2 w-2 rounded-full bg-[#D88A96]" />
                  )}
                </div>
                <p className="text-[12px] text-[#A1A1A6] leading-relaxed">
                  {item.message}
                </p>
                <span className="mt-1.5 block text-[10px] text-[#A1A1A6]/70">
                  {new Date(item.created_at).toLocaleString("tr-TR")}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
