"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import HTMLFlipBookBase from "react-pageflip";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Image as ImageIcon,
  Edit3,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Upload,
  Check,
  X,
  Play,
  Layers,
  BookOpen,
  AlertTriangle,
  WifiOff,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  getSignedUrl,
  getSignedUrlsBatch,
  uploadCoupleMedia,
} from "@/lib/storage";
import {
  type BookLayoutType,
  type MediaItem,
  type MemoryBook,
  type MemoryPage,
  type MemoryPageElement,
} from "@/types";

const HTMLFlipBook =
  HTMLFlipBookBase as unknown as React.ComponentType<Record<string, unknown>>;

interface MemoryBookSectionProps {
  coupleId: string;
  books: MemoryBook[];
  activeBook: MemoryBook | null;
  pages: MemoryPage[];
  photos: MediaItem[];
  videos: MediaItem[];
  isFullPageView?: boolean;
  onSelectBook: (bookId: string) => void;
  onBooksChange: () => Promise<void>;
  onPagesChange: () => Promise<void>;
  onMediaChange: () => Promise<void>;
  onOpenPhotoUploadModal: () => void;
}

const LAYOUT_OPTIONS: { id: BookLayoutType; label: string }[] = [
  { id: "photo-text", label: "Fotoğraf ve Metin" },
  { id: "single-photo", label: "Tek Büyük Fotoğraf" },
  { id: "two-photos", label: "İki Fotoğraf" },
  { id: "polaroid", label: "Polaroid Düzeni" },
  { id: "full-text", label: "Tam Sayfa Metin" },
  { id: "video-note", label: "Video ve Açıklama" },
  { id: "minimal-collage", label: "Minimal Kolaj" },
];

type SaveState = "idle" | "saving" | "saved" | "offline" | "error" | "conflict";

interface BookPageSheetProps {
  page: MemoryPage;
  pageNumber: number;
  isLeftPage: boolean;
  mediaById: Map<string, MediaItem>;
  signedUrls: Record<string, string>;
  onEditPage: (page: MemoryPage) => void;
  onPlayVideo: (media: MediaItem) => void;
}

const BookPageSheet = React.forwardRef<HTMLDivElement, BookPageSheetProps>(
  function BookPageSheet(
    { page, pageNumber, isLeftPage, mediaById, signedUrls, onEditPage, onPlayVideo },
    ref
  ) {
    const formattedPageNum = String(pageNumber).padStart(2, "0");
    const elements = [...(page.elements || [])].sort(
      (a, b) => a.layer_order - b.layer_order
    );

    const mediaElements = elements.filter(
      (el) => (el.element_type === "photo" || el.element_type === "video") && el.media_id
    );
    const primaryEl = mediaElements[0] || null;
    const secondaryEl = mediaElements[1] || null;

    const resolveMediaVisual = (el: MemoryPageElement | null) => {
      if (!el?.media_id) return { media: null, url: null };
      const m = mediaById.get(el.media_id) || null;
      if (!m) return { media: null, url: null };
      const url =
        (m.thumbnail_path && signedUrls[m.thumbnail_path]) ||
        signedUrls[m.storage_path] ||
        null;
      return { media: m, url };
    };

    const primary = resolveMediaVisual(primaryEl);
    const secondary = resolveMediaVisual(secondaryEl);

    const primaryObjPos = primaryEl
      ? `${50 + Number(primaryEl.position_x || 0)}% ${50 + Number(primaryEl.position_y || 0)}%`
      : "50% 50%";
    const primaryScale = primaryEl
      ? Math.max(0.7, Math.min(1.4, Number(primaryEl.width || 100) / 100))
      : 1;

    return (
      <div
        ref={ref}
        className={`relative h-full w-full select-none overflow-hidden bg-[#F3EFEA] text-[#221F1D] ${
          isLeftPage
            ? "rounded-l-[4px] border-r border-[#DFD8CE]"
            : "rounded-r-[4px] border-l border-[#E6DFD6]"
        }`}
      >
        {/* Subtle Natural Spine Shadow */}
        <div
          className={`pointer-events-none absolute inset-y-0 w-12 z-10 ${
            isLeftPage
              ? "right-0 bg-gradient-to-l from-[#1C1917]/[0.09] via-[#1C1917]/[0.03] to-transparent"
              : "left-0 bg-gradient-to-r from-[#1C1917]/[0.11] via-[#1C1917]/[0.03] to-transparent"
          }`}
        />

        {/* Subtle Apple Pages-Style Edit Trigger */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditPage(page);
          }}
          title="Sayfayı düzenle"
          className={`absolute top-3 z-30 inline-flex items-center gap-1 rounded-md border border-[#D6CEC2] bg-[#FAF8F5]/90 hover:bg-[#221F1D] px-2 py-0.5 text-[10px] font-medium text-[#57524E] hover:text-[#F5F5F7] hover:border-[#221F1D] transition-apple cursor-pointer ${
            isLeftPage ? "left-3.5" : "right-3.5"
          }`}
        >
          <Edit3 className="h-2.5 w-2.5" />
          <span>Düzenle</span>
        </button>

        {/* Layout 1: Full Text Editorial Page */}
        {page.layout_type === "full-text" ? (
          <div className="relative h-full w-full flex flex-col justify-center px-7 sm:px-10 py-10">
            {page.memory_date && (
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#78716A] mb-2">
                {page.memory_date}
              </span>
            )}
            <h3 className="font-editorial text-[22px] sm:text-[26px] font-medium text-[#1C1917] leading-tight">
              {page.title || `Sayfa ${formattedPageNum}`}
            </h3>
            <div className="my-3 h-px w-10 bg-[#D4CBC0]" />
            <p className="text-[13px] sm:text-[14px] leading-[1.7] text-[#3F3A35] whitespace-pre-line line-clamp-7">
              {page.content || "Hikâyenizi yazmak için Düzenle butonuna tıklayın."}
            </p>
          </div>
        ) : page.layout_type === "single-photo" ? (
          /* Layout 2: Single Large Framed Photo */
          <div className="relative h-full w-full flex flex-col justify-between px-6 sm:px-8 pt-10 pb-8">
            <div className="flex-1 min-h-0 rounded-[2px] bg-[#FAF8F5] p-2 shadow-[0_6px_18px_rgba(24,20,18,0.08)] border border-[#E4DDD3] flex items-center justify-center overflow-hidden">
              {primary.url ? (
                <img
                  src={primary.url}
                  alt={page.title || "Anı"}
                  style={{
                    objectPosition: primaryObjPos,
                    transform: `scale(${primaryScale})`,
                  }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[12px] text-[#78716A]">Fotoğraf seçilmedi</span>
              )}
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-3">
              <span className="font-editorial text-[15px] text-[#1C1917] truncate">
                {page.title}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#78716A] shrink-0">
                {page.memory_date}
              </span>
            </div>
          </div>
        ) : page.layout_type === "two-photos" || page.layout_type === "minimal-collage" ? (
          /* Layout 3 & 4: Two Photos / Minimal Collage */
          <div className="relative h-full w-full flex flex-col justify-between px-6 sm:px-8 pt-10 pb-8">
            <div className="grid grid-cols-12 gap-3 items-center my-auto">
              <div
                className={`${
                  page.layout_type === "minimal-collage" ? "col-span-7" : "col-span-6"
                } rounded-[2px] bg-[#FAF8F5] p-1.5 shadow-[0_4px_14px_rgba(24,20,18,0.08)] border border-[#E4DDD3]`}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#18181B]">
                  {primary.url ? (
                    <img
                      src={primary.url}
                      alt={page.title || "Fotoğraf 1"}
                      style={{
                        objectPosition: primaryObjPos,
                        transform: `scale(${primaryScale})`,
                      }}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[11px] text-[#A1A1A6]">
                      1. Görsel
                    </div>
                  )}
                </div>
              </div>
              <div
                className={`${
                  page.layout_type === "minimal-collage" ? "col-span-5" : "col-span-6"
                } rounded-[2px] bg-[#FAF8F5] p-1.5 shadow-[0_4px_14px_rgba(24,20,18,0.08)] border border-[#E4DDD3]`}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#18181B]">
                  {secondary.url ? (
                    <img
                      src={secondary.url}
                      alt={page.title || "Fotoğraf 2"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[11px] text-[#A1A1A6]">
                      2. Görsel
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2DBD0] flex items-baseline justify-between gap-3">
              <p className="font-editorial italic text-[13px] text-[#2C2825] truncate">
                {page.content || page.title}
              </p>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#78716A] shrink-0">
                {page.memory_date}
              </span>
            </div>
          </div>
        ) : page.layout_type === "polaroid" ? (
          /* Layout 5: Editorial Polaroid Frame */
          <div className="relative h-full w-full flex flex-col sm:flex-row items-center justify-center gap-5 px-6 sm:px-8 pt-10 pb-8">
            <div className="w-[54%] rounded-[2px] bg-[#FAF8F5] p-2 pb-6 shadow-[0_8px_22px_rgba(24,20,18,0.1)] border border-[#E4DDD3]">
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#18181B]">
                {primary.url ? (
                  <img
                    src={primary.url}
                    alt={page.title || "Polaroid"}
                    style={{
                      objectPosition: primaryObjPos,
                      transform: `scale(${primaryScale})`,
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[11px] text-[#A1A1A6]">
                    Fotoğraf
                  </div>
                )}
              </div>
              <div className="mt-2 text-center font-editorial italic text-[12px] text-[#4A443F] truncate">
                {page.memory_date || page.title}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-editorial text-[19px] font-medium text-[#1C1917] leading-tight">
                {page.title}
              </h3>
              <p className="mt-2 text-[12px] leading-[1.6] text-[#4A443F] line-clamp-5">
                {page.content}
              </p>
            </div>
          </div>
        ) : page.layout_type === "video-note" ? (
          /* Layout 6: Video & Note */
          <div className="relative h-full w-full flex flex-col justify-between px-6 sm:px-8 pt-10 pb-8">
            <div className="rounded-[2px] bg-[#FAF8F5] p-1.5 shadow-[0_6px_18px_rgba(24,20,18,0.08)] border border-[#E4DDD3]">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (primary.media && primary.media.media_type === "video") {
                    onPlayVideo(primary.media);
                  }
                }}
                className="relative aspect-video w-full overflow-hidden bg-[#18181B] cursor-pointer"
              >
                {primary.url && (
                  <img
                    src={primary.url}
                    alt={page.title || "Video"}
                    className="h-full w-full object-cover opacity-90"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#101012]/80 border border-white/25 text-white">
                    <Play className="h-4 w-4 fill-white ml-0.5" />
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-editorial text-[16px] font-medium text-[#1C1917] truncate">
                  {page.title || "Video Anısı"}
                </h3>
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#78716A] shrink-0">
                  {page.memory_date}
                </span>
              </div>
              {page.content && (
                <p className="mt-1 text-[12px] text-[#4A443F] line-clamp-2">
                  {page.content}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Layout 7 (Default): Editorial Photo + Text Spread */
          <div className="relative h-full w-full flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-6 justify-between sm:items-center px-5 sm:px-8 pt-10 pb-8">
            <div
              className={`sm:col-span-5 flex flex-col justify-center ${
                isLeftPage ? "sm:order-1" : "sm:order-2"
              }`}
            >
              {page.memory_date && (
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#78716A] mb-1.5">
                  {page.memory_date}
                </span>
              )}
              <h3 className="font-editorial text-[18px] sm:text-[22px] font-medium tracking-[-0.015em] leading-[1.16] text-[#1C1917]">
                {page.title || `Sayfa ${formattedPageNum}`}
              </h3>
              <div className="hidden sm:block my-2.5 h-px w-8 bg-[#D4CBC0]" />
              <p className="mt-1.5 sm:mt-0 text-[12px] sm:text-[13px] leading-[1.55] text-[#4A443F] line-clamp-3 sm:line-clamp-4">
                {page.content}
              </p>
            </div>

            <div
              className={`sm:col-span-7 my-auto ${
                isLeftPage ? "sm:order-2" : "sm:order-1"
              }`}
            >
              <div className="rounded-[2px] bg-[#FAF8F5] p-1.5 sm:p-2 shadow-[0_6px_20px_rgba(24,20,18,0.08)] border border-[#E4DDD3]">
                {primary.url ? (
                  <div className="aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden bg-[#18181B]">
                    <img
                      src={primary.url}
                      alt={page.title || "Fotoğraf"}
                      style={{
                        objectPosition: primaryObjPos,
                        transform: `scale(${primaryScale})`,
                      }}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPage(page);
                    }}
                    className="aspect-[16/10] sm:aspect-[4/3] w-full flex flex-col items-center justify-center bg-[#EFEAE2] hover:bg-[#E7E0D6] text-[#6E675F] text-[12px] p-4 text-center transition-apple cursor-pointer"
                  >
                    <ImageIcon className="h-5 w-5 mb-1.5 text-[#8C847B]" />
                    <span>Fotoğraf Eklemek İçin Tıklayın</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Minimal Page Number */}
        <span
          className={`absolute bottom-2.5 text-[11px] font-medium tabular-nums tracking-wider text-[#8C847B] ${
            isLeftPage ? "left-5 sm:left-6" : "right-5 sm:right-6"
          }`}
        >
          {formattedPageNum}
        </span>
      </div>
    );
  }
);

export default function MemoryBookSection({
  coupleId,
  books,
  activeBook,
  pages,
  photos,
  videos,
  isFullPageView = false,
  onSelectBook,
  onBooksChange,
  onPagesChange,
  onMediaChange,
  onOpenPhotoUploadModal,
}: MemoryBookSectionProps) {
  const { user, preferences, updatePreferences, refreshStorage } = useAuth();

  const flipBookRef = useRef<{
    pageFlip: () => {
      flipNext: () => void;
      flipPrev: () => void;
      turnToPage: (page: number) => void;
    };
  } | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentPageIndex, setCurrentPageIndex] = useState(
    preferences?.last_open_page_order || 0
  );
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Book management modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookModalMode, setBookModalMode] = useState<"create" | "edit">("create");
  const [bookTitleInput, setBookTitleInput] = useState("");
  const [bookDescInput, setBookDescInput] = useState("");
  const [bookCoverId, setBookCoverId] = useState<string | null>(null);

  // Page editor state with debounced autosave & version conflict handling
  const [editingPage, setEditingPage] = useState<MemoryPage | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftLayout, setDraftLayout] = useState<BookLayoutType>("photo-text");
  const [draftVersion, setDraftVersion] = useState<number>(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflictLatestPage, setConflictLatestPage] = useState<MemoryPage | null>(null);

  // Element controls (photo/video attachment + position/scale)
  const [primaryMediaId, setPrimaryMediaId] = useState<string | null>(null);
  const [secondaryMediaId, setSecondaryMediaId] = useState<string | null>(null);
  const [posX, setPosX] = useState<number>(0);
  const [posY, setPosY] = useState<number>(0);
  const [scalePct, setScalePct] = useState<number>(100);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [showAllPagesDrawer, setShowAllPagesDrawer] = useState(false);
  const [videoModalMedia, setVideoModalMedia] = useState<MediaItem | null>(null);
  const [resolvedVideoModal, setResolvedVideoModal] = useState<{
    mediaId: string;
    url: string | null;
  } | null>(null);
  const videoModalUrl =
    videoModalMedia && resolvedVideoModal?.mediaId === videoModalMedia.id
      ? resolvedVideoModal.url
      : null;

  const allMedia = React.useMemo(() => [...photos, ...videos], [photos, videos]);
  const mediaById = React.useMemo(
    () => new Map(allMedia.map((m) => [m.id, m])),
    [allMedia]
  );

  useEffect(() => {
    const checkViewport = () => setIsMobilePortrait(window.innerWidth < 768);
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Batch resolve signed URLs for thumbnails & photos used across the book
  useEffect(() => {
    let active = true;
    const resolveAll = async () => {
      const thumbPaths: string[] = [];
      const photoPaths: string[] = [];

      for (const m of allMedia) {
        if (m.thumbnail_path) thumbPaths.push(m.thumbnail_path);
        else if (m.media_type === "photo") photoPaths.push(m.storage_path);
      }

      const [tMap, pMap] = await Promise.all([
        thumbPaths.length > 0 ? getSignedUrlsBatch("thumbnails", thumbPaths) : {},
        photoPaths.length > 0 ? getSignedUrlsBatch("couple-photos", photoPaths) : {},
      ]);
      if (active) setSignedUrls({ ...pMap, ...tMap });
    };
    void resolveAll();
    return () => {
      active = false;
    };
  }, [allMedia]);

  // Resolve video URL when user plays an embedded book video
  useEffect(() => {
    if (!videoModalMedia) return;
    let active = true;
    const targetId = videoModalMedia.id;
    void getSignedUrl("couple-videos", videoModalMedia.storage_path).then((u) => {
      if (active) setResolvedVideoModal({ mediaId: targetId, url: u });
    });
    return () => {
      active = false;
    };
  }, [videoModalMedia]);

  const handleFlip = useCallback(
    (e: { data: number }) => {
      const nextIdx = typeof e?.data === "number" ? e.data : 0;
      setCurrentPageIndex(nextIdx);
      if (activeBook) {
        void updatePreferences({
          last_open_book_id: activeBook.id,
          last_open_page_order: nextIdx,
        });
      }
    },
    [activeBook, updatePreferences]
  );

  const openEditorForPage = (page: MemoryPage) => {
    setEditingPage(page);
    setDraftTitle(page.title || "");
    setDraftDate(page.memory_date || "");
    setDraftContent(page.content || "");
    setDraftLayout(page.layout_type || "photo-text");
    setDraftVersion(page.version || 1);
    setSaveState("idle");
    setConflictLatestPage(null);
    setEditorError(null);

    const els = [...(page.elements || [])].sort((a, b) => a.layer_order - b.layer_order);
    const mediaEls = els.filter(
      (el) => el.element_type === "photo" || el.element_type === "video"
    );
    setPrimaryMediaId(mediaEls[0]?.media_id || null);
    setSecondaryMediaId(mediaEls[1]?.media_id || null);
    setPosX(Number(mediaEls[0]?.position_x || 0));
    setPosY(Number(mediaEls[0]?.position_y || 0));
    setScalePct(Number(mediaEls[0]?.width || 100));
  };

  // Debounced optimistic-concurrency autosave to Supabase
  const persistPageDraft = useCallback(
    async (
      pageId: string,
      expectedVer: number,
      title: string,
      content: string,
      memDate: string,
      layout: BookLayoutType
    ) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveState("offline");
        return;
      }

      setSaveState("saving");
      const supabase = createClient();

      const { data, error } = await supabase.rpc("save_memory_page_optimistic", {
        p_page_id: pageId,
        p_expected_version: expectedVer,
        p_title: title,
        p_content: content,
        p_memory_date: memDate,
        p_layout_type: layout,
      });

      if (error) {
        if (error.message?.includes("VERSION_CONFLICT") || error.code === "40001") {
          setSaveState("conflict");
          const { data: latestRow } = await supabase
            .from("memory_pages")
            .select("*")
            .eq("id", pageId)
            .single();
          if (latestRow) {
            setConflictLatestPage(latestRow as MemoryPage);
          }
          return;
        }
        setSaveState("error");
        setEditorError(error.message || "Değişiklikler kaydedilemedi.");
        return;
      }

      const saved = data as MemoryPage;
      setDraftVersion(saved.version);
      setSaveState("saved");
      await onPagesChange();
    },
    [onPagesChange]
  );

  const scheduleAutosave = (
    nextTitle: string,
    nextContent: string,
    nextDate: string,
    nextLayout: BookLayoutType
  ) => {
    if (!editingPage) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaveState("saving");
    const pageId = editingPage.id;
    const expectedVer = draftVersion;
    autosaveTimerRef.current = setTimeout(() => {
      void persistPageDraft(
        pageId,
        expectedVer,
        nextTitle,
        nextContent,
        nextDate,
        nextLayout
      );
    }, 700);
  };

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const syncPageMediaElements = async (
    pageId: string,
    nextPrimaryId: string | null,
    nextSecondaryId: string | null,
    nextPosX: number,
    nextPosY: number,
    nextScale: number
  ) => {
    setSaveState("saving");
    const supabase = createClient();

    await supabase.from("memory_page_elements").delete().eq("page_id", pageId);

    const rowsToInsert: Array<Record<string, unknown>> = [];
    if (nextPrimaryId) {
      const m = mediaById.get(nextPrimaryId);
      rowsToInsert.push({
        page_id: pageId,
        couple_id: coupleId,
        element_type: m?.media_type === "video" ? "video" : "photo",
        media_id: nextPrimaryId,
        position_x: nextPosX,
        position_y: nextPosY,
        width: nextScale,
        height: nextScale,
        layer_order: 0,
      });
    }
    if (nextSecondaryId) {
      const m2 = mediaById.get(nextSecondaryId);
      rowsToInsert.push({
        page_id: pageId,
        couple_id: coupleId,
        element_type: m2?.media_type === "video" ? "video" : "photo",
        media_id: nextSecondaryId,
        position_x: 0,
        position_y: 0,
        width: 100,
        height: 100,
        layer_order: 1,
      });
    }

    if (rowsToInsert.length > 0) {
      const { error } = await supabase
        .from("memory_page_elements")
        .insert(rowsToInsert);
      if (error) {
        setSaveState("error");
        setEditorError(error.message);
        return;
      }
    }

    setSaveState("saved");
    await onPagesChange();
  };

  const handleAddNewPage = async () => {
    if (!activeBook) return;
    const supabase = createClient();
    const todayStr = new Date().toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const { data, error } = await supabase
      .from("memory_pages")
      .insert({
        book_id: activeBook.id,
        couple_id: coupleId,
        page_order: pages.length,
        title: "Yeni Anı Sayfası",
        content: "",
        memory_date: todayStr,
        layout_type: "photo-text",
        created_by: user?.id || null,
      })
      .select("*")
      .single();

    if (error || !data) return;

    await onPagesChange();
    openEditorForPage({ ...(data as MemoryPage), elements: [] });
  };

  const handleDeletePage = async (pageId: string) => {
    const supabase = createClient();
    await supabase.from("memory_pages").delete().eq("id", pageId);
    setEditingPage(null);
    await onPagesChange();
  };

  const handleMovePageOrder = async (pageId: string, direction: "prev" | "next") => {
    const idx = pages.findIndex((p) => p.id === pageId);
    const targetIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= pages.length) return;

    const clone = [...pages];
    const [moved] = clone.splice(idx, 1);
    clone.splice(targetIdx, 0, moved);

    const supabase = createClient();
    await Promise.all(
      clone.map((p, order) =>
        supabase.from("memory_pages").update({ page_order: order }).eq("id", p.id)
      )
    );
    await onPagesChange();
  };

  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingPage) return;
    e.target.value = "";
    setUploadingPhoto(true);
    setEditorError(null);
    try {
      const uploaded = await uploadCoupleMedia({
        coupleId,
        file,
        mediaType: "photo",
        title: draftTitle || file.name.replace(/\.[^.]+$/, ""),
      });
      await Promise.all([onMediaChange(), refreshStorage()]);
      setPrimaryMediaId(uploaded.id);
      await syncPageMediaElements(
        editingPage.id,
        uploaded.id,
        secondaryMediaId,
        posX,
        posY,
        scalePct
      );
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Fotoğraf yüklenemedi.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveBookMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitleInput.trim()) return;
    const supabase = createClient();

    if (bookModalMode === "create") {
      const { data } = await supabase
        .from("memory_books")
        .insert({
          couple_id: coupleId,
          title: bookTitleInput.trim(),
          description: bookDescInput.trim() || null,
          cover_media_id: bookCoverId,
          created_by: user?.id || null,
        })
        .select("id")
        .single();
      await onBooksChange();
      if (data?.id) onSelectBook(data.id);
    } else if (activeBook) {
      await supabase
        .from("memory_books")
        .update({
          title: bookTitleInput.trim(),
          description: bookDescInput.trim() || null,
          cover_media_id: bookCoverId,
        })
        .eq("id", activeBook.id);
      await onBooksChange();
    }
    setShowBookModal(false);
  };

  const renderSaveBadge = () => {
    switch (saveState) {
      case "saving":
        return <span className="text-[12px] text-[#A1A1A6]">Kaydediliyor...</span>;
      case "saved":
        return (
          <span className="inline-flex items-center gap-1 text-[12px] text-[#D88A96]">
            <Check className="h-3.5 w-3.5" />
            Kaydedildi
          </span>
        );
      case "offline":
        return (
          <span className="inline-flex items-center gap-1 text-[12px] text-amber-400">
            <WifiOff className="h-3.5 w-3.5" />
            Bağlantı bekleniyor
          </span>
        );
      case "conflict":
        return (
          <span className="inline-flex items-center gap-1 text-[12px] text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sürüm çakışması
          </span>
        );
      case "error":
        return <span className="text-[12px] text-rose-400">Kayıt başarısız</span>;
      default:
        return null;
    }
  };

  return (
    <section
      className={`mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 ${
        isFullPageView ? "pt-6 pb-28" : "pt-4 pb-12"
      }`}
    >
      {/* Editorial Section Header + Book Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
              {activeBook?.title || "Anı Kitabımız"}
            </h2>
            {books.length > 1 && (
              <select
                value={activeBook?.id || ""}
                onChange={(e) => onSelectBook(e.target.value)}
                aria-label="Anı kitabı seç"
                className="rounded-lg border border-[#343438] bg-[#18181B] px-2.5 py-1 text-[12px] text-[#F5F5F7]"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-[13px] text-[#A1A1A6] mt-0.5">
            {activeBook?.description ||
              "Sayfaları çevirin, yeni anılar ekleyin ve partnerinizle eş zamanlı oluşturun."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBookModalMode("edit");
              setBookTitleInput(activeBook?.title || "");
              setBookDescInput(activeBook?.description || "");
              setBookCoverId(activeBook?.cover_media_id || null);
              setShowBookModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-3 py-2 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#A1A1A6]" />
            <span>Kitap Ayarları</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBookModalMode("create");
              setBookTitleInput("");
              setBookDescInput("");
              setBookCoverId(null);
              setShowBookModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-3 py-2 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-[#A1A1A6]" />
            <span>Yeni Kitap</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAllPagesDrawer((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-3 py-2 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-[#A1A1A6]" />
            <span>Sayfalar ({pages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => void handleAddNewPage()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3.5 py-2 text-[12px] font-medium text-[#101012] transition-apple cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Sayfa Ekle</span>
          </button>
        </div>
      </div>

      {/* All Pages Overview & Reordering Drawer */}
      {showAllPagesDrawer && (
        <div className="mb-6 rounded-xl border border-[#343438] bg-[#18181B] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#F5F5F7]">
              Sayfa Dizini ve Sıralama ({pages.length} Sayfa)
            </h3>
            <button
              type="button"
              onClick={() => setShowAllPagesDrawer(false)}
              className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {pages.length === 0 ? (
            <p className="text-[13px] text-[#A1A1A6]">
              Bu kitapta henüz sayfa bulunmuyor.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {pages.map((p, idx) => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 transition-apple flex flex-col justify-between ${
                    idx === currentPageIndex
                      ? "border-[#D88A96] bg-[#222226]"
                      : "border-[#343438] bg-[#101012]"
                  }`}
                >
                  <div
                    onClick={() => {
                      setCurrentPageIndex(idx);
                      try {
                        flipBookRef.current?.pageFlip()?.turnToPage(idx);
                      } catch {
                        // Ignore
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#A1A1A6] mb-1">
                      <span className="font-medium text-[#D88A96]">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate ml-2">{p.memory_date}</span>
                    </div>
                    <div className="text-[13px] font-medium text-[#F5F5F7] truncate mb-2">
                      {p.title || "Başlıksız"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#343438]/70">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void handleMovePageOrder(p.id, "prev")}
                        className="rounded p-1 text-[#A1A1A6] hover:text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === pages.length - 1}
                        onClick={() => void handleMovePageOrder(p.id, "next")}
                        className="rounded p-1 text-[#A1A1A6] hover:text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditorForPage(p)}
                      className="rounded bg-[#222226] hover:bg-[#343438] px-2 py-0.5 text-[11px] text-[#F5F5F7] cursor-pointer"
                    >
                      Düzenle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Centerpiece Physical Editorial Book or Empty Book Prompt */}
      {pages.length === 0 ? (
        <div className="rounded-xl bg-[#201F22] p-3.5 border border-[#343438] max-w-[1040px] mx-auto shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
          <div className="rounded-[4px] bg-[#F3EFEA] text-[#1C1917] px-8 py-16 text-center">
            <p className="font-editorial text-[24px] font-medium">
              İlk anınızı birlikte oluşturun.
            </p>
            <p className="mt-2 text-[14px] text-[#57524E] max-w-md mx-auto">
              Anı kitabınız şu an boş. İlk sayfanızı ekleyerek fotoğraf, video ve hikâyelerinizi
              gerçek veritabanında güvenle biriktirmeye başlayın.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void handleAddNewPage()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1C1917] hover:bg-black px-5 py-2.5 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>İlk Sayfayı Oluştur</span>
              </button>
              <button
                type="button"
                onClick={onOpenPhotoUploadModal}
                className="inline-flex items-center gap-2 rounded-lg border border-[#CFC6BA] bg-[#FAF8F5] hover:bg-white px-5 py-2.5 text-[13px] font-medium text-[#1C1917] transition-apple cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Fotoğraf Yükle</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
            aria-label="Önceki Sayfa"
            className="z-20 mr-2 sm:mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#343438] bg-[#18181B] text-[#F5F5F7] hover:bg-[#222226] transition-apple cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="relative w-full max-w-[1040px] rounded-xl bg-[#201F22] p-2 sm:p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] border border-[#343438]">
            <div className="rounded-[6px] bg-[#D8D0C5] p-[2px] sm:p-[3px]">
              <div className="relative overflow-hidden rounded-[4px] bg-[#F3EFEA]">
                <HTMLFlipBook
                  key={`${activeBook?.id}-${pages.length}-${
                    isMobilePortrait ? "mobile" : "desktop"
                  }-${isFullPageView ? "full" : "home"}`}
                  ref={flipBookRef}
                  width={isMobilePortrait ? 330 : 480}
                  height={isMobilePortrait ? 295 : isFullPageView ? 315 : 265}
                  size="stretch"
                  minWidth={280}
                  maxWidth={540}
                  minHeight={240}
                  maxHeight={isFullPageView ? 350 : 290}
                  maxShadowOpacity={0.3}
                  showCover={false}
                  mobileScrollSupport={true}
                  usePortrait={isMobilePortrait}
                  startPage={Math.min(
                    currentPageIndex,
                    Math.max(0, pages.length - 1)
                  )}
                  drawShadow={true}
                  flippingTime={600}
                  useMouseEvents={true}
                  swipeDistance={25}
                  onFlip={handleFlip}
                  className="mx-auto"
                >
                  {pages.map((page, index) => (
                    <BookPageSheet
                      key={page.id}
                      page={page}
                      pageNumber={index + 1}
                      isLeftPage={index % 2 === 0}
                      mediaById={mediaById}
                      signedUrls={signedUrls}
                      onEditPage={openEditorForPage}
                      onPlayVideo={(m) => setVideoModalMedia(m)}
                    />
                  ))}
                </HTMLFlipBook>

                {!isMobilePortrait && (
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-gradient-to-r from-[#1C1917]/25 via-[#1C1917]/40 to-white/30 z-20" />
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
            aria-label="Sonraki Sayfa"
            className="z-20 ml-2 sm:ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#343438] bg-[#18181B] text-[#F5F5F7] hover:bg-[#222226] transition-apple cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Apple Pages-Style Page Inspector Modal */}
      {editingPage && (
        <div
          onClick={() => setEditingPage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[#343438] bg-[#18181B] p-6 text-[#F5F5F7] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#343438] pb-4 mb-5">
              <div>
                <h3 className="text-[18px] font-semibold text-[#F5F5F7]">
                  Sayfa {String(editingPage.page_order + 1).padStart(2, "0")} Düzenleyici
                </h3>
                <p className="text-[12px] text-[#A1A1A6] mt-0.5">
                  Sürüm v{draftVersion} • Otomatik kayıt aktif
                </p>
              </div>
              <div className="flex items-center gap-3">
                {renderSaveBadge()}
                <button
                  type="button"
                  onClick={() => setEditingPage(null)}
                  className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Optimistic Concurrency Conflict Resolution */}
            {saveState === "conflict" && conflictLatestPage && (
              <div className="mb-5 rounded-xl border border-amber-500/40 bg-[#101012] p-4 space-y-3">
                <div className="flex items-start gap-2.5 text-[13px] text-[#F5F5F7]">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Bu sayfa partneriniz tarafından az önce güncellenmiş (v
                    {conflictLatestPage.version}). Veri kaybını önlemek için nasıl devam etmek
                    istersiniz?
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      openEditorForPage({
                        ...conflictLatestPage,
                        elements: editingPage.elements,
                      });
                    }}
                    className="rounded-lg bg-[#222226] hover:bg-[#343438] px-3 py-1.5 text-[12px] font-medium text-[#F5F5F7] cursor-pointer"
                  >
                    Partnerin Sürümünü Yükle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const latestVer = conflictLatestPage.version;
                      setDraftVersion(latestVer);
                      setConflictLatestPage(null);
                      void persistPageDraft(
                        editingPage.id,
                        latestVer,
                        draftTitle,
                        draftContent,
                        draftDate,
                        draftLayout
                      );
                    }}
                    className="rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer"
                  >
                    Benim Sürümümle Kaydet
                  </button>
                </div>
              </div>
            )}

            {editorError && (
              <div className="mb-4 rounded-lg border border-[#D88A96]/40 bg-[#101012] px-3.5 py-2.5 text-[12px] text-[#F5F5F7]">
                {editorError}
              </div>
            )}

            <div className="space-y-5">
              {/* Template Selector */}
              <div>
                <label className="block text-[12px] font-medium text-[#A1A1A6] mb-2">
                  Sayfa Şablonu
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDraftLayout(opt.id);
                        scheduleAutosave(draftTitle, draftContent, draftDate, opt.id);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-[12px] font-medium transition-apple cursor-pointer ${
                        draftLayout === opt.id
                          ? "border-[#D88A96] bg-[#222226] text-[#F5F5F7]"
                          : "border-[#343438] bg-[#101012] text-[#A1A1A6] hover:text-[#F5F5F7]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Sayfa Başlığı
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftTitle(val);
                      scheduleAutosave(val, draftContent, draftDate, draftLayout);
                    }}
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Tarih
                  </label>
                  <input
                    type="text"
                    value={draftDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftDate(val);
                      scheduleAutosave(draftTitle, draftContent, val, draftLayout);
                    }}
                    placeholder="Örn: 14 Ağustos 2025"
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                  />
                </div>
              </div>

              {/* Memory Text */}
              <div>
                <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                  Anı Metni
                </label>
                <textarea
                  rows={3}
                  value={draftContent}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftContent(val);
                    scheduleAutosave(draftTitle, val, draftDate, draftLayout);
                  }}
                  placeholder="Bu güne dair hislerinizi yazın..."
                  className="w-full rounded-lg border border-[#343438] bg-[#101012] p-3.5 text-[14px] leading-relaxed text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                />
              </div>

              {/* Media Selection + Position/Scale Inspector */}
              {draftLayout !== "full-text" && (
                <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-[#F5F5F7]">
                      {draftLayout === "video-note"
                        ? "Sayfa Videosu"
                        : "Sayfa Fotoğrafı / Medyası"}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {uploadingPhoto ? "Yükleniyor..." : "Bilgisayardan Yükle"}
                        </span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/*"
                          onChange={handleDirectPhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                      </label>
                      {primaryMediaId && (
                        <button
                          type="button"
                          onClick={() => {
                            setPrimaryMediaId(null);
                            void syncPageMediaElements(
                              editingPage.id,
                              null,
                              secondaryMediaId,
                              posX,
                              posY,
                              scalePct
                            );
                          }}
                          className="rounded-lg border border-[#343438] bg-[#18181B] px-2.5 py-1.5 text-[12px] text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                        >
                          Kaldır
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Primary Media Picker */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-32 overflow-y-auto pr-1">
                    {(draftLayout === "video-note" ? videos : photos).map((m) => {
                      const url =
                        (m.thumbnail_path && signedUrls[m.thumbnail_path]) ||
                        signedUrls[m.storage_path];
                      const selected = primaryMediaId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setPrimaryMediaId(m.id);
                            void syncPageMediaElements(
                              editingPage.id,
                              m.id,
                              secondaryMediaId,
                              posX,
                              posY,
                              scalePct
                            );
                          }}
                          className={`relative aspect-square overflow-hidden rounded-md border-2 cursor-pointer ${
                            selected
                              ? "border-[#D88A96]"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt={m.title || "Medya"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-[#222226]" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Secondary Photo Picker for two-photos / minimal-collage */}
                  {(draftLayout === "two-photos" ||
                    draftLayout === "minimal-collage") && (
                    <div className="pt-3 border-t border-[#343438]/70">
                      <p className="text-[12px] text-[#A1A1A6] mb-2">
                        2. Fotoğraf Seçimi:
                      </p>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-28 overflow-y-auto pr-1">
                        {photos.map((m) => {
                          const url =
                            (m.thumbnail_path && signedUrls[m.thumbnail_path]) ||
                            signedUrls[m.storage_path];
                          const selected = secondaryMediaId === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSecondaryMediaId(m.id);
                                void syncPageMediaElements(
                                  editingPage.id,
                                  primaryMediaId,
                                  m.id,
                                  posX,
                                  posY,
                                  scalePct
                                );
                              }}
                              className={`relative aspect-square overflow-hidden rounded-md border-2 cursor-pointer ${
                                selected
                                  ? "border-[#D88A96]"
                                  : "border-transparent opacity-70 hover:opacity-100"
                              }`}
                            >
                              {url ? (
                                <img
                                  src={url}
                                  alt={m.title || "Fotoğraf 2"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-[#222226]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Position & Size Controls */}
                  {primaryMediaId && draftLayout !== "video-note" && (
                    <div className="pt-3 border-t border-[#343438]/70 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#A1A1A6]">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Görsel Konumu ve Boyutu</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-[#A1A1A6]">
                        <label className="space-y-1">
                          <span>Yatay Odak ({posX}%)</span>
                          <input
                            type="range"
                            min={-40}
                            max={40}
                            value={posX}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setPosX(v);
                            }}
                            onMouseUp={() =>
                              void syncPageMediaElements(
                                editingPage.id,
                                primaryMediaId,
                                secondaryMediaId,
                                posX,
                                posY,
                                scalePct
                              )
                            }
                            className="w-full accent-[#D88A96]"
                          />
                        </label>
                        <label className="space-y-1">
                          <span>Dikey Odak ({posY}%)</span>
                          <input
                            type="range"
                            min={-40}
                            max={40}
                            value={posY}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setPosY(v);
                            }}
                            onMouseUp={() =>
                              void syncPageMediaElements(
                                editingPage.id,
                                primaryMediaId,
                                secondaryMediaId,
                                posX,
                                posY,
                                scalePct
                              )
                            }
                            className="w-full accent-[#D88A96]"
                          />
                        </label>
                        <label className="space-y-1">
                          <span>Yakınlaştırma (%{scalePct})</span>
                          <input
                            type="range"
                            min={80}
                            max={135}
                            value={scalePct}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setScalePct(v);
                            }}
                            onMouseUp={() =>
                              void syncPageMediaElements(
                                editingPage.id,
                                primaryMediaId,
                                secondaryMediaId,
                                posX,
                                posY,
                                scalePct
                              )
                            }
                            className="w-full accent-[#D88A96]"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#343438]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={editingPage.page_order === 0}
                    onClick={() => void handleMovePageOrder(editingPage.id, "prev")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#343438] bg-[#101012] px-3 py-1.5 text-[12px] text-[#F5F5F7] disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Önceki</span>
                  </button>
                  <button
                    type="button"
                    disabled={editingPage.page_order >= pages.length - 1}
                    onClick={() => void handleMovePageOrder(editingPage.id, "next")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#343438] bg-[#101012] px-3 py-1.5 text-[12px] text-[#F5F5F7] disabled:opacity-35 cursor-pointer"
                  >
                    <span>Sonraki</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDeletePage(editingPage.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#101012] px-3 py-1.5 text-[12px] font-medium text-[#D88A96] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Sayfayı Sil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (autosaveTimerRef.current) {
                        clearTimeout(autosaveTimerRef.current);
                      }
                      void persistPageDraft(
                        editingPage.id,
                        draftVersion,
                        draftTitle,
                        draftContent,
                        draftDate,
                        draftLayout
                      );
                      setEditingPage(null);
                    }}
                    className="rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer"
                  >
                    Kaydet ve Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Memory Book Modal */}
      {showBookModal && (
        <div
          onClick={() => setShowBookModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSaveBookMeta}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#343438] bg-[#18181B] p-6 text-[#F5F5F7] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold">
                {bookModalMode === "create"
                  ? "Yeni Anı Kitabı Oluştur"
                  : "Kitap Başlığı ve Kapağı"}
              </h3>
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                className="text-[#A1A1A6] hover:text-[#F5F5F7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Kitap Başlığı
              </label>
              <input
                type="text"
                required
                value={bookTitleInput}
                onChange={(e) => setBookTitleInput(e.target.value)}
                placeholder="Örn: İlk Yılımız"
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Açıklama
              </label>
              <input
                type="text"
                value={bookDescInput}
                onChange={(e) => setBookDescInput(e.target.value)}
                placeholder="Kısa alt başlık"
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
              />
            </div>

            {photos.length > 0 && (
              <div>
                <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                  Kapak Fotoğrafı (isteğe bağlı)
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-24 overflow-y-auto">
                  {photos.slice(0, 15).map((p) => {
                    const url =
                      (p.thumbnail_path && signedUrls[p.thumbnail_path]) ||
                      signedUrls[p.storage_path];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setBookCoverId(bookCoverId === p.id ? null : p.id)
                        }
                        className={`aspect-square overflow-hidden rounded border-2 cursor-pointer ${
                          bookCoverId === p.id
                            ? "border-[#D88A96]"
                            : "border-transparent opacity-70"
                        }`}
                      >
                        {url && (
                          <img
                            src={url}
                            alt={p.title || "Kapak"}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                className="rounded-lg border border-[#343438] px-4 py-2 text-[13px] text-[#A1A1A6]"
              >
                İptal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2 text-[13px] font-medium text-[#101012] cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Embedded Book Video Player Modal */}
      {videoModalMedia && (
        <div
          onClick={() => setVideoModalMedia(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101012]/95 p-6 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#F5F5F7]">
                {videoModalMedia.title || "Video"}
              </h3>
              <button
                type="button"
                onClick={() => setVideoModalMedia(null)}
                className="rounded-lg border border-[#343438] bg-[#18181B] p-2 text-[#A1A1A6] hover:text-[#F5F5F7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {videoModalUrl ? (
              <video
                src={videoModalUrl}
                controls
                playsInline
                className="max-h-[75vh] w-full rounded-xl border border-[#343438] bg-black"
              />
            ) : (
              <div className="flex h-60 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D88A96] border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
