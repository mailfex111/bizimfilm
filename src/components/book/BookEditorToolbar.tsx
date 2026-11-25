"use client";

import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Check,
  Copy,
  Crop,
  Eye,
  Film,
  Frame,
  ImagePlus,
  Italic,
  LayoutGrid,
  Minus,
  MousePointer2,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Trash2,
  Type,
  Underline,
  Undo2,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import {
  BOOK_TEMPLATES,
  FRAME_OPTIONS,
  PAPER_PRESETS,
  TEXT_COLOR_SWATCHES,
  TEXT_FONT_OPTIONS,
  type BookTemplateId,
  type CanvasElement,
  type PaperPresetId,
  type TextAlignValue,
  type TextFontKey,
} from "@/lib/bookCanvas";
import { type MediaItem } from "@/types";

export type EditorSaveState =
  | "idle"
  | "saving"
  | "saved"
  | "offline"
  | "conflict"
  | "error";

export type ActiveToolbarPopover =
  | null
  | "photo"
  | "video"
  | "template"
  | "background";

interface BookEditorToolbarProps {
  activePopover: ActiveToolbarPopover;
  onChangePopover: (next: ActiveToolbarPopover) => void;
  activePageLabel: string;
  activePageHasContent: boolean;
  activePaperPreset: PaperPresetId;
  activeTemplateId: BookTemplateId;
  selectedElement: CanvasElement | null;
  cropElementId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  saveState: EditorSaveState;
  uploadingMedia: boolean;
  uploadError: string | null;
  photos: MediaItem[];
  videos: MediaItem[];
  signedUrls: Record<string, string>;
  onSelectTool: () => void;
  onPickGalleryMedia: (media: MediaItem) => void;
  onUploadMediaFile: (file: File, kind: "photo" | "video") => void;
  onAddText: () => void;
  onApplyTemplate: (templateId: BookTemplateId) => void;
  onChangePaperPreset: (presetId: PaperPresetId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onFinishEditing: () => void;
  onUpdateSelectedElement: (
    patch: Partial<CanvasElement>,
    stylePatch?: Partial<CanvasElement["style"]>,
    commit?: boolean
  ) => void;
  onToggleCropMode: (elementId: string | null) => void;
  onBringToFront: (elementId: string) => void;
  onSendToBack: (elementId: string) => void;
  onDuplicateElement: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
}

/** Crisp visual wireframe thumbnail for each of the 8 templates */
function TemplateMiniWireframe({ id }: { id: BookTemplateId }) {
  return (
    <div className="relative aspect-[210/297] w-full rounded-[3px] border border-[#3C3C42] bg-[#F5F0E6] p-1.5 overflow-hidden">
      {id === "blank" && (
        <div className="h-full w-full rounded-[2px] border border-dashed border-[#C7BEB0]" />
      )}
      {id === "single-photo" && (
        <div className="flex h-full flex-col gap-1">
          <div className="flex-[4] rounded-[2px] bg-[#CFC6B8]" />
          <div className="h-1 w-1/2 rounded bg-[#8C847B]/70" />
          <div className="h-1.5 w-4/5 rounded bg-[#4A443F]/75" />
        </div>
      )}
      {id === "photo-text" && (
        <div className="flex h-full flex-col gap-1">
          <div className="flex-[3] rounded-[2px] bg-[#CFC6B8]" />
          <div className="h-1 w-1/3 rounded bg-[#8C847B]/70 mt-0.5" />
          <div className="h-1.5 w-3/4 rounded bg-[#4A443F]/80" />
          <div className="space-y-0.5 mt-0.5">
            <div className="h-1 w-full rounded bg-[#8C847B]/55" />
            <div className="h-1 w-5/6 rounded bg-[#8C847B]/55" />
            <div className="h-1 w-2/3 rounded bg-[#8C847B]/55" />
          </div>
        </div>
      )}
      {id === "two-photos" && (
        <div className="flex h-full flex-col gap-1">
          <div className="flex-1 rounded-[2px] bg-[#CFC6B8]" />
          <div className="flex-1 rounded-[2px] bg-[#BEB5A6]" />
          <div className="h-1 w-3/5 rounded bg-[#4A443F]/70 mt-0.5" />
        </div>
      )}
      {id === "polaroid" && (
        <div className="flex h-full flex-col items-center justify-between py-0.5">
          <div className="w-[78%] rounded-[2px] bg-white p-1 pb-2.5 shadow-xs border border-[#DFD8CE]">
            <div className="aspect-[4/3] w-full bg-[#CFC6B8]" />
          </div>
          <div className="w-4/5 space-y-0.5 flex flex-col items-center">
            <div className="h-1.5 w-2/3 rounded bg-[#4A443F]/80" />
            <div className="h-1 w-full rounded bg-[#8C847B]/55" />
          </div>
        </div>
      )}
      {id === "full-text" && (
        <div className="flex h-full flex-col justify-center gap-1 px-0.5">
          <div className="h-1 w-1/3 rounded bg-[#8C847B]/70" />
          <div className="h-2 w-4/5 rounded bg-[#4A443F]/85 mb-0.5" />
          <div className="h-1 w-full rounded bg-[#8C847B]/55" />
          <div className="h-1 w-full rounded bg-[#8C847B]/55" />
          <div className="h-1 w-5/6 rounded bg-[#8C847B]/55" />
          <div className="h-1 w-full rounded bg-[#8C847B]/55" />
          <div className="h-1 w-3/4 rounded bg-[#8C847B]/55" />
        </div>
      )}
      {id === "video-note" && (
        <div className="flex h-full flex-col gap-1">
          <div className="flex-[2.6] rounded-[3px] bg-[#2D2C30] flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-white/80" />
          </div>
          <div className="h-1.5 w-3/4 rounded bg-[#4A443F]/80 mt-0.5" />
          <div className="h-1 w-full rounded bg-[#8C847B]/55" />
          <div className="h-1 w-2/3 rounded bg-[#8C847B]/55" />
        </div>
      )}
      {id === "minimal-collage" && (
        <div className="relative h-full w-full">
          <div className="absolute left-0 top-0 h-[48%] w-[64%] rounded-[2px] bg-[#CFC6B8] -rotate-2" />
          <div className="absolute right-0 top-[36%] h-[40%] w-[60%] rounded-[2px] bg-[#B7AEA0] border border-white/80 rotate-2" />
          <div className="absolute bottom-0.5 left-0 right-0 h-1.5 w-3/4 rounded bg-[#4A443F]/75" />
        </div>
      )}
    </div>
  );
}

export default function BookEditorToolbar({
  activePopover,
  onChangePopover,
  activePageLabel,
  activePageHasContent,
  activePaperPreset,
  activeTemplateId,
  selectedElement,
  cropElementId,
  canUndo,
  canRedo,
  saveState,
  uploadingMedia,
  uploadError,
  photos,
  videos,
  signedUrls,
  onSelectTool,
  onPickGalleryMedia,
  onUploadMediaFile,
  onAddText,
  onApplyTemplate,
  onChangePaperPreset,
  onUndo,
  onRedo,
  onPreview,
  onFinishEditing,
  onUpdateSelectedElement,
  onToggleCropMode,
  onBringToFront,
  onSendToBack,
  onDuplicateElement,
  onDeleteElement,
}: BookEditorToolbarProps) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingTemplateConfirm, setPendingTemplateConfirm] =
    useState<BookTemplateId | null>(null);

  const togglePopover = (key: ActiveToolbarPopover) => {
    setPendingTemplateConfirm(null);
    onChangePopover(activePopover === key ? null : key);
  };

  const renderSaveStatus = () => {
    switch (saveState) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#A1A1A6] whitespace-nowrap">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[#D88A96] border-t-transparent" />
            Kaydediliyor...
          </span>
        );
      case "saved":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#D88A96] whitespace-nowrap">
            <Check className="h-3 w-3" />
            Kaydedildi
          </span>
        );
      case "offline":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 whitespace-nowrap">
            <WifiOff className="h-3 w-3" />
            Çevrimdışı
          </span>
        );
      case "conflict":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 whitespace-nowrap">
            <AlertTriangle className="h-3 w-3" />
            Çakışma
          </span>
        );
      case "error":
        return (
          <span className="text-[11px] text-rose-400 whitespace-nowrap">
            Kayıt hatası
          </span>
        );
      default:
        return (
          <span className="text-[11px] text-[#787880] whitespace-nowrap hidden sm:inline">
            Otomatik kayıt
          </span>
        );
    }
  };

  const toolBtnBase =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-apple whitespace-nowrap shrink-0 cursor-pointer";

  const isCroppingSelected =
    selectedElement && cropElementId === selectedElement.id;

  return (
    <div className="relative z-30 mb-3 space-y-2">
      {/* Hidden native file inputs for direct device uploads */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onUploadMediaFile(f, "photo");
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onUploadMediaFile(f, "video");
        }}
      />

      {/* Primary Studio Top Toolbar (Picsart / CapCut inspired — full-width scrollable tools on mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 rounded-xl border border-[#2E2E33] bg-[#18181B]/95 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md">
        {/* Scrollable Left/Center Creative Tools */}
        <div className="flex w-full sm:w-auto items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] py-0.5">
          <button
            type="button"
            onClick={() => {
              setPendingTemplateConfirm(null);
              onSelectTool();
            }}
            className={`${toolBtnBase} ${
              activePopover === null
                ? "bg-[#27272C] text-[#F5F5F7]"
                : "text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7]"
            }`}
            title="Seç ve taşı"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            <span>Seç</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover("photo")}
            className={`${toolBtnBase} ${
              activePopover === "photo"
                ? "bg-[#D88A96]/20 text-[#F5F5F7] ring-1 ring-[#D88A96]/50"
                : "text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7]"
            }`}
          >
            <ImagePlus className="h-3.5 w-3.5 text-[#D88A96]" />
            <span>Fotoğraf ekle</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover("video")}
            className={`${toolBtnBase} ${
              activePopover === "video"
                ? "bg-[#D88A96]/20 text-[#F5F5F7] ring-1 ring-[#D88A96]/50"
                : "text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7]"
            }`}
          >
            <Film className="h-3.5 w-3.5 text-[#D88A96]" />
            <span>Video ekle</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onChangePopover(null);
              onAddText();
            }}
            className={`${toolBtnBase} text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7]`}
          >
            <Type className="h-3.5 w-3.5" />
            <span>Metin ekle</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover("template")}
            className={`${toolBtnBase} ${
              activePopover === "template"
                ? "bg-[#D88A96]/20 text-[#F5F5F7] ring-1 ring-[#D88A96]/50"
                : "text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Şablonlar</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover("background")}
            className={`${toolBtnBase} ${
              activePopover === "background"
                ? "bg-[#D88A96]/20 text-[#F5F5F7] ring-1 ring-[#D88A96]/50"
                : "text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7]"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Arka plan</span>
          </button>

          <div className="mx-1 h-4 w-px bg-[#2E2E33] shrink-0" />

          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Geri al (Ctrl+Z)"
            aria-label="Geri al"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-apple shrink-0 cursor-pointer"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Geri al</span>
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="İleri al (Ctrl+Y)"
            aria-label="İleri al"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-apple shrink-0 cursor-pointer"
          >
            <Redo2 className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">İleri al</span>
          </button>
        </div>

        {/* Right Controls: Save Status, Preview, Finish */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 sm:border-l border-[#2E2E33] sm:pl-2">
          <div className="px-1">{renderSaveStatus()}</div>

          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] px-2.5 py-1.5 text-[12px] font-medium text-[#F5F5F7] transition-apple whitespace-nowrap cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-[#A1A1A6]" />
            <span className="hidden sm:inline">Önizleme</span>
          </button>

          <button
            type="button"
            onClick={onFinishEditing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[12px] font-medium text-[#101012] transition-apple whitespace-nowrap cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Düzenlemeyi bitir</span>
          </button>
        </div>
      </div>

      {/* Contextual Element Toolbar (Photo / Video / Text — shown ONLY when an element is selected) */}
      {selectedElement && (
        <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] rounded-xl border border-[#2E2E33] bg-[#141417]/95 px-2.5 py-1.5 text-[12px] shadow-md">
          {selectedElement.element_type === "photo" && (
            <>
              {/* Frame options */}
              <div className="flex items-center gap-1 shrink-0">
                <Frame className="h-3.5 w-3.5 text-[#A1A1A6] mr-0.5" />
                {FRAME_OPTIONS.map((f) => {
                  const active =
                    !selectedElement.style.polaroid &&
                    (selectedElement.style.frameStyle || "none") === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        onUpdateSelectedElement(
                          {},
                          { frameStyle: f.id, polaroid: false },
                          true
                        )
                      }
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-apple cursor-pointer ${
                        active
                          ? "bg-[#2B2B31] text-[#F5F5F7] ring-1 ring-[#D88A96]/60"
                          : "text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7]"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <div className="h-4 w-px bg-[#2E2E33] shrink-0 mx-0.5" />

              {/* Polaroid toggle */}
              <button
                type="button"
                onClick={() =>
                  onUpdateSelectedElement(
                    {},
                    {
                      polaroid: !selectedElement.style.polaroid,
                      frameStyle: !selectedElement.style.polaroid ? "shadow" : "thin",
                    },
                    true
                  )
                }
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-apple shrink-0 cursor-pointer ${
                  selectedElement.style.polaroid
                    ? "bg-[#D88A96] text-[#101012]"
                    : "bg-[#222226] text-[#F5F5F7] hover:bg-[#2C2C32]"
                }`}
              >
                Polaroid
              </button>

              {/* Crop toggle */}
              <button
                type="button"
                onClick={() =>
                  onToggleCropMode(isCroppingSelected ? null : selectedElement.id)
                }
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-apple shrink-0 cursor-pointer ${
                  isCroppingSelected
                    ? "bg-[#D88A96] text-[#101012]"
                    : "bg-[#222226] text-[#F5F5F7] hover:bg-[#2C2C32]"
                }`}
              >
                <Crop className="h-3 w-3" />
                <span>Kırp</span>
              </button>

              {/* Inline Crop Zoom / Focal Controls when Crop mode is active */}
              {isCroppingSelected && (
                <div className="flex items-center gap-2 rounded-lg bg-[#1D1D22] border border-[#343438] px-2.5 py-1 shrink-0">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#B4B4BC]">
                    <span>Yakınlaştır</span>
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.05}
                      value={Number(selectedElement.style.cropZoom ?? 1)}
                      onChange={(e) =>
                        onUpdateSelectedElement(
                          {},
                          { cropZoom: Number(e.target.value) },
                          false
                        )
                      }
                      onMouseUp={(e) =>
                        onUpdateSelectedElement(
                          {},
                          { cropZoom: Number((e.target as HTMLInputElement).value) },
                          true
                        )
                      }
                      onTouchEnd={(e) =>
                        onUpdateSelectedElement(
                          {},
                          { cropZoom: Number((e.target as HTMLInputElement).value) },
                          true
                        )
                      }
                      className="w-20 accent-[#D88A96]"
                    />
                    <span className="tabular-nums text-[10px] text-[#F5F5F7] w-7">
                      {Number(selectedElement.style.cropZoom ?? 1).toFixed(1)}x
                    </span>
                  </label>
                  <button
                    type="button"
                    title="Kadrajı sıfırla"
                    onClick={() =>
                      onUpdateSelectedElement(
                        {},
                        { cropX: 50, cropY: 50, cropZoom: 1 },
                        true
                      )
                    }
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[#A1A1A6] hover:bg-[#2A2A30] hover:text-[#F5F5F7] cursor-pointer"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Sıfırla
                  </button>
                </div>
              )}
            </>
          )}

          {selectedElement.element_type === "text" && (
            <>
              {/* Font family */}
              <select
                aria-label="Yazı tipi"
                value={selectedElement.style.fontFamily || "sf-pro"}
                onChange={(e) =>
                  onUpdateSelectedElement(
                    {},
                    { fontFamily: e.target.value as TextFontKey },
                    true
                  )
                }
                className="rounded-md border border-[#343438] bg-[#1E1E22] px-2 py-1 text-[11px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none shrink-0 cursor-pointer"
              >
                {TEXT_FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Font size stepper */}
              <div className="flex items-center rounded-md border border-[#343438] bg-[#1E1E22] shrink-0">
                <button
                  type="button"
                  aria-label="Yazıyı küçült"
                  onClick={() =>
                    onUpdateSelectedElement(
                      {},
                      {
                        fontSize: Math.max(
                          9,
                          Number(selectedElement.style.fontSize || 14) - 1
                        ),
                      },
                      true
                    )
                  }
                  className="px-1.5 py-1 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="px-1.5 text-[11px] tabular-nums text-[#F5F5F7] min-w-[26px] text-center">
                  {Math.round(Number(selectedElement.style.fontSize || 14))}
                </span>
                <button
                  type="button"
                  aria-label="Yazıyı büyült"
                  onClick={() =>
                    onUpdateSelectedElement(
                      {},
                      {
                        fontSize: Math.min(
                          44,
                          Number(selectedElement.style.fontSize || 14) + 1
                        ),
                      },
                      true
                    )
                  }
                  className="px-1.5 py-1 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              <div className="h-4 w-px bg-[#2E2E33] shrink-0" />

              {/* Bold / Italic / Underline */}
              <button
                type="button"
                aria-label="Kalın"
                onClick={() =>
                  onUpdateSelectedElement(
                    {},
                    {
                      fontWeight:
                        selectedElement.style.fontWeight === "bold"
                          ? "normal"
                          : "bold",
                    },
                    true
                  )
                }
                className={`rounded-md p-1.5 transition-apple shrink-0 cursor-pointer ${
                  selectedElement.style.fontWeight === "bold"
                    ? "bg-[#D88A96] text-[#101012]"
                    : "text-[#B4B4BC] hover:bg-[#222226]"
                }`}
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="İtalik"
                onClick={() =>
                  onUpdateSelectedElement(
                    {},
                    {
                      fontStyle:
                        selectedElement.style.fontStyle === "italic"
                          ? "normal"
                          : "italic",
                    },
                    true
                  )
                }
                className={`rounded-md p-1.5 transition-apple shrink-0 cursor-pointer ${
                  selectedElement.style.fontStyle === "italic"
                    ? "bg-[#D88A96] text-[#101012]"
                    : "text-[#B4B4BC] hover:bg-[#222226]"
                }`}
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Altı çizili"
                onClick={() =>
                  onUpdateSelectedElement(
                    {},
                    {
                      textDecoration:
                        selectedElement.style.textDecoration === "underline"
                          ? "none"
                          : "underline",
                    },
                    true
                  )
                }
                className={`rounded-md p-1.5 transition-apple shrink-0 cursor-pointer ${
                  selectedElement.style.textDecoration === "underline"
                    ? "bg-[#D88A96] text-[#101012]"
                    : "text-[#B4B4BC] hover:bg-[#222226]"
                }`}
              >
                <Underline className="h-3.5 w-3.5" />
              </button>

              <div className="h-4 w-px bg-[#2E2E33] shrink-0" />

              {/* Color swatches */}
              <div className="flex items-center gap-1 shrink-0">
                {TEXT_COLOR_SWATCHES.map((sw) => {
                  const active =
                    (selectedElement.style.color || "#1C1917").toLowerCase() ===
                    sw.hex.toLowerCase();
                  return (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.label}
                      aria-label={`Metin rengi ${sw.label}`}
                      onClick={() =>
                        onUpdateSelectedElement({}, { color: sw.hex }, true)
                      }
                      style={{ backgroundColor: sw.hex }}
                      className={`h-4 w-4 rounded-full border transition-apple cursor-pointer ${
                        active
                          ? "ring-2 ring-[#D88A96] ring-offset-1 ring-offset-[#141417] border-white"
                          : "border-[#55555E]"
                      }`}
                    />
                  );
                })}
              </div>

              <div className="h-4 w-px bg-[#2E2E33] shrink-0" />

              {/* Alignment */}
              {(
                [
                  { id: "left", icon: AlignLeft, label: "Sola hizala" },
                  { id: "center", icon: AlignCenter, label: "Ortala" },
                  { id: "right", icon: AlignRight, label: "Sağa hizala" },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  onClick={() =>
                    onUpdateSelectedElement(
                      {},
                      { textAlign: id as TextAlignValue },
                      true
                    )
                  }
                  className={`rounded-md p-1.5 transition-apple shrink-0 cursor-pointer ${
                    (selectedElement.style.textAlign || "left") === id
                      ? "bg-[#2B2B31] text-[#F5F5F7]"
                      : "text-[#A1A1A6] hover:bg-[#222226]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}

              {/* Line height */}
              <select
                aria-label="Satır aralığı"
                value={String(selectedElement.style.lineHeight || 1.55)}
                onChange={(e) =>
                  onUpdateSelectedElement(
                    {},
                    { lineHeight: Number(e.target.value) },
                    true
                  )
                }
                className="rounded-md border border-[#343438] bg-[#1E1E22] px-1.5 py-1 text-[11px] text-[#F5F5F7] shrink-0 cursor-pointer"
              >
                <option value="1.2">Satır 1.2</option>
                <option value="1.45">Satır 1.45</option>
                <option value="1.55">Satır 1.55</option>
                <option value="1.75">Satır 1.75</option>
                <option value="2">Satır 2.0</option>
              </select>
            </>
          )}

          {selectedElement.element_type === "video" && (
            <span className="text-[11px] text-[#A1A1A6] px-1 shrink-0">
              Video öğesi • Köşelerden boyutlandırın veya sürükleyin
            </span>
          )}

          {/* Common Layer + Duplicate + Delete Controls */}
          <div className="ml-auto flex items-center gap-1 pl-2 border-l border-[#2E2E33] shrink-0">
            <button
              type="button"
              title="En öne getir"
              aria-label="En öne getir"
              onClick={() => onBringToFront(selectedElement.id)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Öne getir</span>
            </button>
            <button
              type="button"
              title="En arkaya gönder"
              aria-label="En arkaya gönder"
              onClick={() => onSendToBack(selectedElement.id)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Arkaya</span>
            </button>
            <button
              type="button"
              title="Çoğalt"
              aria-label="Çoğalt"
              onClick={() => onDuplicateElement(selectedElement.id)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#B4B4BC] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Çoğalt</span>
            </button>
            <button
              type="button"
              title="Sil"
              aria-label="Öğeyi sil"
              onClick={() => onDeleteElement(selectedElement.id)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Sil</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Tool Popovers (Photo Picker, Video Picker, Visual Templates, Paper Background) */}
      {activePopover === "photo" && (
        <div className="rounded-xl border border-[#343438] bg-[#18181B]/98 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-[13px] font-semibold text-[#F5F5F7]">
                Fotoğraf Ekle • {activePageLabel}
              </h4>
              <p className="text-[11px] text-[#A1A1A6]">
                Galerinizden seçin veya cihazınızdan doğrudan yükleyin.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploadingMedia}
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[12px] font-medium text-[#101012] disabled:opacity-50 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {uploadingMedia ? "Yükleniyor..." : "Cihazdan yükle"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onChangePopover(null)}
                aria-label="Kapat"
                className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {uploadError && (
            <p className="mb-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-200">
              {uploadError}
            </p>
          )}

          <div className="text-[11px] font-medium text-[#A1A1A6] mb-2">
            Galeriden seç ({photos.length})
          </div>
          {photos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#343438] bg-[#101012] py-6 text-center text-[12px] text-[#A1A1A6]">
              Henüz galeri fotoğrafınız yok. Yukarıdan{" "}
              <strong className="text-[#F5F5F7]">Cihazdan yükle</strong> ile
              ekleyebilirsiniz.
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-44 overflow-y-auto pr-1">
              {photos.map((photo) => {
                const url =
                  (photo.thumbnail_path && signedUrls[photo.thumbnail_path]) ||
                  signedUrls[photo.storage_path];
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onPickGalleryMedia(photo)}
                    title={photo.title || "Fotoğraf ekle"}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-[#343438] hover:border-[#D88A96] bg-[#101012] transition-apple cursor-pointer"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={photo.title || "Fotoğraf"}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="h-full w-full bg-[#222226]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activePopover === "video" && (
        <div className="rounded-xl border border-[#343438] bg-[#18181B]/98 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-[13px] font-semibold text-[#F5F5F7]">
                Video Ekle • {activePageLabel}
              </h4>
              <p className="text-[11px] text-[#A1A1A6]">
                Galerinizden video seçin veya yeni video yükleyin (maks. 50 MB).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploadingMedia}
                onClick={() => videoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[12px] font-medium text-[#101012] disabled:opacity-50 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {uploadingMedia ? "Yükleniyor..." : "Cihazdan yükle"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onChangePopover(null)}
                aria-label="Kapat"
                className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {uploadError && (
            <p className="mb-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-200">
              {uploadError}
            </p>
          )}

          <div className="text-[11px] font-medium text-[#A1A1A6] mb-2">
            Galeriden seç ({videos.length})
          </div>
          {videos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#343438] bg-[#101012] py-6 text-center text-[12px] text-[#A1A1A6]">
              Henüz videonuz yok. Yukarıdan{" "}
              <strong className="text-[#F5F5F7]">Cihazdan yükle</strong> ile
              ekleyebilirsiniz.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-44 overflow-y-auto pr-1">
              {videos.map((video) => {
                const thumbUrl =
                  (video.thumbnail_path && signedUrls[video.thumbnail_path]) ||
                  null;
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => onPickGalleryMedia(video)}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-[#343438] hover:border-[#D88A96] bg-[#101012] text-left cursor-pointer"
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={video.title || "Video"}
                        className="h-full w-full object-cover opacity-85 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#222226] text-[#A1A1A6]">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-[10px] text-white truncate">
                      {video.title || "Video"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activePopover === "template" && (
        <div className="rounded-xl border border-[#343438] bg-[#18181B]/98 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-[13px] font-semibold text-[#F5F5F7]">
                Sayfa Şablonları • {activePageLabel}
              </h4>
              <p className="text-[11px] text-[#A1A1A6]">
                İsteğe bağlıdır — boş sayfada tamamen serbest tasarım da yapabilirsiniz.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingTemplateConfirm(null);
                onChangePopover(null);
              }}
              aria-label="Kapat"
              className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {pendingTemplateConfirm && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-[#101012] px-3 py-2 text-[12px]">
              <span className="text-[#F5F5F7]">
                {pendingTemplateConfirm === "blank"
                  ? "Bu sayfadaki mevcut öğeler temizlenip boş sayfaya geçilsin mi?"
                  : "Mevcut içerikler seçilen şablona göre yeniden düzenlensin mi?"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPendingTemplateConfirm(null)}
                  className="rounded-md border border-[#343438] px-2.5 py-1 text-[11px] text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyTemplate(pendingTemplateConfirm);
                    setPendingTemplateConfirm(null);
                    onChangePopover(null);
                  }}
                  className="rounded-md bg-[#F5F5F7] hover:bg-white px-2.5 py-1 text-[11px] font-medium text-[#101012] cursor-pointer"
                >
                  Uygula
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {BOOK_TEMPLATES.map((tpl) => {
              const isCurrent = activeTemplateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    if (activePageHasContent) {
                      setPendingTemplateConfirm(tpl.id);
                    } else {
                      onApplyTemplate(tpl.id);
                      onChangePopover(null);
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-apple cursor-pointer ${
                    isCurrent
                      ? "border-[#D88A96] bg-[#222226]"
                      : "border-[#2E2E33] bg-[#121215] hover:border-[#4A4A52]"
                  }`}
                >
                  <div className="w-full max-w-[54px]">
                    <TemplateMiniWireframe id={tpl.id} />
                  </div>
                  <span className="text-[10px] font-medium leading-tight text-[#F5F5F7]">
                    {tpl.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activePopover === "background" && (
        <div className="rounded-xl border border-[#343438] bg-[#18181B]/98 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-[13px] font-semibold text-[#F5F5F7]">
              Sayfa Kâğıdı • {activePageLabel}
            </h4>
            <button
              type="button"
              onClick={() => onChangePopover(null)}
              aria-label="Kapat"
              className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PAPER_PRESETS.map((preset) => {
              const active = activePaperPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChangePaperPreset(preset.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-apple cursor-pointer ${
                    active
                      ? "border-[#D88A96] bg-[#222226]"
                      : "border-[#2E2E33] bg-[#121215] hover:border-[#4A4A52]"
                  }`}
                >
                  <span
                    style={{ backgroundColor: preset.background }}
                    className="h-5 w-5 shrink-0 rounded-full border border-white/20 shadow-inner"
                  />
                  <span className="text-[11px] font-medium text-[#F5F5F7] truncate">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
