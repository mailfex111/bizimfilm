"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import HTMLFlipBookBase from "react-pageflip";
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  Plus,
  Image as ImageIcon,
  PlaySquare,
  Music,
  BookOpen,
  Edit3,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Upload,
  Check,
  X,
  Calendar,
  Type,
  Sparkles,
  Play,
  Maximize2,
  Subtitles,
  Layers,
} from "lucide-react";
import {
  addCouplePhoto,
  deleteCoupleBookPage,
  reorderCoupleBookPages,
  saveCoupleBookPage,
  setLastOpenBookPage,
} from "@/lib/db";
import { optimizeImageToWebP } from "@/lib/imageOptimizer";
import { type BookPageItem, type CoupleId, type NavTab, type PhotoItem } from "@/types";

const HTMLFlipBook =
  HTMLFlipBookBase as unknown as React.ComponentType<Record<string, unknown>>;

interface MemoryBookSectionProps {
  coupleId: CoupleId;
  pages: BookPageItem[];
  photos: PhotoItem[];
  initialPageIndex: number;
  isFullPageView?: boolean;
  onPagesChange: (pages: BookPageItem[]) => void;
  onPhotosChange: () => Promise<void>;
  onSelectTab: (tab: NavTab) => void;
  onOpenPhotoUploadModal: () => void;
}

interface BookPageSheetProps {
  page: BookPageItem;
  pageNumber: number;
  isLeftPage: boolean;
  onEditPage: (page: BookPageItem) => void;
}

/**
 * Baby's breath (cipso) dried flower illustration matching the left polaroid corner in the reference image
 */
function DriedFlowerSprig() {
  return (
    <svg
      viewBox="0 0 90 110"
      className="pointer-events-none absolute -bottom-3 -left-4 h-20 w-16 sm:h-24 sm:w-20 drop-shadow-[0_3px_4px_rgba(40,20,10,0.35)] z-20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Stems */}
      <path
        d="M36 105 C38 82, 42 62, 48 35"
        stroke="#7b6853"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M37 92 C28 74, 22 58, 18 42"
        stroke="#7b6853"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M41 78 C52 64, 60 50, 66 36"
        stroke="#7b6853"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M39 85 C34 65, 34 48, 35 28"
        stroke="#8c7760"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Blossoms */}
      {[
        [18, 40, 4.5],
        [13, 47, 3.8],
        [24, 46, 4],
        [21, 33, 3.8],
        [34, 26, 4.5],
        [29, 34, 4],
        [40, 31, 4.2],
        [48, 34, 4.6],
        [44, 43, 3.9],
        [54, 39, 4.1],
        [65, 35, 4.4],
        [59, 45, 3.8],
        [70, 43, 3.6],
        [31, 52, 3.8],
        [47, 52, 3.8],
      ].map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill="#f7f2eb" stroke="#cbbba8" strokeWidth="0.8" />
          <circle cx={cx - 0.8} cy={cy - 0.8} r={r * 0.45} fill="#ffffff" />
        </g>
      ))}
    </svg>
  );
}

const BookPageSheet = React.forwardRef<HTMLDivElement, BookPageSheetProps>(
  function BookPageSheet({ page, pageNumber, isLeftPage, onEditPage }, ref) {
    const isHeroLeft = pageNumber === 1 || page.layoutVariant === "hero-left";
    const isCollageRight =
      (pageNumber === 2 || page.layoutVariant === "collage-right") &&
      Boolean(page.secondaryPhotoUrl);

    return (
      <div
        ref={ref}
        className={`relative h-full w-full select-none overflow-hidden bg-[#eadccf] text-[#3d2327] ${
          isLeftPage
            ? "rounded-l-md border-r border-[#c8b29e]/70"
            : "rounded-r-md border-l border-[#d7c4b2]/60"
        }`}
        style={{
          backgroundImage: isLeftPage
            ? "radial-gradient(circle at 35% 45%, rgba(250,242,233,0.75) 0%, rgba(232,216,200,0.95) 75%, rgba(212,191,172,1) 100%)"
            : "radial-gradient(circle at 65% 45%, rgba(250,242,233,0.75) 0%, rgba(232,216,200,0.95) 75%, rgba(212,191,172,1) 100%)",
        }}
      >
        {/* Subtle Paper Grain & Inner Spine Shadow */}
        <div
          className={`pointer-events-none absolute inset-y-0 w-10 z-10 ${
            isLeftPage
              ? "right-0 bg-gradient-to-l from-[#5c3d2e]/25 via-[#5c3d2e]/08 to-transparent"
              : "left-0 bg-gradient-to-r from-[#5c3d2e]/28 via-[#5c3d2e]/08 to-transparent"
          }`}
        />

        {/* Quick Edit Button on Bottom Corner */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditPage(page);
          }}
          title="Bu sayfayı düzenle"
          className={`absolute bottom-1.5 z-30 flex items-center gap-1 rounded-full bg-[#6b333b]/15 hover:bg-[#c81e3a] px-2 py-0.5 text-[9px] font-medium text-[#5c2c33] hover:text-white transition cursor-pointer ${
            isLeftPage ? "right-3" : "left-3"
          }`}
        >
          <Edit3 className="h-2.5 w-2.5" />
          <span>Düzenle</span>
        </button>

        {/* Page Layout 1: Reference Left Page ("Bizim Hikayemiz ♡" + tilted Polaroid with tape & dried flowers) */}
        {isHeroLeft ? (
          <div className="relative h-full w-full flex items-center justify-between px-4 sm:px-6 py-3">
            {/* Left Side Handwritten Title & Drawn Heart */}
            <div className="flex flex-col justify-between h-full py-2 pl-1 sm:pl-2 max-w-[40%] z-10">
              <div className="-rotate-6 mt-1 sm:mt-2">
                <h3 className="font-handwriting text-2xl sm:text-[29px] leading-[1.06] text-[#4b252a] font-semibold drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                  {page.title || "Bizim Hikayemiz ♡"}
                </h3>
                {page.date && (
                  <p className="mt-1 text-[9px] sm:text-[10px] font-serif italic text-[#7a4b50]">
                    {page.date}
                  </p>
                )}
              </div>

              {page.content &&
                page.content !== "Seninle tanıştığım o günü hiçbir zaman unutmayacağım." && (
                  <p className="font-handwriting text-sm sm:text-base text-[#52292e] leading-snug -rotate-2 my-auto pr-1 line-clamp-4">
                    {page.content}
                  </p>
                )}

              {/* Drawn Heart at Bottom Left matching reference */}
              <div className="mb-1 pl-3 sm:pl-5">
                <svg
                  viewBox="0 0 44 40"
                  className="h-7 w-7 sm:h-8 sm:w-8 text-[#a64249]/80 -rotate-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 35 C22 35 5 24 5 13 C5 6.5 10 3 15.5 3 C19 3 21 5 22 7.5 C23 5 25 3 28.5 3 C34 3 39 6.5 39 13 C39 24 22 35 22 35 Z" />
                </svg>
              </div>
            </div>

            {/* Right Side Tilted Polaroid Frame with Masking Tape & Dried Flowers */}
            <div className="relative w-[58%] sm:w-[57%] mr-1 sm:mr-2 -rotate-[2.5deg] z-10">
              {/* Top-left Masking Tape Strip */}
              <div className="pointer-events-none absolute -top-2.5 left-2 z-20 h-5 w-14 -rotate-[8deg] rounded-[2px] bg-[#d6b793]/85 shadow-sm border border-[#c3a17b]/50" />

              <div className="rounded-[3px] bg-[#f8f3ed] p-2 sm:p-2.5 pb-6 sm:pb-7 shadow-[0_12px_28px_rgba(45,25,18,0.28)] border border-[#e2d6c8]">
                {page.photoUrl ? (
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#2b1015]">
                    <img
                      src={page.photoUrl}
                      alt={page.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] w-full flex flex-col items-center justify-center bg-[#efe5da] text-[#845b5f] text-xs p-3 text-center">
                    <ImageIcon className="h-6 w-6 mb-1 opacity-60" />
                    <span>Fotoğraf eklemek için Düzenle&apos;ye tıklayın</span>
                  </div>
                )}
              </div>

              {/* Dried Baby's Breath Flower Sprig on bottom-left corner */}
              <DriedFlowerSprig />
            </div>

            <span className="absolute bottom-2 left-3 text-[10px] font-serif text-[#8c6c60]/80">
              Sayfa {pageNumber}
            </span>
          </div>
        ) : isCollageRight ? (
          /* Page Layout 2: Reference Right Page (Night video polaroid + overlapping hands polaroid + handwritten note on right) */
          <div className="relative h-full w-full flex items-center justify-between px-3 sm:px-5 py-5">
            {/* Dual Polaroid Collage */}
            <div className="relative flex items-center w-[74%] h-full">
              {/* Primary Frame (Night Video Polaroid) */}
              <div className="relative w-[66%] -rotate-[1deg] rounded-[3px] bg-[#f8f3ed] p-1.5 sm:p-2 pb-2.5 shadow-[0_12px_26px_rgba(45,25,18,0.3)] border border-[#e2d6c8] z-10">
                <div className="relative aspect-[16/11] w-full overflow-hidden bg-[#15080b]">
                  {page.photoUrl ? (
                    <img
                      src={page.photoUrl}
                      alt={page.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-rose-200/60">
                      Fotoğraf Yok
                    </div>
                  )}

                  {/* Center Play Button Overlay */}
                  {page.hasVideoBadge && page.photoUrl !== "/images/polaroid-night.webp" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-xs border border-white/25 shadow-md">
                        <Play className="h-4 w-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Bottom Video Controls Strip matching reference */}
                  {page.hasVideoBadge && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2 py-1 flex items-center justify-between text-[8px] sm:text-[9px] text-white/90">
                      <div className="flex items-center gap-1">
                        <Play className="h-2.5 w-2.5 fill-white text-white" />
                        <span>{page.videoDurationText || "0:00 / 1:24"}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-85">
                        <span>0:08</span>
                        <Subtitles className="h-2.5 w-2.5" />
                        <Maximize2 className="h-2.5 w-2.5" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Overlapping Second Polaroid (Holding Hands) */}
              <div className="relative -ml-3 sm:-ml-4 mt-3 w-[42%] rotate-[2.5deg] rounded-[3px] bg-[#f8f3ed] p-1.5 pb-5 shadow-[0_12px_25px_rgba(45,25,18,0.28)] border border-[#e2d6c8] z-20">
                {/* Top-right Masking Tape */}
                <div className="pointer-events-none absolute -top-2.5 right-1.5 z-30 h-4 w-11 rotate-[14deg] rounded-[2px] bg-[#d6b793]/85 shadow-xs border border-[#c3a17b]/50" />

                <div className="aspect-[4/4.3] w-full overflow-hidden bg-[#2b1015]">
                  <img
                    src={page.secondaryPhotoUrl || "/images/polaroid-hands.webp"}
                    alt="İkinci polaroid anısı"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Right Margin Handwritten Note: "Seninle her an daha güzel... ♡" */}
            <div className="w-[26%] pl-1.5 pr-1 flex flex-col justify-center items-start z-20">
              <p className="font-handwriting text-sm sm:text-[17px] leading-[1.28] text-[#4a252a] -rotate-2">
                {page.content || "Seninle her an daha güzel... ♡"}
              </p>
              {page.date && (
                <span className="mt-2 text-[9px] sm:text-[10px] font-serif italic text-[#855a5e]">
                  {page.date}
                </span>
              )}
            </div>

            <span className="absolute bottom-2 right-3 text-[10px] font-serif text-[#8c6c60]/80">
              Sayfa {pageNumber}
            </span>
          </div>
        ) : (
          /* Standard Customizable Memory Page (for pages 3+ and newly added pages) */
          <div className="relative h-full w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-5">
            {/* Polaroid Frame */}
            <div
              className={`relative w-[54%] ${
                isLeftPage ? "-rotate-2" : "rotate-2"
              } rounded-[3px] bg-[#f8f3ed] p-2 pb-6 shadow-[0_10px_25px_rgba(45,25,18,0.26)] border border-[#e2d6c8] z-10`}
            >
              <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-20 h-4 w-12 -rotate-3 rounded-[2px] bg-[#d6b793]/85 shadow-xs" />
              {page.photoUrl ? (
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#240b10]">
                  <img
                    src={page.photoUrl}
                    alt={page.title}
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
                  className="aspect-[4/3] w-full flex flex-col items-center justify-center bg-[#efe4d8] hover:bg-[#e7d8c9] text-[#7a4b50] text-xs p-3 text-center transition cursor-pointer"
                >
                  <ImageIcon className="h-6 w-6 mb-1 text-[#a64249]" />
                  <span>Fotoğraf Seç / Yükle</span>
                </button>
              )}
              <div className="mt-2 text-center font-handwriting text-xs text-[#5c353a] truncate">
                {page.title}
              </div>
            </div>

            {/* Memory Text & Date */}
            <div className="w-[44%] flex flex-col justify-center h-full py-2 z-10">
              <h4 className="font-handwriting text-xl sm:text-2xl font-semibold text-[#4b2429] leading-tight">
                {page.title || `Anı Sayfası ${pageNumber}`}
              </h4>
              {page.date && (
                <span className="mt-0.5 text-[10px] font-serif italic text-[#84575c]">
                  {page.date}
                </span>
              )}
              <p className="mt-2.5 font-handwriting text-sm sm:text-[16px] leading-snug text-[#4e2a2e] line-clamp-5">
                {page.content ||
                  "Seninle tanıştığım o günü hiçbir zaman unutmayacağım."}
              </p>
            </div>

            <span
              className={`absolute bottom-2 text-[10px] font-serif text-[#8c6c60]/80 ${
                isLeftPage ? "left-3" : "right-3"
              }`}
            >
              Sayfa {pageNumber}
            </span>
          </div>
        )}
      </div>
    );
  }
);

export default function MemoryBookSection({
  coupleId,
  pages,
  photos,
  initialPageIndex,
  isFullPageView = false,
  onPagesChange,
  onPhotosChange,
  onSelectTab,
  onOpenPhotoUploadModal,
}: MemoryBookSectionProps) {
  const flipBookRef = useRef<{
    pageFlip: () => {
      flipNext: () => void;
      flipPrev: () => void;
      turnToPage: (page: number) => void;
      getCurrentPageIndex: () => number;
    };
  } | null>(null);

  const [currentPageIndex, setCurrentPageIndex] = useState(initialPageIndex || 0);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [editingPage, setEditingPage] = useState<BookPageItem | null>(null);
  const [showAllPagesDrawer, setShowAllPagesDrawer] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploadingPagePhoto, setUploadingPagePhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Check viewport for single-page mobile vs two-page desktop spread
  useEffect(() => {
    const checkViewport = () => {
      setIsMobilePortrait(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Sync initialPageIndex when couple changes
  useEffect(() => {
    setCurrentPageIndex(initialPageIndex || 0);
  }, [initialPageIndex, coupleId]);

  const handleFlip = useCallback(
    (e: { data: number }) => {
      const nextIdx = typeof e?.data === "number" ? e.data : 0;
      setCurrentPageIndex(nextIdx);
      void setLastOpenBookPage(coupleId, nextIdx);
    },
    [coupleId]
  );

  const goPrevPage = () => {
    if (flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flipPrev();
    }
  };

  const goNextPage = () => {
    if (flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flipNext();
    }
  };

  const jumpToPage = (index: number) => {
    setCurrentPageIndex(index);
    void setLastOpenBookPage(coupleId, index);
    try {
      flipBookRef.current?.pageFlip()?.turnToPage(index);
    } catch {
      // Fallback if flipbook isn't mounted yet
    }
  };

  // Add a brand new page to the Memory Book
  const handleAddNewPage = async () => {
    const newOrder = pages.length;
    const todayStr = new Date().toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const newPage: BookPageItem = {
      id: `${coupleId}-page-${Date.now()}`,
      coupleId,
      order: newOrder,
      title: `Yeni Anımız ♡`,
      date: todayStr,
      content: "Seninle tanıştığım o günü hiçbir zaman unutmayacağım.",
      photoUrl: photos[0]?.dataUrl || "/images/polaroid-sunset.webp",
      layoutVariant: "polaroid-standard",
      updatedAt: Date.now(),
    };

    await saveCoupleBookPage(newPage);
    const updated = [...pages, newPage];
    onPagesChange(updated);
    setEditingPage(newPage);

    setTimeout(() => {
      jumpToPage(newOrder);
    }, 120);
  };

  // Auto-save edits to IndexedDB immediately as the user types or picks photos
  const handleUpdateEditingPage = async (patch: Partial<BookPageItem>) => {
    if (!editingPage) return;
    setAutoSaveStatus("saving");
    const updatedPage: BookPageItem = {
      ...editingPage,
      ...patch,
      updatedAt: Date.now(),
    };
    setEditingPage(updatedPage);

    await saveCoupleBookPage(updatedPage);
    const nextPages = pages.map((p) => (p.id === updatedPage.id ? updatedPage : p));
    onPagesChange(nextPages);
    setAutoSaveStatus("saved");
  };

  // Direct computer photo upload inside the Memory Book Page Editor
  const handleDirectPagePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingPage) return;
    setUploadError(null);
    setUploadingPagePhoto(true);

    try {
      const optimized = await optimizeImageToWebP(file);
      const newPhoto: PhotoItem = {
        id: `${coupleId}-photo-${Date.now()}`,
        coupleId,
        title: editingPage.title || file.name.replace(/\.[^.]+$/, ""),
        date: new Date().toISOString().slice(0, 10),
        dataUrl: optimized.dataUrl,
        mimeType: optimized.mimeType,
        width: optimized.width,
        height: optimized.height,
        sizeBytes: optimized.sizeBytes,
        createdAt: Date.now(),
      };

      await addCouplePhoto(newPhoto);
      await onPhotosChange();
      await handleUpdateEditingPage({ photoUrl: optimized.dataUrl });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Fotoğraf yüklenirken bir hata oluştu."
      );
    } finally {
      setUploadingPagePhoto(false);
      e.target.value = "";
    }
  };

  // Delete a page
  const handleDeletePage = async (pageId: string) => {
    if (pages.length <= 2) {
      setUploadError("Anı kitabında en az 2 sayfa bulunmalıdır.");
      return;
    }
    const remaining = await deleteCoupleBookPage(coupleId, pageId);
    onPagesChange(remaining);
    setEditingPage(null);
  };

  // Move page order up/down
  const handleMovePageOrder = async (pageId: string, direction: "prev" | "next") => {
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    const targetIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return;

    const clone = [...pages];
    const [moved] = clone.splice(idx, 1);
    clone.splice(targetIdx, 0, moved);

    const reordered = await reorderCoupleBookPages(coupleId, clone);
    onPagesChange(reordered);

    const updatedCurrent = reordered.find((p) => p.id === pageId);
    if (updatedCurrent) {
      setEditingPage(updatedCurrent);
    }
  };

  return (
    <section
      className={`mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 pt-0.5 ${
        isFullPageView ? "pb-24" : "pb-20"
      }`}
    >
      {/* Top Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-base sm:text-[17px] font-bold text-white tracking-tight">
            <span>Anı Kitabımız</span>
            <Heart className="h-4 w-4 text-white/90 stroke-[2]" />
          </h2>

          {isFullPageView && (
            <span className="rounded-full bg-[#3a121c] border border-rose-300/20 px-3 py-0.5 text-xs text-rose-200">
              {pages.length} Sayfa • Otomatik Kayıt Aktif
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {isFullPageView && (
            <button
              type="button"
              onClick={handleAddNewPage}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#c81e3a] hover:bg-[#e02444] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Sayfa Ekle</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAllPagesDrawer((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-rose-100/85 hover:text-white transition cursor-pointer"
          >
            <span>Tüm Sayfalar →</span>
          </button>
        </div>
      </div>

      {/* All Pages Reorder & Quick Jump Bar */}
      {showAllPagesDrawer && (
        <div className="mb-4 rounded-2xl border border-rose-200/15 bg-[#1d090f]/95 p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Kitap Sayfaları ve Sıralama Yönetimi ({pages.length} Sayfa)
              </h3>
              <p className="text-xs text-rose-200/65">
                Bir sayfaya tıklayarak o sayfaya gidebilir, kalem ikonuyla düzenleyebilir veya oklarla sayfa sırasını değiştirebilirsiniz.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddNewPage}
                className="inline-flex items-center gap-1 rounded-lg bg-[#c81e3a] px-2.5 py-1 text-xs font-medium text-white cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Yeni Sayfa</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAllPagesDrawer(false)}
                className="rounded-lg p-1 text-rose-200/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className={`group rounded-xl border p-2.5 transition flex flex-col justify-between ${
                  idx === currentPageIndex
                    ? "border-[#f06c82] bg-[#38121c]"
                    : "border-rose-200/10 bg-[#140609]/80 hover:border-rose-300/30"
                }`}
              >
                <div
                  onClick={() => jumpToPage(idx)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] text-rose-200/70 mb-1">
                    <span className="font-semibold text-[#f06c82]">Sayfa {idx + 1}</span>
                    <span>{p.date}</span>
                  </div>
                  <div className="text-xs font-medium text-white truncate mb-1.5">
                    {p.title}
                  </div>
                  {p.photoUrl && (
                    <div className="h-16 w-full overflow-hidden rounded bg-black/40 mb-2">
                      <img
                        src={p.photoUrl}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-rose-200/10">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => void handleMovePageOrder(p.id, "prev")}
                      title="Önceki sıraya taşı"
                      className="rounded p-1 text-rose-200/70 hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === pages.length - 1}
                      onClick={() => void handleMovePageOrder(p.id, "next")}
                      title="Sonraki sıraya taşı"
                      className="rounded p-1 text-rose-200/70 hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingPage(p)}
                    className="inline-flex items-center gap-1 rounded bg-[#c81e3a]/80 hover:bg-[#c81e3a] px-2 py-0.5 text-[10px] font-medium text-white cursor-pointer"
                  >
                    <Edit3 className="h-2.5 w-2.5" />
                    <span>Düzenle</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Row: Open Physical Book + Right Quick Add Panel */}
      <div className="flex flex-col lg:flex-row items-center lg:items-stretch gap-4">
        {/* Left/Center: Physical Open 2-Page Book with Left/Right Arrows */}
        <div className="relative flex-1 w-full flex items-center justify-center">
          {/* Left Page Turn Button (<) */}
          <button
            type="button"
            onClick={goPrevPage}
            aria-label="Önceki Sayfa"
            className="z-20 mr-1.5 sm:mr-2.5 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-rose-200/15 bg-[#240c12]/85 text-rose-100/80 hover:bg-[#c81e3a] hover:text-white shadow-lg transition cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Outer Physical Book Cover & Stacked Paper Frame */}
          <div className="relative w-full max-w-[850px] rounded-[16px] bg-gradient-to-b from-[#783a43] via-[#5c2730] to-[#461b22] p-1.5 sm:p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.9)] border border-[#96505b]/45">
            {/* Stacked Paper Side Edges Effect */}
            <div className="rounded-[11px] bg-[#cbb5a0] p-[2px] sm:p-[3px] shadow-inner">
              <div className="relative overflow-hidden rounded-[8px] bg-[#eadccf] shadow-[inset_0_0_30px_rgba(70,40,25,0.2)]">
                {pages.length > 0 && (
                  <HTMLFlipBook
                    key={`${coupleId}-${pages.length}-${isMobilePortrait ? "mobile" : "desktop"}-${isFullPageView ? "full" : "home"}`}
                    ref={flipBookRef}
                    width={isMobilePortrait ? 330 : 415}
                    height={isMobilePortrait ? 215 : isFullPageView ? 260 : 195}
                    size="stretch"
                    minWidth={260}
                    maxWidth={500}
                    minHeight={175}
                    maxHeight={isFullPageView ? 320 : 210}
                    maxShadowOpacity={0.45}
                    showCover={false}
                    mobileScrollSupport={true}
                    usePortrait={isMobilePortrait}
                    startPage={Math.min(currentPageIndex, Math.max(0, pages.length - 1))}
                    drawShadow={true}
                    flippingTime={650}
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
                        onEditPage={(target) => setEditingPage(target)}
                      />
                    ))}
                  </HTMLFlipBook>
                )}

                {/* Central Book Spine Crease Line (Desktop 2-page view) */}
                {!isMobilePortrait && (
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] bg-gradient-to-r from-[#5a3b2c]/45 via-[#2e1b12]/60 to-[#fff8f0]/30 z-20" />
                )}
              </div>
            </div>
          </div>

          {/* Right Page Turn Button (>) */}
          <button
            type="button"
            onClick={goNextPage}
            aria-label="Sonraki Sayfa"
            className="z-20 ml-1.5 sm:ml-2.5 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-rose-200/15 bg-[#240c12]/85 text-rose-100/80 hover:bg-[#c81e3a] hover:text-white shadow-lg transition cursor-pointer"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Right: "+ Hızlı Ekle" Dashed Sidebar Card (Matches Reference Image 1:1) */}
        <aside className="w-full lg:w-[205px] xl:w-[215px] shrink-0 rounded-2xl border border-dashed border-rose-300/25 bg-[#18070c]/85 p-3.5 flex flex-col justify-center shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2.5">
            <Plus className="h-4 w-4 text-white" />
            <span>Hızlı Ekle</span>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onOpenPhotoUploadModal}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-rose-100/85 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <ImageIcon className="h-3.5 w-3.5 text-rose-200/75 shrink-0" />
              <span>Fotoğraf Yükle</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("videolar")}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-rose-100/85 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <PlaySquare className="h-3.5 w-3.5 text-rose-200/75 shrink-0" />
              <span>Video Yükle</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("muzik")}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-rose-100/85 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <Music className="h-3.5 w-3.5 text-rose-200/75 shrink-0" />
              <span>Müzik Ekle</span>
            </button>

            <button
              type="button"
              onClick={handleAddNewPage}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-rose-100/85 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-rose-200/75 shrink-0" />
              <span>Kitap Sayfası Ekle</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Page Editor Modal (Edit text, title, date, photo from computer or gallery, reorder, delete) */}
      {editingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-rose-200/20 bg-[#210b11] p-5 sm:p-6 text-white shadow-[0_25px_70px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between border-b border-rose-200/10 pb-3.5 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#f06c82]" />
                  <span>
                    Anı Kitabı Sayfasını Düzenle (Sayfa {editingPage.order + 1})
                  </span>
                </h3>
                <p className="text-xs text-rose-200/70 mt-0.5">
                  Değişiklikleriniz anında IndexedDB&apos;ye otomatik olarak kaydedilir.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {autoSaveStatus === "saved" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-400/30 px-2.5 py-1 text-[11px] text-emerald-300">
                    <Check className="h-3 w-3" />
                    Kaydedildi
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingPage(null);
                    setUploadError(null);
                  }}
                  className="rounded-lg p-1.5 text-rose-200/70 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Row 1: Page Title & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-rose-100/85 mb-1.5">
                    <Type className="h-3.5 w-3.5 text-[#f06c82]" />
                    <span>Sayfa Başlığı</span>
                  </label>
                  <input
                    type="text"
                    value={editingPage.title}
                    onChange={(e) => void handleUpdateEditingPage({ title: e.target.value })}
                    placeholder="Örn: Bizim Hikayemiz ♡"
                    className="w-full rounded-xl border border-rose-200/15 bg-[#14060a] px-3.5 py-2 text-sm text-white focus:border-[#e63956] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-rose-100/85 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#f06c82]" />
                    <span>Anı Tarihi</span>
                  </label>
                  <input
                    type="text"
                    value={editingPage.date}
                    onChange={(e) => void handleUpdateEditingPage({ date: e.target.value })}
                    placeholder="Örn: 14 Şubat 2025"
                    className="w-full rounded-xl border border-rose-200/15 bg-[#14060a] px-3.5 py-2 text-sm text-white focus:border-[#e63956] focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Memory Text */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-rose-100/85">
                    <Sparkles className="h-3.5 w-3.5 text-[#f06c82]" />
                    <span>Sayfa Anı Metni</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      void handleUpdateEditingPage({
                        content:
                          "Seninle tanıştığım o günü hiçbir zaman unutmayacağım.",
                      })
                    }
                    className="text-[11px] text-[#f06c82] hover:underline cursor-pointer"
                  >
                    Örnek cümleyi kullan
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={editingPage.content}
                  onChange={(e) => void handleUpdateEditingPage({ content: e.target.value })}
                  placeholder="Seninle tanıştığım o günü hiçbir zaman unutmayacağım."
                  className="w-full rounded-xl border border-rose-200/15 bg-[#14060a] p-3.5 text-sm text-white focus:border-[#e63956] focus:outline-none"
                />
              </div>

              {/* Row 3: Page Photo Management */}
              <div className="rounded-xl border border-rose-200/15 bg-[#16060b] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold text-rose-100">
                    Sayfa Fotoğrafı
                  </span>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#c81e3a] hover:bg-[#df2343] px-3 py-1.5 text-xs font-medium text-white cursor-pointer transition">
                      <Upload className="h-3.5 w-3.5" />
                      <span>
                        {uploadingPagePhoto
                          ? "Optimize Ediliyor..."
                          : "Bilgisayardan Fotoğraf Seç"}
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
                        onChange={handleDirectPagePhotoUpload}
                        disabled={uploadingPagePhoto}
                        className="hidden"
                      />
                    </label>

                    {editingPage.photoUrl && (
                      <button
                        type="button"
                        onClick={() => void handleUpdateEditingPage({ photoUrl: null })}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-950/60 hover:bg-rose-900/70 px-2.5 py-1.5 text-xs text-rose-200 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Fotoğrafı Kaldır</span>
                      </button>
                    )}
                  </div>
                </div>

                {uploadError && (
                  <p className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/70 px-3 py-2 text-xs text-rose-200">
                    {uploadError}
                  </p>
                )}

                {/* Current Photo Preview */}
                {editingPage.photoUrl ? (
                  <div className="mb-3 flex items-center gap-3">
                    <img
                      src={editingPage.photoUrl}
                      alt="Seçili sayfa görseli"
                      className="h-20 w-28 rounded-lg object-cover border border-rose-200/20"
                    />
                    <div className="text-xs text-rose-200/75">
                      <p className="font-medium text-white">Aktif Sayfa Görseli</p>
                      <p className="mt-0.5">
                        Aşağıdaki galeriden başka bir fotoğrafa tıklayarak değiştirebilirsiniz.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-rose-200/60">
                    Bu sayfada şu an fotoğraf bulunmuyor. Bilgisayarınızdan yükleyebilir veya aşağıdan seçebilirsiniz.
                  </p>
                )}

                {/* Pick from existing Couple Gallery */}
                <div>
                  <p className="text-[11px] font-medium text-rose-200/75 mb-2">
                    Galeriden Fotoğraf Seç ({photos.length} fotoğraf):
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto pr-1">
                    {photos.map((photo) => {
                      const isSelected = editingPage.photoUrl === photo.dataUrl;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() =>
                            void handleUpdateEditingPage({ photoUrl: photo.dataUrl })
                          }
                          className={`relative aspect-square overflow-hidden rounded-lg border-2 transition cursor-pointer ${
                            isSelected
                              ? "border-[#f06c82] ring-2 ring-[#f06c82]/40"
                              : "border-transparent opacity-75 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={photo.dataUrl}
                            alt={photo.title}
                            className="h-full w-full object-cover"
                          />
                          {isSelected && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c81e3a] text-white">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 4: Reorder & Delete Page Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-rose-200/10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={editingPage.order === 0}
                    onClick={() => void handleMovePageOrder(editingPage.id, "prev")}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Önceki Sıraya Taşı</span>
                  </button>

                  <button
                    type="button"
                    disabled={editingPage.order >= pages.length - 1}
                    onClick={() => void handleMovePageOrder(editingPage.id, "next")}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-35 cursor-pointer"
                  >
                    <span>Sonraki Sıraya Taşı</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDeletePage(editingPage.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-950/70 hover:bg-rose-900 px-3 py-1.5 text-xs font-medium text-rose-200 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Sayfayı Sil</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingPage(null);
                      setUploadError(null);
                    }}
                    className="rounded-lg bg-[#c81e3a] hover:bg-[#e02444] px-4 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    Tamam
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
