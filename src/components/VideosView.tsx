"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Play,
  Trash2,
  BookOpen,
  X,
  AlertCircle,
  Check,
  Edit3,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, formatDuration } from "@/lib/mediaOptimizer";
import {
  deleteCoupleMedia,
  getSignedUrl,
  getSignedUrlsBatch,
  uploadCoupleMedia,
} from "@/lib/storage";
import { type MediaItem } from "@/types";

interface VideosViewProps {
  coupleId: string;
  videos: MediaItem[];
  onVideosChange: () => Promise<void>;
  onAddVideoToBook: (video: MediaItem) => Promise<void>;
}

export default function VideosView({
  coupleId,
  videos,
  onVideosChange,
  onAddVideoToBook,
}: VideosViewProps) {
  const { refreshStorage } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [activeVideo, setActiveVideo] = useState<MediaItem | null>(null);
  const [resolvedVideoStream, setResolvedVideoStream] = useState<{
    mediaId: string;
    url: string | null;
  } | null>(null);
  const activeVideoUrl =
    activeVideo && resolvedVideoStream?.mediaId === activeVideo.id
      ? resolvedVideoStream.url
      : null;

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    let active = true;
    const loadThumbs = async () => {
      const paths = videos
        .map((v) => v.thumbnail_path)
        .filter((p): p is string => Boolean(p));
      if (paths.length === 0) return;
      const map = await getSignedUrlsBatch("thumbnails", paths);
      if (active) setThumbUrls(map);
    };
    void loadThumbs();
    return () => {
      active = false;
    };
  }, [videos]);

  // Lazy-load private video signed URL only when user opens player modal
  useEffect(() => {
    if (!activeVideo) return;
    let active = true;
    const targetId = activeVideo.id;
    const loadStream = async () => {
      const url = await getSignedUrl("couple-videos", activeVideo.storage_path);
      if (active) setResolvedVideoStream({ mediaId: targetId, url });
    };
    void loadStream();
    return () => {
      active = false;
    };
  }, [activeVideo]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 3600);
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setUploading(true);
    setUploadProgress(5);
    setUploadStage("Video hazırlanıyor...");

    try {
      await uploadCoupleMedia({
        coupleId,
        file,
        mediaType: "video",
        title: file.name.replace(/\.[^.]+$/, ""),
        memoryDate: new Date().toISOString().slice(0, 10),
        onProgress: (pct, stage) => {
          setUploadProgress(pct);
          setUploadStage(stage);
        },
      });

      await Promise.all([onVideosChange(), refreshStorage()]);
      showToast("Video güvenli depolamaya yüklendi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (vid: MediaItem) => {
    try {
      await deleteCoupleMedia(vid.id);
      if (activeVideo?.id === vid.id) setActiveVideo(null);
      await Promise.all([onVideosChange(), refreshStorage()]);
      showToast(`"${vid.title || "Video"}" silindi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video silinemedi.");
    }
  };

  const handleSaveEdit = async (videoId: string) => {
    const supabase = createClient();
    await supabase
      .from("media")
      .update({
        title: editTitle.trim() || "Video",
        description: editDesc.trim() || null,
      })
      .eq("id", videoId);
    setEditingId(null);
    await onVideosChange();
    showToast("Video bilgileri güncellendi.");
  };

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#343438]/70 pb-6 mb-8">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
              Videolarımız
            </h1>
            <span className="text-[14px] font-medium text-[#A1A1A6]">
              {videos.length} kayıt
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[#A1A1A6]">
            MP4 (öncelikli), WebM veya MOV formatında, video başına en fazla 50 MB doğrudan yükleyebilirsiniz.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            onChange={handleVideoFileSelect}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2.5 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            <span>{uploading ? `Yükleniyor (%${uploadProgress})` : "Video Yükle"}</span>
          </button>
        </div>
      </div>

      {uploading && (
        <div className="mb-6 rounded-xl border border-[#343438] bg-[#18181B] p-4">
          <div className="flex items-center justify-between text-[12px] text-[#A1A1A6] mb-2">
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

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between rounded-lg border border-[#D88A96]/40 bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#D88A96]" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-4 w-4 text-[#A1A1A6]" />
          </button>
        </div>
      )}

      {toast && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#343438] bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]">
          <Check className="h-4 w-4 text-[#D88A96]" />
          <span>{toast}</span>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-[#343438]/70 bg-[#18181B] px-6 py-16 text-center">
          <p className="text-[18px] font-medium text-[#F5F5F7]">
            Henüz video eklemediniz.
          </p>
          <p className="mt-1.5 text-[14px] text-[#A1A1A6]">
            Birlikte kaydettiğiniz özel anları MP4 formatında güvenle arşivleyin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((vid) => {
            const thumb = vid.thumbnail_path ? thumbUrls[vid.thumbnail_path] : null;
            const isEditing = editingId === vid.id;

            return (
              <div key={vid.id} className="group flex flex-col">
                <div
                  onClick={() => setActiveVideo(vid)}
                  className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B] cursor-pointer"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={vid.title || "Video"}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-90 transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="h-full w-full bg-[#222226]" />
                  )}
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-apple flex items-center justify-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101012]/80 border border-[#F5F5F7]/20 text-[#F5F5F7]">
                      <Play className="h-4 w-4 fill-[#F5F5F7] ml-0.5" />
                    </div>
                  </div>
                  <span className="absolute bottom-2.5 right-3 rounded bg-[#101012]/85 px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7] tabular-nums">
                    {formatDuration(vid.duration)}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-[#343438] bg-[#18181B] p-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded border border-[#343438] bg-[#101012] px-2.5 py-1.5 text-[13px] text-[#F5F5F7]"
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Açıklama"
                      className="w-full rounded border border-[#343438] bg-[#101012] px-2.5 py-1.5 text-[12px] text-[#F5F5F7]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-[12px] text-[#A1A1A6] px-2 py-1"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(vid.id)}
                        className="rounded bg-[#F5F5F7] px-3 py-1 text-[12px] font-medium text-[#101012]"
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-medium text-[#F5F5F7] truncate">
                        {vid.title || "Video"}
                      </h3>
                      <p className="mt-0.5 text-[12px] text-[#A1A1A6]">
                        {vid.memory_date || vid.created_at.slice(0, 10)} •{" "}
                        {formatBytes(vid.file_size)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onAddVideoToBook(vid)}
                        title="Anı Kitabına Ekle"
                        className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#18181B] hover:text-[#F5F5F7] cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(vid.id);
                          setEditTitle(vid.title || "");
                          setEditDesc(vid.description || "");
                        }}
                        title="Düzenle"
                        className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#18181B] hover:text-[#F5F5F7] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(vid)}
                        title="Sil"
                        className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#18181B] hover:text-[#D88A96] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Video Modal Player */}
      {activeVideo && (
        <div
          onClick={() => setActiveVideo(null)}
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[#101012]/95 p-4 sm:p-8 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex w-full max-w-5xl items-center justify-between"
          >
            <div>
              <h3 className="text-[16px] font-semibold text-[#F5F5F7]">
                {activeVideo.title || "Video"}
              </h3>
              {activeVideo.description && (
                <p className="text-[12px] text-[#A1A1A6]">{activeVideo.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveVideo(null)}
              className="rounded-lg border border-[#343438] bg-[#18181B] p-2 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto mx-auto w-full max-w-5xl"
          >
            {activeVideoUrl ? (
              <video
                src={activeVideoUrl}
                controls
                preload="metadata"
                playsInline
                className="max-h-[75vh] w-full rounded-xl border border-[#343438] bg-black"
              />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#D88A96] border-t-transparent" />
              </div>
            )}
          </div>
          <div />
        </div>
      )}
    </section>
  );
}
