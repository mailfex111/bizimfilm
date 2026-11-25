"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import BookPageCanvas from "@/components/book/BookPageCanvas";
import { type PageCanvasState } from "@/lib/bookCanvas";
import { type MediaItem, type MemoryPage } from "@/types";

interface BookPageFilmstripProps {
  pages: MemoryPage[];
  canvasByPageId: Record<string, PageCanvasState>;
  currentPageIndex: number;
  activePageId: string | null;
  isEditMode: boolean;
  isMobile: boolean;
  mediaById: Map<string, MediaItem>;
  signedUrls: Record<string, string>;
  onSelectPage: (index: number, pageId: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
}

export default function BookPageFilmstrip({
  pages,
  canvasByPageId,
  currentPageIndex,
  activePageId,
  isEditMode,
  isMobile,
  mediaById,
  signedUrls,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onReorderPages,
}: BookPageFilmstripProps) {
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const leftSpreadIdx = isMobile
    ? currentPageIndex
    : currentPageIndex % 2 === 0
    ? currentPageIndex
    : currentPageIndex - 1;
  const rightSpreadIdx = isMobile ? -1 : leftSpreadIdx + 1;

  return (
    <div
      aria-label="Sayfa şeridi"
      className="mt-2.5 rounded-xl border border-[#2B2B30] bg-[#151518]/95 px-2.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 text-[11px] text-[#A1A1A6]">
          <span className="font-medium text-[#F5F5F7]">
            Sayfalar ({pages.length})
          </span>
          <span className="hidden sm:inline text-[#74747C]">
            • Sürükleyip sıralayın veya sayfa seçin
          </span>
        </div>

        {/* Active page quick actions right in the strip header (clean & zero clutter on tiny thumbs) */}
        {activePageId && pages.length > 0 && (
          <div className="flex items-center gap-1">
            {(() => {
              const activeIdx = pages.findIndex((p) => p.id === activePageId);
              if (activeIdx < 0) return null;
              return (
                <>
                  <button
                    type="button"
                    disabled={activeIdx <= 0}
                    onClick={() => onReorderPages(activeIdx, activeIdx - 1)}
                    title="Sayfayı sola taşı"
                    aria-label="Sayfayı sola taşı"
                    className="rounded-md p-1 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activeIdx >= pages.length - 1}
                    onClick={() => onReorderPages(activeIdx, activeIdx + 1)}
                    title="Sayfayı sağa taşı"
                    aria-label="Sayfayı sağa taşı"
                    className="rounded-md p-1 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicatePage(activePageId)}
                    title="Seçili sayfayı çoğalt"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span className="hidden sm:inline">Çoğalt</span>
                  </button>
                  {confirmDeleteId === activePageId ? (
                    <div className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          onDeletePage(activePageId);
                          setConfirmDeleteId(null);
                        }}
                        className="font-medium text-rose-300 hover:text-rose-100 px-1 cursor-pointer"
                      >
                        Sil
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[#A1A1A6] hover:text-[#F5F5F7] px-1 cursor-pointer"
                      >
                        Vazgeç
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(activePageId)}
                      title="Seçili sayfayı sil"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-rose-300/85 hover:bg-rose-500/15 hover:text-rose-200 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Sil</span>
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Horizontal Scrollable Miniature Filmstrip */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1 pt-0.5">
        {pages.map((page, idx) => {
          const canvas = canvasByPageId[page.id];
          const isInOpenSpread = idx === leftSpreadIdx || idx === rightSpreadIdx;
          const isActive = activePageId === page.id;
          const isDropTarget = dragOverIdx === idx && dragFromIdx !== idx;

          return (
            <div
              key={page.id}
              draggable
              onDragStart={(e) => {
                setDragFromIdx(idx);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(idx));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIdx !== idx) setDragOverIdx(idx);
              }}
              onDragLeave={() => {
                if (dragOverIdx === idx) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from =
                  dragFromIdx !== null
                    ? dragFromIdx
                    : Number(e.dataTransfer.getData("text/plain"));
                setDragFromIdx(null);
                setDragOverIdx(null);
                if (!Number.isNaN(from) && from !== idx) {
                  onReorderPages(from, idx);
                }
              }}
              onDragEnd={() => {
                setDragFromIdx(null);
                setDragOverIdx(null);
              }}
              onClick={() => {
                setConfirmDeleteId(null);
                onSelectPage(idx, page.id);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPage(idx, page.id);
                }
              }}
              data-filmstrip-page-id={page.id}
              className={`group relative flex flex-col items-center shrink-0 rounded-lg p-1 transition-apple cursor-pointer ${
                isDropTarget
                  ? "ring-2 ring-[#F5F5F7] bg-[#26262C]"
                  : isActive && isEditMode
                  ? "bg-[#252226] ring-1 ring-[#D88A96]"
                  : isInOpenSpread
                  ? "bg-[#202025] ring-1 ring-[#484852]"
                  : "hover:bg-[#1E1E22]"
              }`}
            >
              {/* Miniature vertical A4 live thumbnail */}
              <div className="relative w-[40px] sm:w-[44px] aspect-[210/297] rounded-[3px] overflow-hidden shadow-md border border-black/30 pointer-events-none">
                {canvas && (
                  <BookPageCanvas
                    canvas={canvas}
                    pageNumber={idx + 1}
                    isLeftPage={idx % 2 === 0}
                    isSingleMobile={true}
                    mode="thumbnail"
                    mediaById={mediaById}
                    signedUrls={signedUrls}
                  />
                )}
              </div>

              <div className="mt-1 flex items-center gap-0.5 text-[10px] tabular-nums">
                <GripVertical className="h-2.5 w-2.5 text-[#62626A] opacity-0 group-hover:opacity-100 transition-opacity" />
                <span
                  className={
                    isActive || isInOpenSpread
                      ? "font-semibold text-[#F5F5F7]"
                      : "text-[#8E8E96]"
                  }
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
          );
        })}

        {/* Add New Page "+" Tile at End of Strip */}
        <button
          type="button"
          onClick={onAddPage}
          aria-label="Yeni sayfa ekle"
          title="Yeni sayfa ekle"
          className="flex flex-col items-center justify-center shrink-0 rounded-lg p-1 hover:bg-[#1E1E22] transition-apple cursor-pointer"
        >
          <div className="flex w-[40px] sm:w-[44px] aspect-[210/297] flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-[#3E3E46] hover:border-[#D88A96] bg-[#101012] text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple">
            <Plus className="h-4 w-4" />
          </div>
          <span className="mt-1 text-[10px] text-[#8E8E96]">Ekle</span>
        </button>
      </div>
    </div>
  );
}
