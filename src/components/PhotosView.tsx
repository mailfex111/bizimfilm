"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  BookOpen,
  ZoomIn,
  Calendar,
  Edit3,
  Check,
  X,
  AlertCircle,
  Sparkles,
  ShieldCheck,
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

  // Upload workflow state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Gallery interaction state
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
    }, 3800);
  };

  // Step 1-4: File selected -> validate -> show preview
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
    setNewTitle(file.name.replace(/\.[^.]+$/, "") || "Yeni Anımız");
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

  // Step 5-8: Optimize -> WebP -> Save to IndexedDB -> Add to gallery
  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setErrorMessage(null);
    setIsUploading(true);
    setUploadProgress(5);
    setUploadStage("Yükleme başlatılıyor...");

    try {
      const optimized = await optimizeImageToWebP(selectedFile, (pct, stage) => {
        setUploadProgress(pct);
        setUploadStage(stage);
      });

      const photoRecord: PhotoItem = {
        id: `${coupleId}-photo-${Date.now()}`,
        coupleId,
        title: newTitle.trim() || "Bizim Anımız ♡",
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
      setUploadStage("Tamamlandı!");
      await onPhotosChange();

      const savedKB = Math.round(optimized.sizeBytes / 1024);
      showToast(
        `"${photoRecord.title}" WebP formatına (${savedKB} KB) optimize edilerek IndexedDB'ye kaydedildi.`
      );
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
    setEditTitle(photo.title);
    setEditDate(photo.date);
  };

  const handleSaveEdit = async (photoId: string) => {
    await updateCouplePhoto(coupleId, photoId, {
      title: editTitle.trim() || "Anımız ♡",
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
    showToast(`"${photo.title}" galeriden silindi.`);
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
      title: photo.title || "Bizim Hikayemiz ♡",
      date: formattedDate,
      content: "Seninle tanıştığım o günü hiçbir zaman unutmayacağım.",
      photoUrl: photo.dataUrl,
      layoutVariant: "polaroid-standard",
      updatedAt: Date.now(),
    };

    await saveCoupleBookPage(newBookPage);
    const updatedPages = [...bookPages, newBookPage];
    onPagesChange(updatedPages);
    showToast(`"${photo.title}" Anı Kitabı'na yeni sayfa (Sayfa ${newPageOrder + 1}) olarak eklendi!`);
    onSwitchToBook(newPageOrder);
  };

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 pb-28">
      {/* Top Header & Upload CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-200/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
            <ImageIcon className="h-6 w-6 text-[#f06c82]" />
            <span>Fotoğraflarımız</span>
            <span className="rounded-full bg-[#38121c] border border-rose-300/20 px-3 py-0.5 text-xs font-medium text-rose-200">
              {photos.length} Kayıtlı Görsel
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-rose-100/75">
            Yüklediğiniz fotoğraflar otomatik olarak yüksek kalitede optimize edilir ve anı
            galerinizde saklanır.
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#c81e3a] hover:bg-[#df2343] active:scale-[0.99] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_6px_22px_rgba(200,30,58,0.45)] transition cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Fotoğraf Yükle</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/75 px-4 py-3 text-xs sm:text-sm text-rose-100"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-200/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {toastMessage && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-950/75 px-4 py-3 text-xs sm:text-sm text-emerald-100">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-200/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Preview & Optimization Panel when a file is chosen */}
      {selectedFile && previewObjectUrl && (
        <form
          onSubmit={handleConfirmUpload}
          className="mt-5 rounded-2xl border border-rose-300/25 bg-[#220b12]/95 p-5 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#f06c82]" />
              <span>Görsel Önizleme ve WebP Optimizasyonu</span>
            </h2>
            <button
              type="button"
              onClick={cancelPreview}
              disabled={isUploading}
              className="text-rose-200/70 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-rose-200/15 bg-black/50">
              <img
                src={previewObjectUrl}
                alt="Yüklenecek görsel önizlemesi"
                className="h-full w-full object-contain"
              />
              <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 text-[10px] text-rose-200">
                Orijinal: {(selectedFile.size / 1024).toFixed(0)} KB
              </span>
            </div>

            <div className="md:col-span-2 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-rose-100/85 mb-1">
                    Fotoğraf Başlığı
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Örn: İlk Tatilimiz ♡"
                    className="w-full rounded-xl border border-rose-200/15 bg-[#14060a] px-3.5 py-2 text-sm text-white focus:border-[#e63956] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-rose-100/85 mb-1">
                    Fotoğraf Tarihi
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-xl border border-rose-200/15 bg-[#14060a] px-3.5 py-2 text-sm text-white focus:border-[#e63956] focus:outline-none"
                  />
                </div>
              </div>

              {isUploading && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-rose-200">
                    <span>{uploadStage}</span>
                    <span>%{uploadProgress}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#c81e3a] to-[#f06c82] transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={cancelPreview}
                  disabled={isUploading}
                  className="rounded-xl border border-rose-200/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-medium text-rose-100 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#c81e3a] hover:bg-[#e02444] px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg cursor-pointer disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  <span>
                    {isUploading ? "Optimize Ediliyor..." : "Optimize Et ve Galeriye Kaydet"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Responsive Photo Gallery Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => {
          const isEditing = editingPhotoId === photo.id;

          return (
            <div
              key={photo.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-rose-200/15 bg-[#1b080e]/90 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition hover:border-rose-300/35"
            >
              {/* Image Area */}
              <div
                onClick={() => setLightboxPhoto(photo)}
                className="relative aspect-[4/3] w-full overflow-hidden bg-[#120508] cursor-pointer"
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] text-white">
                    <ZoomIn className="h-3 w-3 text-[#f06c82]" />
                    Büyüt
                  </span>
                  <span className="rounded bg-black/65 px-2 py-0.5 text-[10px] text-rose-200">
                    {Math.round(photo.sizeBytes / 1024)} KB • WebP
                  </span>
                </div>
              </div>

              {/* Card Body: Title, Date & Actions */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                {isEditing ? (
                  <div className="space-y-2 mb-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-rose-300/30 bg-[#120508] px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-lg border border-rose-300/30 bg-[#120508] px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingPhotoId(null)}
                        className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-rose-100 cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(photo.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#c81e3a] px-2.5 py-1 text-[11px] font-medium text-white cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        Kaydet
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white leading-snug truncate">
                        {photo.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(photo)}
                        title="Başlık ve Tarihi Düzenle"
                        className="text-rose-200/60 hover:text-white p-0.5 shrink-0 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-200/65">
                      <Calendar className="h-3 w-3 text-[#f06c82]" />
                      <span>{photo.date || "Tarih belirtilmedi"}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-rose-200/10">
                  <button
                    type="button"
                    onClick={() => void handleSendToMemoryBook(photo)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#38121c] hover:bg-[#c81e3a] border border-rose-300/20 px-2.5 py-1.5 text-[11px] font-medium text-rose-100 hover:text-white transition cursor-pointer"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-[#f06c82] group-hover:text-white" />
                    <span>Anı Kitabına Gönder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDeletePhoto(photo)}
                    title="Fotoğrafı Sil"
                    className="rounded-lg border border-rose-500/25 bg-rose-950/50 hover:bg-rose-900 p-1.5 text-rose-200 hover:text-white transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal when clicking a photo */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full rounded-2xl border border-rose-200/20 bg-[#1a070c] p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-rose-200/10">
              <div>
                <h3 className="text-base font-bold text-white">{lightboxPhoto.title}</h3>
                <p className="text-xs text-rose-200/70">{lightboxPhoto.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleSendToMemoryBook(lightboxPhoto);
                    setLightboxPhoto(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#c81e3a] hover:bg-[#e02444] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Anı Kitabına Gönder</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="rounded-lg p-1.5 text-rose-200/70 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[72vh] overflow-hidden rounded-xl bg-black flex items-center justify-center">
              <img
                src={lightboxPhoto.dataUrl}
                alt={lightboxPhoto.title}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
