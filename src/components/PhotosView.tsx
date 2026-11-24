"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Trash2,
  BookOpen,
  Maximize2,
  Edit3,
  Check,
  X,
  AlertCircle,
  Search,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatBytes } from "@/lib/mediaOptimizer";
import {
  deleteCoupleMedia,
  getSignedUrl,
  getSignedUrlsBatch,
  uploadCoupleMedia,
} from "@/lib/storage";
import { type MediaItem, type MemoryBook } from "@/types";

interface PhotosViewProps {
  coupleId: string;
  photos: MediaItem[];
  activeBook: MemoryBook | null;
  autoOpenUpload?: boolean;
  onClearAutoOpen?: () => void;
  onPhotosChange: () => Promise<void>;
  onAddPhotoToBook: (photo: MediaItem) => Promise<void>;
}

interface UploadQueueItem {
  localId: string;
  file: File;
  progress: number;
  stage: string;
  status: "uploading" | "done" | "error" | "cancelled";
  error?: string;
  controller: AbortController;
}

export default function PhotosView({
  coupleId,
  photos,
  autoOpenUpload = false,
  onClearAutoOpen,
  onPhotosChange,
  onAddPhotoToBook,
}: PhotosViewProps) {
  const { storageBreakdown, refreshStorage } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<MediaItem | null>(null);
  const [resolvedLightbox, setResolvedLightbox] = useState<{
    mediaId: string;
    url: string | null;
  } | null>(null);
  const lightboxFullUrl =
    lightboxPhoto && resolvedLightbox?.mediaId === lightboxPhoto.id
      ? resolvedLightbox.url
      : null;

  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "memory_date">("newest");

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenUpload) {
      fileInputRef.current?.click();
      onClearAutoOpen?.();
    }
  }, [autoOpenUpload, onClearAutoOpen]);

  // Batch fetch private signed URLs for thumbnails (avoids N+1 storage calls)
  useEffect(() => {
    let active = true;
    const loadThumbs = async () => {
      const thumbPaths: string[] = [];
      const fallbackPaths: string[] = [];
      for (const p of photos) {
        if (p.thumbnail_path) thumbPaths.push(p.thumbnail_path);
        else fallbackPaths.push(p.storage_path);
      }

      const [tMap, fMap] = await Promise.all([
        thumbPaths.length > 0 ? getSignedUrlsBatch("thumbnails", thumbPaths) : {},
        fallbackPaths.length > 0
          ? getSignedUrlsBatch("couple-photos", fallbackPaths)
          : {},
      ]);
      if (active) {
        setThumbUrls({ ...fMap, ...tMap });
      }
    };
    void loadThumbs();
    return () => {
      active = false;
    };
  }, [photos]);

  // Resolve full-resolution signed URL on demand when lightbox opens
  useEffect(() => {
    if (!lightboxPhoto) return;
    let active = true;
    const targetId = lightboxPhoto.id;
    const loadFull = async () => {
      const full = await getSignedUrl("couple-photos", lightboxPhoto.storage_path);
      if (active) setResolvedLightbox({ mediaId: targetId, url: full });
    };
    void loadFull();
    return () => {
      active = false;
    };
  }, [lightboxPhoto]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 3600);
  };

  const quotaRatio = storageBreakdown
    ? storageBreakdown.total_used_bytes / Math.max(1, storageBreakdown.quota_bytes)
    : 0;
  const isQuotaFull = quotaRatio >= 1;

  const runSingleUpload = async (item: UploadQueueItem) => {
    try {
      await uploadCoupleMedia({
        coupleId,
        file: item.file,
        mediaType: "photo",
        title: item.file.name.replace(/\.[^.]+$/, ""),
        memoryDate: new Date().toISOString().slice(0, 10),
        signal: item.controller.signal,
        onProgress: (pct, stage) => {
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.localId === item.localId ? { ...q, progress: pct, stage } : q
            )
          );
        },
      });

      setUploadQueue((prev) =>
        prev.map((q) =>
          q.localId === item.localId
            ? { ...q, progress: 100, stage: "Kaydedildi", status: "done" }
            : q
        )
      );
      await Promise.all([onPhotosChange(), refreshStorage()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Yükleme başarısız.";
      const cancelled = msg.includes("iptal");
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.localId === item.localId
            ? {
                ...q,
                status: cancelled ? "cancelled" : "error",
                error: msg,
              }
            : q
        )
      );
    }
  };

  const enqueueFiles = (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    const newItems: UploadQueueItem[] = fileArr.map((file, idx) => ({
      localId: `${Date.now()}-${idx}-${file.name}`,
      file,
      progress: 5,
      stage: "Sıraya alındı...",
      status: "uploading",
      controller: new AbortController(),
    }));

    setUploadQueue((prev) => [...newItems, ...prev]);

    // Upload sequentially in small batches to keep main thread & quota smooth
    void (async () => {
      for (const item of newItems) {
        await runSingleUpload(item);
      }
    })();
  };

  const handleRetryItem = (item: UploadQueueItem) => {
    const refreshed: UploadQueueItem = {
      ...item,
      progress: 5,
      stage: "Yeniden deneniyor...",
      status: "uploading",
      error: undefined,
      controller: new AbortController(),
    };
    setUploadQueue((prev) =>
      prev.map((q) => (q.localId === item.localId ? refreshed : q))
    );
    void runSingleUpload(refreshed);
  };

  const handleCancelItem = (localId: string) => {
    setUploadQueue((prev) =>
      prev.map((q) => {
        if (q.localId === localId && q.status === "uploading") {
          q.controller.abort();
          return { ...q, status: "cancelled", stage: "İptal ediliyor..." };
        }
        return q;
      })
    );
  };

  const handleSaveEdit = async (photoId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("media")
      .update({
        title: editTitle.trim() || "Fotoğraf",
        description: editDesc.trim() || null,
        memory_date: editDate || null,
      })
      .eq("id", photoId);

    if (error) {
      showToast("Güncelleme başarısız: " + error.message);
      return;
    }

    setEditingPhotoId(null);
    await onPhotosChange();
    showToast("Fotoğraf bilgileri güncellendi.");
  };

  const handleDelete = async (photo: MediaItem) => {
    try {
      await deleteCoupleMedia(photo.id);
      if (lightboxPhoto?.id === photo.id) setLightboxPhoto(null);
      await Promise.all([onPhotosChange(), refreshStorage()]);
      showToast(`"${photo.title || "Fotoğraf"}" kalıcı olarak silindi.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Silme işlemi başarısız.");
    }
  };

  const filteredPhotos = photos
    .filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.memory_date || "").includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "memory_date") {
        return (b.memory_date || "").localeCompare(a.memory_date || "");
      }
      return b.created_at.localeCompare(a.created_at);
    });

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!isQuotaFull && e.dataTransfer.files?.length) {
          enqueueFiles(e.dataTransfer.files);
        }
      }}
      className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28"
    >
      {/* Archival Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#343438]/70 pb-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
              Fotoğraflar
            </h1>
            <span className="text-[14px] font-medium text-[#A1A1A6]">
              {photos.length} öğe
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[#A1A1A6]">
            Görseller EXIF konum bilgileri temizlenerek WebP formatına optimize edilir ve yalnızca ikinize özel depolanır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A1A1A6]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fotoğraflarda ara..."
              className="rounded-lg border border-[#343438] bg-[#18181B] pl-8 pr-3 py-2 text-[13px] text-[#F5F5F7] placeholder-[#A1A1A6]/60 focus:border-[#D88A96] focus:outline-none w-44 sm:w-52"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "memory_date")}
            aria-label="Sıralama"
            className="rounded-lg border border-[#343438] bg-[#18181B] px-3 py-2 text-[13px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
          >
            <option value="newest">Son Yüklenenler</option>
            <option value="memory_date">Anı Tarihine Göre</option>
          </select>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
            onChange={(e) => {
              if (e.target.files) enqueueFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          <button
            type="button"
            disabled={isQuotaFull}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white active:scale-[0.99] px-4 py-2 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            <span>Fotoğraf Yükle</span>
          </button>
        </div>
      </div>

      {/* Quota Warning (>= 80%) */}
      {quotaRatio >= 0.8 && storageBreakdown && (
        <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-[#D88A96]/40 bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]">
          <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0" />
          <span>
            {isQuotaFull
              ? "Depolama kotanız doldu. Yeni yükleme yapabilmek için eski medyaları silerek alan açın."
              : `Depolama kotanızın %${Math.round(quotaRatio * 100)} seviyesine ulaştınız (${formatBytes(
                  storageBreakdown.total_used_bytes
                )} / ${formatBytes(storageBreakdown.quota_bytes)}).`}
          </span>
        </div>
      )}

      {/* Drag & Drop Active Indicator */}
      {isDragging && (
        <div className="mt-5 rounded-xl border-2 border-dashed border-[#D88A96] bg-[#18181B] p-8 text-center">
          <p className="text-[15px] font-medium text-[#F5F5F7]">
            Fotoğrafları yüklemek için buraya bırakın
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="mt-5 flex items-center justify-between rounded-lg border border-[#343438] bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-[#D88A96]" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[#A1A1A6] hover:text-[#F5F5F7]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Active Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#343438] bg-[#18181B] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#F5F5F7]">
              Yükleme Kuyruğu ({uploadQueue.length})
            </span>
            <button
              type="button"
              onClick={() =>
                setUploadQueue((prev) => prev.filter((q) => q.status === "uploading"))
              }
              className="text-[12px] text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
            >
              Tamamlananları Temizle
            </button>
          </div>

          {uploadQueue.map((item) => (
            <div
              key={item.localId}
              className="rounded-lg border border-[#343438]/70 bg-[#101012] p-3"
            >
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="font-medium text-[#F5F5F7] truncate">
                  {item.file.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[#A1A1A6]">
                    {item.status === "error"
                      ? item.error
                      : `${item.stage} (%${item.progress})`}
                  </span>
                  {item.status === "uploading" && (
                    <button
                      type="button"
                      onClick={() => handleCancelItem(item.localId)}
                      className="text-[#D88A96] hover:underline cursor-pointer"
                    >
                      İptal
                    </button>
                  )}
                  {(item.status === "error" || item.status === "cancelled") && (
                    <button
                      type="button"
                      onClick={() => handleRetryItem(item)}
                      className="inline-flex items-center gap-1 text-[#F5F5F7] hover:text-[#D88A96] cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Yeniden Dene</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#222226]">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    item.status === "error" ? "bg-rose-500" : "bg-[#D88A96]"
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery Grid or Clean Empty State */}
      {filteredPhotos.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-[#343438]/70 bg-[#18181B] px-6 py-16 text-center">
          <p className="text-[18px] font-medium text-[#F5F5F7]">
            {searchQuery
              ? "Aramanızla eşleşen fotoğraf bulunamadı."
              : "Henüz fotoğraf eklemediniz."}
          </p>
          <p className="mt-1.5 text-[14px] text-[#A1A1A6]">
            {searchQuery
              ? "Farklı bir anahtar kelime deneyin."
              : "Fotoğraflarınızı buraya sürükleyip bırakabilir veya yukarıdaki butondan çoklu yükleme yapabilirsiniz."}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPhotos.map((photo) => {
            const isEditing = editingPhotoId === photo.id;
            const thumb =
              (photo.thumbnail_path && thumbUrls[photo.thumbnail_path]) ||
              thumbUrls[photo.storage_path];

            return (
              <div key={photo.id} className="group flex flex-col">
                <div
                  onClick={() => setLightboxPhoto(photo)}
                  className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B] cursor-pointer"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={photo.title || "Fotoğraf"}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-[#222226]" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-end justify-between p-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#101012]/80 px-2.5 py-1 text-[11px] font-medium text-[#F5F5F7]">
                      <Maximize2 className="h-3 w-3" />
                      Büyüt
                    </span>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => void onAddPhotoToBook(photo)}
                        title="Anı Kitabına Ekle"
                        className="rounded-md bg-[#101012]/85 hover:bg-[#F5F5F7] p-1.5 text-[#F5F5F7] hover:text-[#101012] transition-apple cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPhotoId(photo.id);
                          setEditTitle(photo.title || "");
                          setEditDesc(photo.description || "");
                          setEditDate(photo.memory_date || "");
                        }}
                        title="Düzenle"
                        className="rounded-md bg-[#101012]/85 hover:bg-[#F5F5F7] p-1.5 text-[#F5F5F7] hover:text-[#101012] transition-apple cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(photo)}
                        title="Sil"
                        className="rounded-md bg-[#101012]/85 hover:bg-[#D88A96] p-1.5 text-[#F5F5F7] hover:text-[#101012] transition-apple cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-2.5 space-y-2 rounded-lg border border-[#343438] bg-[#18181B] p-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Başlık"
                      className="w-full rounded border border-[#343438] bg-[#101012] px-2.5 py-1.5 text-[13px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Açıklama (isteğe bağlı)"
                      className="w-full rounded border border-[#343438] bg-[#101012] px-2.5 py-1.5 text-[12px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                    />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded border border-[#343438] bg-[#101012] px-2.5 py-1.5 text-[12px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingPhotoId(null)}
                        className="rounded px-2.5 py-1 text-[12px] text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(photo.id)}
                        className="rounded bg-[#F5F5F7] px-2.5 py-1 text-[12px] font-medium text-[#101012] cursor-pointer"
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-medium text-[#F5F5F7] truncate">
                        {photo.title || "Fotoğraf"}
                      </h3>
                      <p className="text-[12px] text-[#A1A1A6] tabular-nums mt-0.5 truncate">
                        {photo.memory_date || photo.created_at.slice(0, 10)}
                        {photo.description ? ` • ${photo.description}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onAddPhotoToBook(photo)}
                      className="text-[12px] font-medium text-[#A1A1A6] hover:text-[#D88A96] shrink-0 transition-apple cursor-pointer"
                    >
                      Kitaba Ekle
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[#101012]/95 p-4 sm:p-8 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex w-full max-w-6xl items-center justify-between"
          >
            <div>
              <h3 className="text-[16px] font-semibold text-[#F5F5F7]">
                {lightboxPhoto.title || "Fotoğraf"}
              </h3>
              <p className="text-[12px] text-[#A1A1A6]">
                {lightboxPhoto.memory_date || lightboxPhoto.created_at.slice(0, 10)}
                {lightboxPhoto.description ? ` — ${lightboxPhoto.description}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void onAddPhotoToBook(lightboxPhoto);
                  setLightboxPhoto(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Anı Kitabına Ekle</span>
              </button>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Kapat"
                className="rounded-lg border border-[#343438] bg-[#18181B] p-2 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex items-center justify-center overflow-hidden py-4"
          >
            {lightboxFullUrl ? (
              <img
                src={lightboxFullUrl}
                alt={lightboxPhoto.title || "Fotoğraf"}
                className="max-h-[76vh] w-auto rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D88A96] border-t-transparent" />
            )}
          </div>

          <div className="text-center text-[12px] text-[#A1A1A6]">
            {lightboxPhoto.width && lightboxPhoto.height
              ? `${lightboxPhoto.width} × ${lightboxPhoto.height} px • `
              : ""}
            {formatBytes(lightboxPhoto.file_size)}
          </div>
        </div>
      )}
    </section>
  );
}
