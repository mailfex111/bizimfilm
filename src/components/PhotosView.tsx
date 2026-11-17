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
} from "lucide-react";
import {
  addCouplePhoto,
  deleteCouplePhoto,
  saveCoupleBookPage,
  updateCouplePhoto,
} from "@/lib/db";
import { optimizeImageToWebP, validateImageFile } from "@/lib/imageOptimizer";
import { type BookPageItem, type CoupleId, type PhotoItem } from "@/types";

interface PhotosViewProps {
  coupleId: CoupleId;
  photos: PhotoItem[];
  bookPages: BookPageItem[];
  autoOpenUpload?: boolean;
  onClearAutoOpen?: () => void;
  onPhotosChange: () => Promise<void>;
  onPagesChange: (pages: BookPageItem[]) => void;
  onSwitchToBook: (targetPageIndex?: number) => void;
}

export default function PhotosView({
  coupleId,
  photos,
  bookPages,
  autoOpenUpload = false,
  onClearAutoOpen,
  onPhotosChange,
  onPagesChange,
  onSwitchToBook,
}: PhotosViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    if (autoOpenUpload) {
      fileInputRef.current?.click();
      onClearAutoOpen?.();
    }
  }, [autoOpenUpload, onClearAutoOpen]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Geçersiz dosya.");
      e.target.value = "";
      return;
    }

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }

    const objUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewObjectUrl(objUrl);
    setNewTitle(file.name.replace(/\.[^.]+$/, "") || "Yeni Fotoğraf");
    setNewDate(new Date().toISOString().slice(0, 10));
    e.target.value = "";
  };

  const cancelPreview = () => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    setSelectedFile(null);
    setPreviewObjectUrl(null);
    setUploadProgress(0);
    setUploadStage("");
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setErrorMessage(null);
    setIsUploading(true);
    setUploadProgress(5);
    setUploadStage("Hazırlanıyor...");

    try {
      const optimized = await optimizeImageToWebP(selectedFile, (pct, stage) => {
        setUploadProgress(pct);
        setUploadStage(stage);
      });

      const photoRecord: PhotoItem = {
        id: `${coupleId}-photo-${Date.now()}`,
        coupleId,
        title: newTitle.trim() || "Anımız",
        date: newDate || new Date().toISOString().slice(0, 10),
        dataUrl: optimized.dataUrl,
        mimeType: optimized.mimeType,
        width: optimized.width,
        height: optimized.height,
        sizeBytes: optimized.sizeBytes,
        createdAt: Date.now(),
      };

      await addCouplePhoto(photoRecord);
      setUploadProgress(100);
      setUploadStage("Tamamlandı");
      await onPhotosChange();

      const savedKB = Math.round(optimized.sizeBytes / 1024);
      showToast(`"${photoRecord.title}" arşivlendi (${savedKB} KB WebP).`);
      cancelPreview();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Görsel optimize edilirken bir hata oluştu."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartEdit = (photo: PhotoItem) => {
    setEditingPhotoId(photo.id);
    setEditTitle(photo.title.replace(/\s*\([^)]*\)/g, ""));
    setEditDate(photo.date);
  };

  const handleSaveEdit = async (photoId: string) => {
    await updateCouplePhoto(coupleId, photoId, {
      title: editTitle.trim() || "Anımız",
      date: editDate,
    });
    setEditingPhotoId(null);
    await onPhotosChange();
    showToast("Fotoğraf bilgileri güncellendi.");
  };

  const handleDeletePhoto = async (photo: PhotoItem) => {
    await deleteCouplePhoto(coupleId, photo.id);
    if (lightboxPhoto?.id === photo.id) {
      setLightboxPhoto(null);
    }
    await onPhotosChange();
    showToast(`"${photo.title}" arşivden kaldırıldı.`);
  };

  const handleSendToMemoryBook = async (photo: PhotoItem) => {
    const newPageOrder = bookPages.length;
    const formattedDate = photo.date
      ? new Date(photo.date).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Özel Günümüz";

    const newBookPage: BookPageItem = {
      id: `${coupleId}-page-${Date.now()}`,
      coupleId,
      order: newPageOrder,
      title: photo.title.replace(/\s*\([^)]*\)/g, "") || "Bizim Hikayemiz",
      date: formattedDate,
      content: "Seninle tanıştığım o günü hiçbir zaman unutmayacağım.",
      photoUrl: photo.dataUrl,
      layoutVariant: "polaroid-standard",
      updatedAt: Date.now(),
    };

    await saveCoupleBookPage(newBookPage);
    const updatedPages = [...bookPages, newBookPage];
    onPagesChange(updatedPages);
    showToast(
      `"${newBookPage.title}" Anı Kitabı'na Sayfa ${newPageOrder + 1} olarak eklendi.`
    );
    onSwitchToBook(newPageOrder);
  };

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      {/* Archival Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#343438]/70 pb-6">
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
            Yüklenen görseller otomatik olarak WebP formatına optimize edilir ve yerel arşivinizde saklanır.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white active:scale-[0.99] px-4 py-2.5 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Fotoğraf Yükle</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-5 flex items-center justify-between rounded-lg border border-[#D88A96]/40 bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[#A1A1A6] hover:text-[#F5F5F7]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {toastMessage && (
        <div className="mt-5 flex items-center justify-between rounded-lg border border-[#343438] bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-[#D88A96] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#A1A1A6] hover:text-[#F5F5F7]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload Preview Sheet */}
      {selectedFile && previewObjectUrl && (
        <form
          onSubmit={handleConfirmUpload}
          className="mt-6 rounded-xl border border-[#343438] bg-[#18181B] p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-semibold text-[#F5F5F7]">
              Yeni Fotoğraf Ekle
            </h2>
            <button
              type="button"
              onClick={cancelPreview}
              disabled={isUploading}
              className="text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-[#343438] bg-[#101012]">
              <img
                src={previewObjectUrl}
                alt="Önizleme"
                className="h-full w-full object-contain"
              />
              <span className="absolute bottom-2 right-2 rounded bg-[#101012]/80 px-2 py-0.5 text-[11px] text-[#A1A1A6]">
                {(selectedFile.size / 1024).toFixed(0)} KB
              </span>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Başlık
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Gün Batımında Biz"
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Tarih
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                  />
                </div>
              </div>

              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[12px] text-[#A1A1A6]">
                    <span>{uploadStage}</span>
                    <span>%{uploadProgress}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#222226]">
                    <div
                      className="h-full rounded-full bg-[#D88A96] transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={cancelPreview}
                  disabled={isUploading}
                  className="rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] px-4 py-2 text-[13px] font-medium text-[#F5F5F7] cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white px-5 py-2 text-[13px] font-medium text-[#101012] cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{isUploading ? "Kaydediliyor..." : "Arşive Kaydet"}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Apple Photos-Style Consistent Archival Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {photos.map((photo) => {
          const isEditing = editingPhotoId === photo.id;
          const cleanPhotoTitle = photo.title.replace(/\s*\([^)]*\)/g, "");

          return (
            <div key={photo.id} className="group flex flex-col">
              {/* Thumbnail Frame */}
              <div
                onClick={() => setLightboxPhoto(photo)}
                className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B] cursor-pointer"
              >
                <img
                  src={photo.dataUrl}
                  alt={cleanPhotoTitle}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />

                {/* Subtle Hover Action Bar */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-end justify-between p-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#101012]/80 px-2.5 py-1 text-[11px] font-medium text-[#F5F5F7]">
                    <Maximize2 className="h-3 w-3" />
                    Görüntüle
                  </span>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => void handleSendToMemoryBook(photo)}
                      title="Anı Kitabına Ekle"
                      className="rounded-md bg-[#101012]/85 hover:bg-[#F5F5F7] p-1.5 text-[#F5F5F7] hover:text-[#101012] transition-apple cursor-pointer"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(photo)}
                      title="Düzenle"
                      className="rounded-md bg-[#101012]/85 hover:bg-[#F5F5F7] p-1.5 text-[#F5F5F7] hover:text-[#101012] transition-apple cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePhoto(photo)}
                      title="Sil"
                      className="rounded-md bg-[#101012]/85 hover:bg-[#D88A96] p-1.5 text-[#F5F5F7] hover:text-[#101012] transition-apple cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Minimal Metadata Below Image */}
              {isEditing ? (
                <div className="mt-2.5 space-y-2 rounded-lg border border-[#343438] bg-[#18181B] p-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded border border-[#343438] bg-[#101012] px-2.5 py-1.5 text-[13px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
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
                      {cleanPhotoTitle}
                    </h3>
                    <p className="text-[12px] text-[#A1A1A6] tabular-nums mt-0.5">
                      {photo.date}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSendToMemoryBook(photo)}
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

      {/* Fullscreen Darkroom Lightbox Viewer */}
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
                {lightboxPhoto.title.replace(/\s*\([^)]*\)/g, "")}
              </h3>
              <p className="text-[12px] text-[#A1A1A6]">{lightboxPhoto.date}</p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void handleSendToMemoryBook(lightboxPhoto);
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
            <img
              src={lightboxPhoto.dataUrl}
              alt={lightboxPhoto.title}
              className="max-h-[76vh] w-auto rounded-lg object-contain shadow-2xl"
            />
          </div>

          <div className="text-center text-[12px] text-[#A1A1A6]">
            {lightboxPhoto.width} × {lightboxPhoto.height} px •{" "}
            {Math.round(lightboxPhoto.sizeBytes / 1024)} KB
          </div>
        </div>
      )}
    </section>
  );
}
