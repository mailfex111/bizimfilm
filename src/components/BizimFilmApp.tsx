"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WifiOff, AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { createClient } from "@/lib/supabase/client";
import { useCoupleRealtime } from "@/lib/realtime";
import {
  type MediaItem,
  type MemoryBook,
  type MemoryPage,
  type MemoryPageElement,
  type NavTab,
  type NoteItem,
  type NotificationItem,
  type Playlist,
  type SpecialDateItem,
} from "@/types";
import LoginView from "@/components/LoginView";
import RecoveryCodesScreen from "@/components/RecoveryCodesScreen";
import CoupleOnboardingView from "@/components/CoupleOnboardingView";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HomeSections from "@/components/HomeSections";
import VideosView from "@/components/VideosView";
import MusicView from "@/components/MusicView";
import SpecialDatesView from "@/components/SpecialDatesView";
import NotesView from "@/components/NotesView";
import CoupleProfileView from "@/components/CoupleProfileView";
import {
  NotificationsModal,
  SearchModal,
} from "@/components/SearchAndNotifications";
import MusicPlayerBar from "@/components/MusicPlayerBar";
import SettingsModal from "@/components/SettingsModal";

const MemoryBookSection = dynamic(() => import("@/components/MemoryBookSection"), {
  ssr: false,
});
const PhotosView = dynamic(() => import("@/components/PhotosView"), {
  ssr: false,
});

export default function BizimFilmApp() {
  const {
    user,
    profile,
    couple,
    preferences,
    isLoading,
    schemaError,
    pendingRecoveryCodes,
    clearPendingRecoveryCodes,
    refreshAccount,
    refreshStorage,
    signOut,
  } = useAuth();
  const { setQueueTracks } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<NavTab>("ana-sayfa");
  const [isOffline, setIsOffline] = useState(false);

  // Real Supabase-backed couple state
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [tracks, setTracks] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [books, setBooks] = useState<MemoryBook[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [pages, setPages] = useState<MemoryPage[]>([]);
  const [specialDates, setSpecialDates] = useState<SpecialDateItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Modals & triggers
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoOpenPhotoUpload, setAutoOpenPhotoUpload] = useState(false);

  useEffect(() => {
    const updateNet = () => setIsOffline(!navigator.onLine);
    updateNet();
    window.addEventListener("online", updateNet);
    window.addEventListener("offline", updateNet);
    return () => {
      window.removeEventListener("online", updateNet);
      window.removeEventListener("offline", updateNet);
    };
  }, []);

  const loadMedia = useCallback(async () => {
    if (!couple) return;
    const supabase = createClient();
    const [mediaRes, playlistsRes, tracksOrderRes] = await Promise.all([
      supabase
        .from("media")
        .select(
          "id, couple_id, uploaded_by, media_type, storage_path, thumbnail_path, original_filename, mime_type, file_size, width, height, duration, title, description, memory_date, created_at"
        )
        .eq("couple_id", couple.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("playlists")
        .select("id, couple_id, title, is_default, created_at")
        .eq("couple_id", couple.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("playlist_tracks")
        .select("media_id, track_order")
        .eq("couple_id", couple.id)
        .order("track_order", { ascending: true }),
    ]);

    const all = (mediaRes.data || []) as MediaItem[];
    setPhotos(all.filter((m) => m.media_type === "photo"));
    setVideos(all.filter((m) => m.media_type === "video"));

    const audioList = all.filter((m) => m.media_type === "audio");
    const orderMap = new Map<string, number>(
      (tracksOrderRes.data || []).map((row) => [
        row.media_id as string,
        row.track_order as number,
      ])
    );
    const orderedAudio = [...audioList].sort((a, b) => {
      const oa = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const ob = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return oa - ob;
    });

    setTracks(orderedAudio);
    setPlaylists((playlistsRes.data || []) as Playlist[]);
    setQueueTracks(orderedAudio, couple.default_track_media_id);
  }, [couple, setQueueTracks]);

  const lastOpenBookId = preferences?.last_open_book_id ?? null;

  const loadBooks = useCallback(async () => {
    if (!couple) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("memory_books")
      .select("id, couple_id, title, description, cover_media_id, created_by, created_at, updated_at")
      .eq("couple_id", couple.id)
      .order("created_at", { ascending: true });

    const list = (data || []) as MemoryBook[];
    setBooks(list);

    setActiveBookId((prev) => {
      if (prev && list.some((b) => b.id === prev)) return prev;
      if (lastOpenBookId && list.some((b) => b.id === lastOpenBookId)) {
        return lastOpenBookId;
      }
      return list[0]?.id || null;
    });
  }, [couple, lastOpenBookId]);

  const loadPages = useCallback(async () => {
    if (!couple || !activeBookId) {
      setPages([]);
      return;
    }
    const supabase = createClient();
    const [pagesRes, elementsRes] = await Promise.all([
      supabase
        .from("memory_pages")
        .select(
          "id, book_id, couple_id, page_order, title, content, memory_date, layout_type, version, created_by, created_at, updated_at"
        )
        .eq("book_id", activeBookId)
        .order("page_order", { ascending: true }),
      supabase
        .from("memory_page_elements")
        .select(
          "id, page_id, couple_id, element_type, media_id, text_content, position_x, position_y, width, height, rotation, layer_order, style, created_at, updated_at"
        )
        .eq("couple_id", couple.id)
        .order("layer_order", { ascending: true }),
    ]);

    const rawPages = (pagesRes.data || []) as MemoryPage[];
    const rawEls = (elementsRes.data || []) as MemoryPageElement[];
    const elsByPage = new Map<string, MemoryPageElement[]>();
    for (const el of rawEls) {
      const arr = elsByPage.get(el.page_id) || [];
      arr.push(el);
      elsByPage.set(el.page_id, arr);
    }

    setPages(
      rawPages.map((p) => ({
        ...p,
        elements: elsByPage.get(p.id) || [],
      }))
    );
  }, [couple, activeBookId]);

  const loadDates = useCallback(async () => {
    if (!couple) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("special_dates")
      .select(
        "id, couple_id, category, title, description, event_date, repeat_yearly, created_by, created_at"
      )
      .eq("couple_id", couple.id)
      .order("event_date", { ascending: true });
    setSpecialDates((data || []) as SpecialDateItem[]);
  }, [couple]);

  const loadNotes = useCallback(async () => {
    if (!couple) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("notes")
      .select("id, couple_id, created_by, title, content, note_type, created_at, updated_at")
      .eq("couple_id", couple.id)
      .order("created_at", { ascending: false });
    setNotes((data || []) as NoteItem[]);
  }, [couple]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, couple_id, user_id, notification_type, title, message, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications((data || []) as NotificationItem[]);
  }, [user]);

  const loadAllCoupleData = useCallback(async () => {
    await Promise.all([
      loadMedia(),
      loadBooks(),
      loadDates(),
      loadNotes(),
      loadNotifications(),
      refreshStorage(),
    ]);
  }, [loadMedia, loadBooks, loadDates, loadNotes, loadNotifications, refreshStorage]);

  useEffect(() => {
    if (!couple) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadAllCoupleData();
    });
    return () => {
      active = false;
    };
  }, [couple, loadAllCoupleData]);

  useEffect(() => {
    if (!couple || !activeBookId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadPages();
    });
    return () => {
      active = false;
    };
  }, [couple, activeBookId, loadPages]);

  // Scoped Private-Broadcast-Only Realtime Synchronization between partners
  const realtimeStatus = useCoupleRealtime({
    coupleId: couple?.id || null,
    realtimeEpoch: couple?.realtime_channel_epoch || null,
    userId: user?.id || null,
    onMediaChange: () => {
      void loadMedia();
      void refreshStorage();
    },
    onBookChange: () => {
      void loadBooks();
      void loadPages();
    },
    onNotesChange: () => void loadNotes(),
    onDatesChange: () => void loadDates(),
    onNotificationsChange: () => void loadNotifications(),
    onAccountChange: () => void refreshAccount(),
  });

  const handleAddMediaToBook = async (media: MediaItem) => {
    if (!couple || !activeBookId) return;
    const supabase = createClient();
    const formattedDate = media.memory_date
      ? new Date(media.memory_date).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : new Date().toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

    const { data: insertedPage } = await supabase
      .from("memory_pages")
      .insert({
        book_id: activeBookId,
        couple_id: couple.id,
        page_order: pages.length,
        title: media.title || (media.media_type === "video" ? "Video Anısı" : "Yeni Anımız"),
        content: media.description || "",
        memory_date: formattedDate,
        layout_type: media.media_type === "video" ? "video-note" : "photo-text",
        created_by: user?.id || null,
      })
      .select("id")
      .single();

    if (insertedPage?.id) {
      await supabase.from("memory_page_elements").insert({
        page_id: insertedPage.id,
        couple_id: couple.id,
        element_type: media.media_type === "video" ? "video" : "photo",
        media_id: media.id,
        layer_order: 0,
      });
    }

    await loadPages();
    setActiveTab("ani-kitabi");
  };

  const handleMarkNotificationRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    await loadNotifications();
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    await loadNotifications();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#101012] flex items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#D88A96] border-t-transparent" />
      </div>
    );
  }

  // Unauthenticated -> Real Supabase Login / Signup / Recovery View
  if (!user) {
    return <LoginView />;
  }

  // Newly registered user -> Show single-use recovery codes ONCE before onboarding
  if (pendingRecoveryCodes && pendingRecoveryCodes.length > 0) {
    return (
      <RecoveryCodesScreen
        codes={pendingRecoveryCodes}
        username={profile?.username || ""}
        onConfirm={clearPendingRecoveryCodes}
      />
    );
  }

  // Authenticated but SQL migration not yet run on Supabase
  if (schemaError) {
    return (
      <div className="min-h-screen w-full bg-[#101012] text-[#F5F5F7] flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-[#343438] bg-[#18181B] p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-[#D88A96]">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-[18px] font-semibold">
              Veritabanı Kurulumu Gerekli
            </h1>
          </div>
          <p className="text-[14px] text-[#A1A1A6] leading-relaxed">{schemaError}</p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void refreshAccount()}
              className="rounded-lg bg-[#F5F5F7] px-4 py-2 text-[13px] font-medium text-[#101012] cursor-pointer"
            >
              Tekrar Kontrol Et
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] px-4 py-2 text-[13px] text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated without an active Couple Space -> Onboarding (Create or Join via Invite)
  if (!couple) {
    return <CoupleOnboardingView />;
  }

  const activeBook = books.find((b) => b.id === activeBookId) || books[0] || null;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const openPhotoUpload = () => {
    setActiveTab("fotograflar");
    setAutoOpenPhotoUpload(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F5F7] flex flex-col">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenSettingsModal={() => setSettingsOpen(true)}
        unreadNotificationsCount={unreadCount}
        realtimeConnected={realtimeStatus === "connected"}
      />

      {isOffline && (
        <div className="bg-[#18181B] border-b border-[#D88A96]/40 px-4 py-2 text-center text-[12px] text-[#F5F5F7] flex items-center justify-center gap-2">
          <WifiOff className="h-3.5 w-3.5 text-[#D88A96]" />
          <span>İnternet bağlantısı kesildi. Bağlantı geri geldiğinde verileriniz eşitlenecek.</span>
        </div>
      )}

      <main className="flex-1">
        {activeTab === "ana-sayfa" && (
          <>
            <HeroSection
              onOpenMemoryBook={() => setActiveTab("ani-kitabi")}
              onAddMemory={openPhotoUpload}
            />
            <MemoryBookSection
              coupleId={couple.id}
              books={books}
              activeBook={activeBook}
              pages={pages}
              photos={photos}
              videos={videos}
              isFullPageView={false}
              onSelectBook={setActiveBookId}
              onBooksChange={loadBooks}
              onPagesChange={loadPages}
              onMediaChange={loadMedia}
              onOpenPhotoUploadModal={openPhotoUpload}
            />
            <HomeSections
              photos={photos}
              videos={videos}
              tracks={tracks}
              specialDates={specialDates}
              onSelectTab={setActiveTab}
              onOpenPhotoUpload={openPhotoUpload}
            />
          </>
        )}

        {activeTab === "ani-kitabi" && (
          <MemoryBookSection
            coupleId={couple.id}
            books={books}
            activeBook={activeBook}
            pages={pages}
            photos={photos}
            videos={videos}
            isFullPageView={true}
            onSelectBook={setActiveBookId}
            onBooksChange={loadBooks}
            onPagesChange={loadPages}
            onMediaChange={loadMedia}
            onOpenPhotoUploadModal={openPhotoUpload}
          />
        )}

        {activeTab === "fotograflar" && (
          <PhotosView
            coupleId={couple.id}
            photos={photos}
            activeBook={activeBook}
            autoOpenUpload={autoOpenPhotoUpload}
            onClearAutoOpen={() => setAutoOpenPhotoUpload(false)}
            onPhotosChange={loadMedia}
            onAddPhotoToBook={handleAddMediaToBook}
          />
        )}

        {activeTab === "videolar" && (
          <VideosView
            coupleId={couple.id}
            videos={videos}
            onVideosChange={loadMedia}
            onAddVideoToBook={handleAddMediaToBook}
          />
        )}

        {activeTab === "muzik" && (
          <MusicView
            coupleId={couple.id}
            tracks={tracks}
            playlists={playlists}
            onTracksChange={loadMedia}
          />
        )}

        {activeTab === "ozel-gunler" && (
          <SpecialDatesView
            coupleId={couple.id}
            dates={specialDates}
            onDatesChange={loadDates}
          />
        )}

        {activeTab === "notlar" && (
          <NotesView
            coupleId={couple.id}
            notes={notes}
            onNotesChange={loadNotes}
          />
        )}

        {activeTab === "biz" && (
          <CoupleProfileView
            photosCount={photos.length}
            videosCount={videos.length}
            tracksCount={tracks.length}
            pagesCount={pages.length}
            onSelectTab={setActiveTab}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </main>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectTab={setActiveTab}
      />

      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onSelectTab={setActiveTab}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeBookId={activeBook?.id || null}
        onDataChanged={loadAllCoupleData}
      />

      <MusicPlayerBar onSelectTab={setActiveTab} />
    </div>
  );
}
