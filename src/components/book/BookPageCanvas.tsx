"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  Film,
  ImagePlus,
  Maximize2,
  MoveDiagonal2,
  Play,
  RotateCw,
  SplitSquareVertical,
} from "lucide-react";
import {
  clampCanvasElement,
  getFontCssFamily,
  getPaperPreset,
  round2,
  type CanvasElement,
  type PageCanvasState,
  type PhotoFrameStyle,
} from "@/lib/bookCanvas";
import { getSignedUrl } from "@/lib/storage";
import { type MediaItem } from "@/types";

export interface BookPageCanvasProps {
  canvas: PageCanvasState;
  pageNumber: number;
  isLeftPage: boolean;
  isSingleMobile?: boolean;
  mode: "read" | "edit" | "thumbnail";
  isActivePage?: boolean;
  selectedElementId?: string | null;
  cropElementId?: string | null;
  mediaById: Map<string, MediaItem>;
  signedUrls: Record<string, string>;
  onActivatePage?: () => void;
  onSelectElement?: (elementId: string | null) => void;
  onLiveElementChange?: (element: CanvasElement) => void;
  onCommitElementChange?: (element: CanvasElement) => void;
  onRequestSlotMedia?: (elementId: string, kind: "photo" | "video") => void;
  onMoveOverflowToNextPage?: (
    elementId: string,
    remainingText: string,
    overflowText: string
  ) => void;
  onExpandVideoFullscreen?: (media: MediaItem) => void;
}

type DragAction =
  | {
      type: "move";
      elementId: string;
      startX: number;
      startY: number;
      orig: CanvasElement;
    }
  | {
      type: "crop-pan";
      elementId: string;
      startX: number;
      startY: number;
      orig: CanvasElement;
    }
  | {
      type: "resize";
      handle: "nw" | "ne" | "sw" | "se" | "e" | "w";
      elementId: string;
      startX: number;
      startY: number;
      orig: CanvasElement;
      preserveAspect: boolean;
    }
  | {
      type: "rotate";
      elementId: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      orig: CanvasElement;
    };

function getFrameClasses(
  frameStyle?: PhotoFrameStyle,
  polaroid?: boolean
): string {
  if (polaroid) {
    return "bg-[#FAF8F4] shadow-[0_8px_22px_rgba(24,20,18,0.18)] border border-[#E6DFD5] rounded-[2px]";
  }
  switch (frameStyle) {
    case "thin":
      return "bg-[#FAF8F5] p-[2.2%] border border-[#DDD5C9] shadow-[0_5px_16px_rgba(24,20,18,0.09)] rounded-[2px]";
    case "double":
      return "bg-[#FAF8F5] p-[3%] border border-[#CFC5B7] ring-1 ring-inset ring-[#E9E2D8] shadow-[0_6px_18px_rgba(24,20,18,0.11)] rounded-[2px]";
    case "rounded":
      return "rounded-[10px] overflow-hidden shadow-[0_6px_18px_rgba(24,20,18,0.12)] border border-black/5";
    case "shadow":
      return "shadow-[0_14px_30px_rgba(24,20,18,0.22)] rounded-[3px]";
    case "none":
    default:
      return "rounded-[1px]";
  }
}

interface TextLayerBoxProps {
  el: CanvasElement;
  mode: "read" | "edit" | "thumbnail";
  isSelected: boolean;
  isEditingText: boolean;
  onStartEdit: () => void;
  onStopEdit: (finalText: string) => void;
  onLiveTextChange: (nextText: string) => void;
  onAutoExpand: (nextHeightPct: number) => void;
  onMoveOverflow?: (remainingText: string, overflowText: string) => void;
}

function TextLayerBox({
  el,
  mode,
  isSelected,
  isEditingText,
  onStartEdit,
  onStopEdit,
  onLiveTextChange,
  onAutoExpand,
  onMoveOverflow,
}: TextLayerBoxProps) {
  const displayRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const checkOverflow = useCallback(() => {
    if (mode !== "edit") return;
    const node = isEditingText ? textareaRef.current : displayRef.current;
    if (!node) return;
    setHasOverflow(node.scrollHeight > node.clientHeight + 4);
  }, [mode, isEditingText]);

  useEffect(() => {
    if (mode !== "edit") return;
    const node = isEditingText ? textareaRef.current : displayRef.current;
    if (!node) return;
    const raf = requestAnimationFrame(checkOverflow);
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [
    mode,
    isEditingText,
    el.text_content,
    el.width,
    el.height,
    el.style,
    checkOverflow,
  ]);

  useEffect(() => {
    if (isEditingText && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditingText]);

  const fontSize = Number(el.style.fontSize || 14);
  const lineHeight = Number(el.style.lineHeight || 1.55);
  const textStyle: React.CSSProperties = {
    fontFamily: getFontCssFamily(el.style.fontFamily),
    fontSize: `calc(${fontSize} / 420 * 100cqi)`,
    fontWeight: el.style.fontWeight === "bold" ? 600 : 400,
    fontStyle: el.style.fontStyle === "italic" ? "italic" : "normal",
    textDecoration:
      el.style.textDecoration === "underline" ? "underline" : "none",
    color: el.style.color || "#1C1917",
    textAlign: el.style.textAlign || "left",
    lineHeight,
    letterSpacing: el.style.role === "date" ? "0.12em" : undefined,
    textTransform: el.style.role === "date" ? "uppercase" : undefined,
  };

  const handleAutoExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const node = isEditingText ? textareaRef.current : displayRef.current;
    const pageEl = node?.closest("[data-book-page-id]") as HTMLElement | null;
    const pageHeight = pageEl?.getBoundingClientRect().height || 0;
    if (!node || pageHeight <= 0) return;
    const neededPct = ((node.scrollHeight + 10) / pageHeight) * 100;
    const maxAvail = Math.max(el.height, 96 - el.position_y);
    onAutoExpand(
      round2(Math.min(maxAvail, Math.max(el.height + 6, neededPct)))
    );
  };

  const handleSplitToNewPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onMoveOverflow) return;
    const node = isEditingText ? textareaRef.current : displayRef.current;
    const fullText = el.text_content || "";
    if (!node || !fullText.trim()) return;

    const ratio = Math.min(
      0.85,
      Math.max(0.25, node.clientHeight / Math.max(1, node.scrollHeight))
    );
    let splitIdx = Math.floor(fullText.length * ratio);
    const prevBreak = fullText.lastIndexOf("\n", splitIdx);
    const prevSpace = fullText.lastIndexOf(" ", splitIdx);
    if (prevBreak > fullText.length * 0.25) {
      splitIdx = prevBreak;
    } else if (prevSpace > fullText.length * 0.2) {
      splitIdx = prevSpace;
    }
    const remaining = fullText.slice(0, splitIdx).trimEnd();
    const overflow = fullText.slice(splitIdx).trimStart();
    if (overflow) {
      onMoveOverflow(remaining, overflow);
    }
  };

  return (
    <div className="relative h-full w-full">
      {isEditingText && mode === "edit" ? (
        <textarea
          ref={textareaRef}
          value={el.text_content}
          onChange={(e) => onLiveTextChange(e.target.value)}
          onBlur={() => onStopEdit(el.text_content)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onStopEdit(el.text_content);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={textStyle}
          placeholder="Yazınızı girin..."
          className="h-full w-full resize-none bg-transparent outline-none overflow-y-auto whitespace-pre-wrap break-words p-[2px]"
        />
      ) : (
        <div
          ref={displayRef}
          onDoubleClick={(e) => {
            if (mode !== "edit") return;
            e.stopPropagation();
            onStartEdit();
          }}
          style={textStyle}
          className={`h-full w-full whitespace-pre-wrap break-words p-[2px] ${
            mode === "read" ? "overflow-visible" : "overflow-hidden"
          }`}
        >
          {el.text_content ||
            (mode === "edit" ? (
              <span className="opacity-45 italic">Çift tıklayıp yazın...</span>
            ) : null)}
        </div>
      )}

      {/* Non-destructive overflow recovery pill (never truncates text silently with "...") */}
      {mode === "edit" && hasOverflow && (isSelected || isEditingText) && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1.5 z-40 flex flex-wrap items-center gap-1 rounded-lg border border-amber-500/50 bg-[#18181B]/95 px-2 py-1 text-[10px] text-[#F5F5F7] shadow-lg backdrop-blur-sm whitespace-nowrap"
        >
          <span className="inline-flex items-center gap-1 text-amber-300 font-medium mr-1">
            <AlertCircle className="h-3 w-3" />
            Metin taşıyor
          </span>
          <button
            type="button"
            onClick={handleAutoExpand}
            className="inline-flex items-center gap-1 rounded bg-[#27272C] hover:bg-[#343438] px-1.5 py-0.5 text-[10px] text-[#F5F5F7] cursor-pointer"
          >
            <ArrowDownToLine className="h-2.5 w-2.5" />
            Kutuyu büyüt
          </button>
          {onMoveOverflow && (
            <button
              type="button"
              onClick={handleSplitToNewPage}
              className="inline-flex items-center gap-1 rounded bg-[#D88A96] hover:bg-[#e19ca7] px-1.5 py-0.5 text-[10px] font-medium text-[#101012] cursor-pointer"
            >
              <SplitSquareVertical className="h-2.5 w-2.5" />
              Yeni sayfaya taşı
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface InlineVideoPlayerProps {
  media: MediaItem;
  posterUrl: string | null;
  mode: "read" | "edit" | "thumbnail";
  onExpandFullscreen?: (media: MediaItem) => void;
}

function InlineVideoPlayer({
  media,
  posterUrl,
  mode,
  onExpandFullscreen,
}: InlineVideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const handleStartInlinePlay = async (
    e: React.MouseEvent | React.PointerEvent
  ) => {
    e.stopPropagation();
    if (mode !== "read") return;
    if (videoSrc) {
      setPlaying(true);
      return;
    }
    setLoadingUrl(true);
    const url = await getSignedUrl("couple-videos", media.storage_path);
    setLoadingUrl(false);
    if (url) {
      setVideoSrc(url);
      setPlaying(true);
    }
  };

  if (mode === "read" && playing && videoSrc) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="relative h-full w-full bg-black overflow-hidden"
      >
        <video
          src={videoSrc}
          poster={posterUrl || undefined}
          controls
          autoPlay
          playsInline
          className="h-full w-full object-contain bg-black"
        />
        {onExpandFullscreen && (
          <button
            type="button"
            title="Tam ekranda aç"
            onClick={(e) => {
              e.stopPropagation();
              onExpandFullscreen(media);
            }}
            className="absolute top-1.5 right-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-md bg-black/65 text-white/90 hover:bg-black cursor-pointer"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#18181B] overflow-hidden">
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={media.title || "Video"}
          draggable={false}
          className="h-full w-full object-cover opacity-90 select-none"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#1D1C20] text-[#A1A1A6]">
          <Film className="h-6 w-6 opacity-60" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        {mode === "read" ? (
          <button
            type="button"
            aria-label="Videoyu oynat"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => void handleStartInlinePlay(e)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#101012]/80 hover:bg-[#101012] border border-white/25 text-white shadow-lg transition-apple cursor-pointer"
          >
            {loadingUrl ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Play className="h-4 w-4 fill-white ml-0.5" />
            )}
          </button>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#101012]/75 border border-white/25 text-white pointer-events-none">
            <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
          </span>
        )}
      </div>
    </div>
  );
}

interface CanvasElementItemProps {
  el: CanvasElement;
  mode: "read" | "edit" | "thumbnail";
  isDarkPaper: boolean;
  isSelected: boolean;
  isCropping: boolean;
  isEditingThisText: boolean;
  activeRotationBadge: number | null;
  mediaItem?: MediaItem;
  mediaUrl: string | null;
  onActivatePage?: () => void;
  onSelectElement?: (elementId: string | null) => void;
  onStartTextEdit: (elementId: string) => void;
  onStopTextEdit: () => void;
  onLiveElementChange?: (element: CanvasElement) => void;
  onCommitElementChange?: (element: CanvasElement) => void;
  onRequestSlotMedia?: (elementId: string, kind: "photo" | "video") => void;
  onMoveOverflowToNextPage?: (
    elementId: string,
    remainingText: string,
    overflowText: string
  ) => void;
  onExpandVideoFullscreen?: (media: MediaItem) => void;
  onBeginDragAction: (action: DragAction) => void;
  onTouchStartElement: (e: React.TouchEvent, el: CanvasElement) => void;
  onTouchMoveElement: (e: React.TouchEvent) => void;
  onTouchEndElement: () => void;
}

function CanvasElementItem({
  el,
  mode,
  isDarkPaper,
  isSelected,
  isCropping,
  isEditingThisText,
  activeRotationBadge,
  mediaItem,
  mediaUrl,
  onActivatePage,
  onSelectElement,
  onStartTextEdit,
  onStopTextEdit,
  onLiveElementChange,
  onCommitElementChange,
  onRequestSlotMedia,
  onMoveOverflowToNextPage,
  onExpandVideoFullscreen,
  onBeginDragAction,
  onTouchStartElement,
  onTouchMoveElement,
  onTouchEndElement,
}: CanvasElementItemProps) {
  const isMedia = el.element_type === "photo" || el.element_type === "video";
  const isPolaroid = Boolean(el.style.polaroid);
  const cropX = Number(el.style.cropX ?? 50);
  const cropY = Number(el.style.cropY ?? 50);
  const cropZoom = Number(el.style.cropZoom ?? 1);

  return (
    <div
      data-canvas-element-id={el.id}
      data-canvas-element-type={el.element_type}
      style={{
        position: "absolute",
        left: `${el.position_x}%`,
        top: `${el.position_y}%`,
        width: `${el.width}%`,
        height: `${el.height}%`,
        transform: `rotate(${el.rotation || 0}deg)`,
        transformOrigin: "center center",
        zIndex: isSelected ? 35 : Math.max(1, Math.min(30, el.layer_order || 1)),
        touchAction: mode === "edit" ? "none" : "auto",
      }}
      onPointerDown={(e) => {
        if (mode !== "edit") return;
        e.stopPropagation();
        onActivatePage?.();

        // Mobile quick-edit: tapping an already-selected text box enters inline text edit
        if (
          el.element_type === "text" &&
          isSelected &&
          e.pointerType === "touch" &&
          !isEditingThisText
        ) {
          onStartTextEdit(el.id);
          return;
        }

        onSelectElement?.(el.id);
        if (isEditingThisText) return;

        // Clicking an empty media slot from a template opens media picker immediately
        if (isMedia && !el.media_id && onRequestSlotMedia) {
          onRequestSlotMedia(
            el.id,
            el.element_type === "video" ? "video" : "photo"
          );
          return;
        }

        onBeginDragAction({
          type: isCropping ? "crop-pan" : "move",
          elementId: el.id,
          startX: e.clientX,
          startY: e.clientY,
          orig: el,
        });
      }}
      onDoubleClick={(e) => {
        if (mode !== "edit" || el.element_type !== "text") return;
        e.stopPropagation();
        onActivatePage?.();
        onSelectElement?.(el.id);
        onStartTextEdit(el.id);
      }}
      onTouchStart={(e) => onTouchStartElement(e, el)}
      onTouchMove={onTouchMoveElement}
      onTouchEnd={onTouchEndElement}
      className={`${
        mode === "edit"
          ? isCropping
            ? "cursor-grab active:cursor-grabbing"
            : isEditingThisText
            ? "cursor-text"
            : "cursor-move"
          : ""
      }`}
    >
      {/* Element Content */}
      {el.element_type === "photo" ? (
        <div
          className={`h-full w-full flex flex-col ${getFrameClasses(
            el.style.frameStyle,
            isPolaroid
          )} ${isPolaroid ? "p-[4%] pb-[13%]" : ""}`}
        >
          <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#1D1C1E]/10">
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt={mediaItem?.title || el.style.polaroidCaption || "Anı"}
                draggable={false}
                style={{
                  objectPosition: `${cropX}% ${cropY}%`,
                  transform: `scale(${cropZoom})`,
                  transformOrigin: `${cropX}% ${cropY}%`,
                }}
                className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
              />
            ) : (
              <div
                className={`absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed ${
                  isDarkPaper
                    ? "border-white/25 bg-white/5 text-white/60"
                    : "border-[#BEB4A6] bg-[#EAE3D8]/70 text-[#78716A]"
                }`}
              >
                {mode !== "thumbnail" && (
                  <>
                    <ImagePlus className="h-5 w-5 opacity-75" />
                    <span
                      style={{ fontSize: "calc(11 / 420 * 100cqi)" }}
                      className="px-2 text-center font-medium"
                    >
                      {el.style.placeholderLabel || "Fotoğraf ekle"}
                    </span>
                  </>
                )}
              </div>
            )}

            {isCropping && (
              <div className="pointer-events-none absolute inset-0 border-2 border-[#D88A96] bg-black/10">
                <div className="grid h-full w-full grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/30" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {isPolaroid && mode !== "thumbnail" && (
            <div
              onPointerDown={(e) => {
                if (mode === "edit") e.stopPropagation();
              }}
              className="mt-[4%] flex items-center justify-center"
            >
              {mode === "edit" && isSelected ? (
                <input
                  type="text"
                  value={el.style.polaroidCaption || ""}
                  onChange={(e) => {
                    onLiveElementChange?.({
                      ...el,
                      style: { ...el.style, polaroidCaption: e.target.value },
                    });
                  }}
                  onBlur={(e) => {
                    onCommitElementChange?.({
                      ...el,
                      style: { ...el.style, polaroidCaption: e.target.value },
                    });
                  }}
                  placeholder="Polaroid notu..."
                  style={{
                    fontFamily: getFontCssFamily("playfair"),
                    fontSize: "calc(11.5 / 420 * 100cqi)",
                  }}
                  className="w-full bg-transparent text-center italic text-[#3F3A35] placeholder:text-[#A39A90] focus:outline-none"
                />
              ) : (
                <span
                  style={{
                    fontFamily: getFontCssFamily("playfair"),
                    fontSize: "calc(11.5 / 420 * 100cqi)",
                  }}
                  className="w-full text-center italic text-[#3F3A35] truncate"
                >
                  {el.style.polaroidCaption || ""}
                </span>
              )}
            </div>
          )}
        </div>
      ) : el.element_type === "video" ? (
        <div
          className={`h-full w-full overflow-hidden ${getFrameClasses(
            el.style.frameStyle || "rounded",
            false
          )}`}
        >
          {mediaItem ? (
            <InlineVideoPlayer
              media={mediaItem}
              posterUrl={mediaUrl}
              mode={mode}
              onExpandFullscreen={onExpandVideoFullscreen}
            />
          ) : (
            <div
              className={`flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed ${
                isDarkPaper
                  ? "border-white/25 bg-white/5 text-white/60"
                  : "border-[#BEB4A6] bg-[#EAE3D8]/70 text-[#78716A]"
              }`}
            >
              {mode !== "thumbnail" && (
                <>
                  <Film className="h-5 w-5 opacity-75" />
                  <span
                    style={{ fontSize: "calc(11 / 420 * 100cqi)" }}
                    className="px-2 text-center font-medium"
                  >
                    {el.style.placeholderLabel || "Video ekle"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <TextLayerBox
          el={el}
          mode={mode}
          isSelected={isSelected}
          isEditingText={isEditingThisText}
          onStartEdit={() => onStartTextEdit(el.id)}
          onStopEdit={(finalText) => {
            onStopTextEdit();
            onCommitElementChange?.({ ...el, text_content: finalText });
          }}
          onLiveTextChange={(nextText) => {
            onLiveElementChange?.({ ...el, text_content: nextText });
          }}
          onAutoExpand={(nextHeightPct) => {
            onCommitElementChange?.(
              clampCanvasElement({ ...el, height: nextHeightPct })
            );
          }}
          onMoveOverflow={
            onMoveOverflowToNextPage
              ? (remaining, overflow) =>
                  onMoveOverflowToNextPage(el.id, remaining, overflow)
              : undefined
          }
        />
      )}

      {/* Crisp Selection Frame + Corner / Rotate Handles (Hidden when deselected or in Read Mode) */}
      {isSelected && (
        <>
          <div className="pointer-events-none absolute -inset-[1px] border border-[#D88A96] rounded-[2px] shadow-[0_0_0_1px_rgba(16,16,18,0.28)]" />

          {!isEditingThisText && !isCropping && (
            <div className="absolute left-1/2 -top-7 -translate-x-1/2 flex flex-col items-center">
              <button
                type="button"
                aria-label="Döndür"
                title="Döndürmek için sürükleyin"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const box = (
                    e.currentTarget.parentElement?.parentElement as HTMLElement
                  )?.getBoundingClientRect();
                  if (!box) return;
                  const cx = box.left + box.width / 2;
                  const cy = box.top + box.height / 2;
                  const startAngle =
                    (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) /
                    Math.PI;
                  onBeginDragAction({
                    type: "rotate",
                    elementId: el.id,
                    centerX: cx,
                    centerY: cy,
                    startAngle,
                    orig: el,
                  });
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-[#D88A96] bg-[#18181B] text-[#F5F5F7] shadow-md hover:bg-[#D88A96] hover:text-[#101012] cursor-grab active:cursor-grabbing"
              >
                <RotateCw className="h-2.5 w-2.5" />
              </button>
              <div className="h-2 w-px bg-[#D88A96]" />
              {activeRotationBadge !== null && (
                <span className="absolute -top-6 rounded bg-[#18181B] px-1.5 py-0.5 text-[10px] font-medium text-[#F5F5F7] shadow border border-[#343438] tabular-nums">
                  {activeRotationBadge}°
                </span>
              )}
            </div>
          )}

          {!isCropping &&
            (["nw", "ne", "sw", "se"] as const).map((corner) => {
              const posClass =
                corner === "nw"
                  ? "-top-1.5 -left-1.5 cursor-nwse-resize"
                  : corner === "ne"
                  ? "-top-1.5 -right-1.5 cursor-nesw-resize"
                  : corner === "sw"
                  ? "-bottom-1.5 -left-1.5 cursor-nesw-resize"
                  : "-bottom-1.5 -right-1.5 cursor-nwse-resize";
              return (
                <button
                  key={corner}
                  type="button"
                  aria-label={`Boyutlandır (${corner})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onBeginDragAction({
                      type: "resize",
                      handle: corner,
                      elementId: el.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      orig: el,
                      preserveAspect: isMedia,
                    });
                  }}
                  className={`absolute ${posClass} h-3.5 w-3.5 rounded-full border-2 border-[#D88A96] bg-white shadow-sm hover:scale-110`}
                />
              );
            })}

          {el.element_type === "text" &&
            !isEditingThisText &&
            (["w", "e"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-label={`Genişlik (${side})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onBeginDragAction({
                    type: "resize",
                    handle: side,
                    elementId: el.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    orig: el,
                    preserveAspect: false,
                  });
                }}
                className={`absolute top-1/2 -translate-y-1/2 ${
                  side === "w" ? "-left-1" : "-right-1"
                } h-4 w-2 rounded-full border border-[#D88A96] bg-white shadow-sm cursor-ew-resize`}
              />
            ))}

          {isCropping && (
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[#101012]/80 px-2 py-0.5 text-[10px] text-[#F5F5F7] whitespace-nowrap">
              <MoveDiagonal2 className="h-2.5 w-2.5 text-[#D88A96]" />
              Kadrajı sürükle
            </div>
          )}
        </>
      )}
    </div>
  );
}

const BookPageCanvas = React.forwardRef<HTMLDivElement, BookPageCanvasProps>(
  function BookPageCanvas(
    {
      canvas,
      pageNumber,
      isLeftPage,
      isSingleMobile = false,
      mode,
      isActivePage = false,
      selectedElementId = null,
      cropElementId = null,
      mediaById,
      signedUrls,
      onActivatePage,
      onSelectElement,
      onLiveElementChange,
      onCommitElementChange,
      onRequestSlotMedia,
      onMoveOverflowToNextPage,
      onExpandVideoFullscreen,
    },
    ref
  ) {
    const internalPageRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragAction | null>(null);
    const dragMovedRef = useRef(false);
    const latestElementRef = useRef<CanvasElement | null>(null);
    const pinchRef = useRef<{
      elementId: string;
      initialDist: number;
      initialAngle: number;
      orig: CanvasElement;
    } | null>(null);

    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [activeRotationBadge, setActiveRotationBadge] = useState<
      number | null
    >(null);

    const setMergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        internalPageRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    const preset = getPaperPreset(canvas.paperPreset);
    const paperBg = canvas.background || preset.background;
    const isDarkPaper = Boolean(preset.isDark);
    const sortedElements = React.useMemo(
      () => [...canvas.elements].sort((a, b) => a.layer_order - b.layer_order),
      [canvas.elements]
    );

    // Global pointermove / pointerup listeners for 60fps local editing (0 DB queries during drag)
    useEffect(() => {
      if (mode !== "edit") return;

      const handlePointerMove = (e: PointerEvent) => {
        const drag = dragRef.current;
        const pageNode = internalPageRef.current;
        if (!drag || !pageNode) return;

        const rect = pageNode.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        if (drag.type !== "rotate") {
          const distPx = Math.hypot(
            e.clientX - drag.startX,
            e.clientY - drag.startY
          );
          if (!dragMovedRef.current && distPx < 2.5) return;
        }
        dragMovedRef.current = true;

        let nextEl: CanvasElement = drag.orig;

        if (drag.type === "rotate") {
          const curAngle =
            (Math.atan2(e.clientY - drag.centerY, e.clientX - drag.centerX) *
              180) /
            Math.PI;
          let nextRot = drag.orig.rotation + (curAngle - drag.startAngle);
          while (nextRot > 180) nextRot -= 360;
          while (nextRot < -180) nextRot += 360;
          for (const snap of [0, 90, -90, 180, -180]) {
            if (Math.abs(nextRot - snap) < 3) {
              nextRot = snap;
              break;
            }
          }
          nextRot = round2(nextRot);
          setActiveRotationBadge(Math.round(nextRot));
          nextEl = clampCanvasElement({
            ...drag.orig,
            rotation: nextRot,
          });
        } else {
          const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
          const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

          if (drag.type === "move") {
            nextEl = clampCanvasElement({
              ...drag.orig,
              position_x: drag.orig.position_x + dxPct,
              position_y: drag.orig.position_y + dyPct,
            });
          } else if (drag.type === "crop-pan") {
            const origX = Number(drag.orig.style.cropX ?? 50);
            const origY = Number(drag.orig.style.cropY ?? 50);
            nextEl = {
              ...drag.orig,
              style: {
                ...drag.orig.style,
                cropX: round2(Math.min(100, Math.max(0, origX - dxPct * 1.6))),
                cropY: round2(Math.min(100, Math.max(0, origY - dyPct * 1.6))),
              },
            };
          } else if (drag.type === "resize") {
            const o = drag.orig;
            let x = o.position_x;
            let y = o.position_y;
            let w = o.width;
            let h = o.height;
            const aspectRatioPct = o.width / Math.max(1, o.height);

            if (drag.handle === "e") {
              w = o.width + dxPct;
            } else if (drag.handle === "w") {
              w = o.width - dxPct;
              x = o.position_x + (o.width - Math.max(14, w));
            } else {
              const isLeft = drag.handle === "nw" || drag.handle === "sw";
              const isTop = drag.handle === "nw" || drag.handle === "ne";

              const proposedW = isLeft ? o.width - dxPct : o.width + dxPct;
              const proposedH = isTop ? o.height - dyPct : o.height + dyPct;

              if (drag.preserveAspect) {
                const scaleW = proposedW / Math.max(1, o.width);
                const scaleH = proposedH / Math.max(1, o.height);
                const scale =
                  Math.abs(scaleW - 1) >= Math.abs(scaleH - 1)
                    ? scaleW
                    : scaleH;
                w = Math.max(12, Math.min(94, o.width * scale));
                h = w / aspectRatioPct;
                if (h > 90) {
                  h = 90;
                  w = h * aspectRatioPct;
                }
                if (isLeft) x = o.position_x + (o.width - w);
                if (isTop) y = o.position_y + (o.height - h);
              } else {
                w = Math.max(14, proposedW);
                h = Math.max(5, proposedH);
                if (isLeft) x = o.position_x + (o.width - w);
                if (isTop) y = o.position_y + (o.height - h);
              }
            }

            nextEl = clampCanvasElement({
              ...o,
              position_x: x,
              position_y: y,
              width: w,
              height: h,
            });
          }
        }

        latestElementRef.current = nextEl;
        onLiveElementChange?.(nextEl);
      };

      const handlePointerUp = () => {
        if (!dragRef.current) return;
        const committed = dragMovedRef.current ? latestElementRef.current : null;
        dragRef.current = null;
        dragMovedRef.current = false;
        latestElementRef.current = null;
        setActiveRotationBadge(null);
        if (committed) {
          onCommitElementChange?.(committed);
        }
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };
    }, [mode, onLiveElementChange, onCommitElementChange]);

    const handleElementTouchStart = useCallback(
      (e: React.TouchEvent, el: CanvasElement) => {
        if (mode !== "edit" || e.touches.length !== 2) return;
        e.stopPropagation();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY
        );
        const angle =
          (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) /
          Math.PI;
        pinchRef.current = {
          elementId: el.id,
          initialDist: Math.max(10, dist),
          initialAngle: angle,
          orig: el,
        };
        dragRef.current = null;
      },
      [mode]
    );

    const handleElementTouchMove = useCallback(
      (e: React.TouchEvent) => {
        const pinch = pinchRef.current;
        if (mode !== "edit" || !pinch || e.touches.length !== 2) return;
        e.stopPropagation();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY
        );
        const angle =
          (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) /
          Math.PI;

        const scale = Math.min(2.4, Math.max(0.35, dist / pinch.initialDist));
        const newW = Math.min(94, Math.max(12, pinch.orig.width * scale));
        const ratio = pinch.orig.width / Math.max(1, pinch.orig.height);
        const newH = Math.min(90, Math.max(8, newW / ratio));
        const dx = (pinch.orig.width - newW) / 2;
        const dy = (pinch.orig.height - newH) / 2;
        const deltaAngle = angle - pinch.initialAngle;

        const nextEl = clampCanvasElement({
          ...pinch.orig,
          position_x: pinch.orig.position_x + dx,
          position_y: pinch.orig.position_y + dy,
          width: newW,
          height: newH,
          rotation: round2(pinch.orig.rotation + deltaAngle),
        });
        latestElementRef.current = nextEl;
        onLiveElementChange?.(nextEl);
      },
      [mode, onLiveElementChange]
    );

    const handleElementTouchEnd = useCallback(() => {
      if (!pinchRef.current) return;
      const committed = latestElementRef.current;
      pinchRef.current = null;
      latestElementRef.current = null;
      if (committed) {
        onCommitElementChange?.(committed);
      }
    }, [onCommitElementChange]);

    const beginDragAction = useCallback((action: DragAction) => {
      latestElementRef.current = action.orig;
      dragMovedRef.current = false;
      dragRef.current = action;
    }, []);

    const handleStartTextEdit = useCallback((id: string) => {
      setEditingTextId(id);
    }, []);

    const handleStopTextEdit = useCallback(() => {
      setEditingTextId(null);
    }, []);

    const formattedPageNum = String(pageNumber).padStart(2, "0");
    const edgeClass = isSingleMobile
      ? "rounded-[4px]"
      : isLeftPage
      ? "rounded-l-[4px] border-r"
      : "rounded-r-[4px] border-l";

    return (
      <div
        ref={setMergedRef}
        data-book-page-id={mode === "thumbnail" ? undefined : canvas.pageId}
        data-book-page-side={
          mode === "thumbnail" ? undefined : isLeftPage ? "left" : "right"
        }
        data-book-page-active={
          mode === "thumbnail" ? undefined : isActivePage ? "true" : "false"
        }
        onPointerDown={() => {
          if (mode !== "edit") return;
          onActivatePage?.();
          onSelectElement?.(null);
          setEditingTextId(null);
        }}
        className="h-full w-full select-none"
      >
        {/* Inner container shields backgroundColor, borderColor & container-type from react-pageflip style overrides */}
        <div
          style={{
            backgroundColor: paperBg,
            borderColor: preset.borderColor,
            containerType: "inline-size",
          }}
          className={`relative h-full w-full overflow-hidden ${edgeClass} ${
            mode === "edit" && isActivePage
              ? "ring-2 ring-inset ring-[#D88A96]/85"
              : ""
          }`}
        >
        {/* Ultra-subtle archival paper fiber sheen */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-45"
          style={{
            backgroundImage: isDarkPaper
              ? "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)"
              : "radial-gradient(rgba(28,25,23,0.032) 0.75px, transparent 0), linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 55%, rgba(168,154,136,0.08) 100%)",
            backgroundSize: isDarkPaper ? "18px 18px" : "16px 16px, 100% 100%",
          }}
        />

        {/* Realistic center book crease & spine dip shadow */}
        {!isSingleMobile && mode !== "thumbnail" && (
          <div
            className={`pointer-events-none absolute inset-y-0 w-[10%] z-20 ${
              isLeftPage
                ? "right-0 bg-gradient-to-l from-[#1C1917]/[0.15] via-[#1C1917]/[0.045] to-transparent"
                : "left-0 bg-gradient-to-r from-[#1C1917]/[0.17] via-[#1C1917]/[0.05] to-transparent"
            }`}
          />
        )}

        {/* Outer paper edge subtle depth */}
        {mode !== "thumbnail" && (
          <div
            className={`pointer-events-none absolute inset-y-0 w-3 z-20 ${
              isLeftPage
                ? "left-0 bg-gradient-to-r from-[#1C1917]/[0.05] to-transparent"
                : "right-0 bg-gradient-to-l from-[#1C1917]/[0.05] to-transparent"
            }`}
          />
        )}

        {/* Subtle empty-page hint in Edit Mode */}
        {mode === "edit" && sortedElements.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center opacity-50">
            <p
              style={{
                color: preset.mutedColor,
                fontSize: "calc(13 / 420 * 100cqi)",
              }}
              className="font-medium"
            >
              Boş sayfa
            </p>
            <p
              style={{
                color: preset.mutedColor,
                fontSize: "calc(11 / 420 * 100cqi)",
              }}
              className="mt-1 max-w-[75%]"
            >
              Üst araç çubuğundan fotoğraf, video veya metin ekleyebilirsiniz.
            </p>
          </div>
        )}

        {/* Layered Canvas Elements */}
        {sortedElements.map((el) => {
          const mediaItem = el.media_id ? mediaById.get(el.media_id) : undefined;
          const mediaUrl = !mediaItem
            ? null
            : el.element_type === "video"
            ? (mediaItem.thumbnail_path && signedUrls[mediaItem.thumbnail_path]) ||
              null
            : signedUrls[mediaItem.storage_path] ||
              (mediaItem.thumbnail_path && signedUrls[mediaItem.thumbnail_path]) ||
              null;

          return (
            <CanvasElementItem
              key={el.id}
              el={el}
              mode={mode}
              isDarkPaper={isDarkPaper}
              isSelected={mode === "edit" && selectedElementId === el.id}
              isCropping={mode === "edit" && cropElementId === el.id}
              isEditingThisText={mode === "edit" && editingTextId === el.id}
              activeRotationBadge={
                mode === "edit" && selectedElementId === el.id
                  ? activeRotationBadge
                  : null
              }
              mediaItem={mediaItem}
              mediaUrl={mediaUrl}
              onActivatePage={onActivatePage}
              onSelectElement={onSelectElement}
              onStartTextEdit={handleStartTextEdit}
              onStopTextEdit={handleStopTextEdit}
              onLiveElementChange={onLiveElementChange}
              onCommitElementChange={onCommitElementChange}
              onRequestSlotMedia={onRequestSlotMedia}
              onMoveOverflowToNextPage={onMoveOverflowToNextPage}
              onExpandVideoFullscreen={onExpandVideoFullscreen}
              onBeginDragAction={beginDragAction}
              onTouchStartElement={handleElementTouchStart}
              onTouchMoveElement={handleElementTouchMove}
              onTouchEndElement={handleElementTouchEnd}
            />
          );
        })}

        {/* Minimal Page Number */}
        {mode !== "thumbnail" && (
          <span
            style={{
              color: preset.mutedColor,
              fontSize: "calc(10.5 / 420 * 100cqi)",
            }}
            className={`pointer-events-none absolute bottom-[2.2%] z-20 font-medium tabular-nums tracking-[0.12em] opacity-80 ${
              isSingleMobile
                ? "left-1/2 -translate-x-1/2"
                : isLeftPage
                ? "left-[6%]"
                : "right-[6%]"
            }`}
          >
            {formattedPageNum}
          </span>
        )}
        </div>
      </div>
    );
  }
);

export default BookPageCanvas;
