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

const BookPageSheet = React.forwardRef<HTMLDivElement, BookPageSheetProps>(
  function BookPageSheet({ page, pageNumber, isLeftPage, onEditPage }, ref) {
    const formattedPageNum = String(pageNumber).padStart(2, "0");
    const cleanTitle = (page.title || `Bölüm ${formattedPageNum}`).replace(/\s*♡/g, "");
    const cleanContent = (
      page.content || "Seninle tanıştığım o günü hiçbir zaman unutmayacağım."
    ).replace(/\s*♡/g, "");

    const isCollageSpread =
      Boolean(page.secondaryPhotoUrl) && page.layoutVariant === "collage-right";

    return (
      <div
        ref={ref}
        className={`group/page relative h-full w-full select-none overflow-hidden bg-[#F3EFEA] text-[#221F1D] ${
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
          className={`absolute top-3.5 z-30 inline-flex items-center gap-1.5 rounded-md border border-[#D6CEC2] bg-[#FAF8F5]/90 hover:bg-[#221F1D] px-2.5 py-1 text-[11px] font-medium text-[#57524E] hover:text-[#F5F5F7] hover:border-[#221F1D] transition-apple cursor-pointer ${
            isLeftPage ? "left-4" : "right-4"
          }`}
        >
          <Edit3 className="h-3 w-3" />
          <span>Düzenle</span>
        </button>

        {/* Editorial Page Layout */}
        {isCollageSpread ? (
          <div className="relative h-full w-full flex flex-col justify-between px-6 sm:px-8 pt-11 pb-8">
            <div className="grid grid-cols-12 gap-3 items-center my-auto">
              {/* Primary Fine-Art Print */}
              <div className="col-span-7 rounded-[2px] bg-[#FAF8F5] p-2 shadow-[0_4px_14px_rgba(24,20,18,0.08)] border border-[#E5DEC9]/80">
                <div className="relative aspect-[16/11] w-full overflow-hidden bg-[#18181B]">
                  {page.photoUrl ? (
                    <img
                      src={page.photoUrl}
                      alt={cleanTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[11px] text-[#A1A1A6]">
                      Görsel Yok
                    </div>
                  )}
                  {page.hasVideoBadge && (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-medium text-[#F5F5F7] tabular-nums">
                      <Play className="h-2 w-2 fill-[#F5F5F7]" />
                      {page.videoDurationText || "01:24"}
                    </span>
                  )}
                </div>
              </div>

              {/* Secondary Print */}
              <div className="col-span-5 rounded-[2px] bg-[#FAF8F5] p-2 shadow-[0_4px_14px_rgba(24,20,18,0.08)] border border-[#E5DEC9]/80">
                <div className="aspect-[4/4.3] w-full overflow-hidden bg-[#18181B]">
                  <img
                    src={page.secondaryPhotoUrl || "/images/polaroid-hands.webp"}
                    alt={cleanTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Editorial Caption Below Prints */}
            <div className="mt-3 pt-3 border-t border-[#E2DBD0] flex items-baseline justify-between gap-4">
              <p className="font-editorial italic text-[14px] sm:text-[15px] text-[#2C2825] leading-snug line-clamp-2">
                &ldquo;{cleanContent}&rdquo;
              </p>
              {page.date && (
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#78716A] shrink-0">
                  {page.date}
                </span>
              )}
            </div>

            <span
              className={`absolute bottom-3 text-[11px] font-medium tabular-nums tracking-wider text-[#8C847B] ${
                isLeftPage ? "left-6" : "right-6"
              }`}
            >
              {formattedPageNum}
            </span>
          </div>
        ) : (
          <div className="relative h-full w-full flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-6 justify-between sm:items-center px-5 sm:px-8 pt-10 pb-8">
            {/* Editorial Copy Column */}
            <div
              className={`sm:col-span-5 flex flex-col justify-center ${
                isLeftPage ? "sm:order-1" : "sm:order-2"
              }`}
            >
              <div className="flex items-center justify-between sm:block">
                {page.date && (
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#78716A] sm: block sm:mb-1.5">
                    {page.date}
                  </span>
                )}
              </div>
              <h3 className="font-editorial text-[18px] sm:text-[23px] font-medium tracking-[-0.015em] leading-[1.16] text-[#1C1917] mt-0.5 sm:mt-0">
                {cleanTitle}
              </h3>
              <div className="hidden sm:block my-2.5 h-px w-8 bg-[#D4CBC0]" />
              <p className="mt-1.5 sm:mt-0 text-[12px] sm:text-[13px] leading-[1.55] text-[#4A443F] line-clamp-2 sm:line-clamp-4 font-normal">
                {cleanContent}
              </p>
            </div>

            {/* Fine-Art Framed Photograph Column */}
            <div
              className={`sm:col-span-7 my-auto ${
                isLeftPage ? "sm:order-2" : "sm:order-1"
              }`}
            >
              <div className="rounded-[2px] bg-[#FAF8F5] p-1.5 sm:p-2 shadow-[0_6px_20px_rgba(24,20,18,0.08)] border border-[#E4DDD3]">
                {page.photoUrl ? (
                  <div className="aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden bg-[#18181B]">
                    <img
                      src={page.photoUrl}
                      alt={cleanTitle}
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

            {/* Minimal Page Number */}
            <span
              className={`absolute bottom-2.5 text-[11px] font-medium tabular-nums tracking-wider text-[#8C847B] ${
                isLeftPage ? "left-5 sm:left-6" : "right-5 sm:right-6"
              }`}
            >
              {formattedPageNum}
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

  useEffect(() => {
    const checkViewport = () => {
      setIsMobilePortrait(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

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
    flipBookRef.current?.pageFlip()?.flipPrev();
  };

  const goNextPage = () => {
    flipBookRef.current?.pageFlip()?.flipNext();
  };

  const jumpToPage = (index: number) => {
    setCurrentPageIndex(index);
    void setLastOpenBookPage(coupleId, index);
    try {
      flipBookRef.current?.pageFlip()?.turnToPage(index);
    } catch {
      // Ignore if flipbook isn't ready
    }
  };

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
      title: "Yeni Anımız",
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

  const handleDeletePage = async (pageId: string) => {
    if (pages.length <= 2) {
      setUploadError("Anı kitabında en az 2 sayfa bulunmalıdır.");
      return;
    }
    const remaining = await deleteCoupleBookPage(coupleId, pageId);
    onPagesChange(remaining);
    setEditingPage(null);
  };

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
      className={`mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 ${
        isFullPageView ? "pt-6 pb-28" : "pt-4 pb-12"
      }`}
    >
      {/* Editorial Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
            Anı Kitabımız
          </h2>
          <p className="text-[13px] text-[#A1A1A6] mt-0.5">
            Sayfaları çevirin, yeni anılar ekleyin veya mevcut sayfaları düzenleyin
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenPhotoUploadModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-3.5 py-2 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <ImageIcon className="h-3.5 w-3.5 text-[#A1A1A6]" />
            <span>Fotoğraf Yükle</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAllPagesDrawer((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-3.5 py-2 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-[#A1A1A6]" />
            <span>Sayfa Dizini ({pages.length})</span>
          </button>

          <button
            type="button"
            onClick={handleAddNewPage}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3.5 py-2 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Yeni Sayfa</span>
          </button>
        </div>
      </div>

      {/* All Pages Overview & Reordering Drawer */}
      {showAllPagesDrawer && (
        <div className="mb-6 rounded-xl border border-[#343438] bg-[#18181B] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-semibold text-[#F5F5F7]">
                Sayfa Dizini ve Sıralama ({pages.length} Sayfa)
              </h3>
              <p className="text-[12px] text-[#A1A1A6]">
                Bir sayfaya geçiş yapmak için tıklayın veya sıralamayı değiştirin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllPagesDrawer(false)}
              className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className={`rounded-lg border p-3 transition-apple flex flex-col justify-between ${
                  idx === currentPageIndex
                    ? "border-[#D88A96] bg-[#222226]"
                    : "border-[#343438] bg-[#101012] hover:border-[#A1A1A6]/40"
                }`}
              >
                <div onClick={() => jumpToPage(idx)} className="cursor-pointer">
                  <div className="flex items-center justify-between text-[11px] text-[#A1A1A6] mb-1">
                    <span className="font-medium text-[#D88A96]">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate ml-2">{p.date}</span>
                  </div>
                  <div className="text-[13px] font-medium text-[#F5F5F7] truncate mb-2">
                    {p.title.replace(/\s*♡/g, "")}
                  </div>
                  {p.photoUrl && (
                    <div className="aspect-[4/3] w-full overflow-hidden rounded bg-[#18181B] mb-2">
                      <img
                        src={p.photoUrl}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#343438]/70">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => void handleMovePageOrder(p.id, "prev")}
                      title="Önceki sıraya taşı"
                      className="rounded p-1 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === pages.length - 1}
                      onClick={() => void handleMovePageOrder(p.id, "next")}
                      title="Sonraki sıraya taşı"
                      className="rounded p-1 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingPage(p)}
                    className="inline-flex items-center gap-1 rounded bg-[#222226] hover:bg-[#343438] px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7] cursor-pointer"
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

      {/* Centerpiece Physical Book Container */}
      <div className="relative flex items-center justify-center">
        {/* Previous Page Button */}
        <button
          type="button"
          onClick={goPrevPage}
          aria-label="Önceki Sayfa"
          className="z-20 mr-2 sm:mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#343438] bg-[#18181B] text-[#F5F5F7] hover:bg-[#222226] hover:border-[#A1A1A6]/50 transition-apple cursor-pointer"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Fine Linen Monograph Binding Frame */}
        <div className="relative w-full max-w-[1040px] rounded-xl bg-[#201F22] p-2 sm:p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] border border-[#343438]">
          <div className="rounded-[6px] bg-[#D8D0C5] p-[2px] sm:p-[3px]">
            <div className="relative overflow-hidden rounded-[4px] bg-[#F3EFEA]">
              {pages.length > 0 && (
                <HTMLFlipBook
                  key={`${coupleId}-${pages.length}-${
                    isMobilePortrait ? "mobile" : "desktop"
                  }-${isFullPageView ? "full" : "home"}`}
                  ref={flipBookRef}
                  width={isMobilePortrait ? 330 : 480}
                  height={isMobilePortrait ? 295 : isFullPageView ? 315 : 260}
                  size="stretch"
                  minWidth={280}
                  maxWidth={540}
                  minHeight={240}
                  maxHeight={isFullPageView ? 350 : 285}
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
                      onEditPage={(target) => setEditingPage(target)}
                    />
                  ))}
                </HTMLFlipBook>
              )}

              {/* Subtle Book Spine Crease (Desktop 2-Page Spread) */}
              {!isMobilePortrait && (
                <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-gradient-to-r from-[#1C1917]/25 via-[#1C1917]/40 to-white/30 z-20" />
              )}
            </div>
          </div>
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={goNextPage}
          aria-label="Sonraki Sayfa"
          className="z-20 ml-2 sm:ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#343438] bg-[#18181B] text-[#F5F5F7] hover:bg-[#222226] hover:border-[#A1A1A6]/50 transition-apple cursor-pointer"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Apple Pages-Style Clean Inspector Modal for Editing a Book Page */}
      {editingPage && (
        <div
          onClick={() => {
            setEditingPage(null);
            setUploadError(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#343438] bg-[#18181B] p-6 text-[#F5F5F7] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#343438] pb-4 mb-5">
              <div>
                <h3 className="text-[18px] font-semibold text-[#F5F5F7]">
                  Sayfa {String(editingPage.order + 1).padStart(2, "0")} Düzenleyici
                </h3>
                <p className="text-[12px] text-[#A1A1A6] mt-0.5">
                  Değişiklikleriniz otomatik olarak kaydedilir.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {autoSaveStatus === "saved" && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-[#D88A96]">
                    <Check className="h-3.5 w-3.5" />
                    Kaydedildi
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingPage(null);
                    setUploadError(null);
                  }}
                  className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Sayfa Başlığı
                  </label>
                  <input
                    type="text"
                    value={editingPage.title}
                    onChange={(e) =>
                      void handleUpdateEditingPage({ title: e.target.value })
                    }
                    placeholder="Bizim Hikayemiz"
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Tarih
                  </label>
                  <input
                    type="text"
                    value={editingPage.date}
                    onChange={(e) =>
                      void handleUpdateEditingPage({ date: e.target.value })
                    }
                    placeholder="14 Ağustos 2025"
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                  Anı Metni
                </label>
                <textarea
                  rows={3}
                  value={editingPage.content}
                  onChange={(e) =>
                    void handleUpdateEditingPage({ content: e.target.value })
                  }
                  placeholder="Seninle tanıştığım o günü hiçbir zaman unutmayacağım."
                  className="w-full rounded-lg border border-[#343438] bg-[#101012] p-3.5 text-[14px] leading-relaxed text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                />
              </div>

              {/* Page Image Selection / Upload */}
              <div className="rounded-xl border border-[#343438] bg-[#101012] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-[13px] font-medium text-[#F5F5F7]">
                    Sayfa Görseli
                  </span>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer transition-apple">
                      <Upload className="h-3.5 w-3.5" />
                      <span>
                        {uploadingPagePhoto
                          ? "Optimize Ediliyor..."
                          : "Bilgisayardan Yükle"}
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
                        className="inline-flex items-center gap-1 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-2.5 py-1.5 text-[12px] text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Görseli Kaldır</span>
                      </button>
                    )}
                  </div>
                </div>

                {uploadError && (
                  <p className="mb-3 rounded-lg border border-[#D88A96]/40 bg-[#18181B] px-3 py-2 text-[12px] text-[#F5F5F7]">
                    {uploadError}
                  </p>
                )}

                <div>
                  <p className="text-[12px] text-[#A1A1A6] mb-2">
                    Galeriden Seç ({photos.length} fotoğraf):
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
                          className={`relative aspect-square overflow-hidden rounded-md border-2 transition-apple cursor-pointer ${
                            isSelected
                              ? "border-[#D88A96]"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={photo.dataUrl}
                            alt={photo.title}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#343438]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={editingPage.order === 0}
                    onClick={() => void handleMovePageOrder(editingPage.id, "prev")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] px-3 py-1.5 text-[12px] text-[#F5F5F7] disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Önceki Sıra</span>
                  </button>

                  <button
                    type="button"
                    disabled={editingPage.order >= pages.length - 1}
                    onClick={() => void handleMovePageOrder(editingPage.id, "next")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] px-3 py-1.5 text-[12px] text-[#F5F5F7] disabled:opacity-35 cursor-pointer"
                  >
                    <span>Sonraki Sıra</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDeletePage(editingPage.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] px-3 py-1.5 text-[12px] font-medium text-[#D88A96] cursor-pointer"
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
                    className="rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer"
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
