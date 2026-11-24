"use client";

import { createClient } from "@/lib/supabase/client";
import {
  processAudioMetadata,
  processPhotoForUpload,
  processVideoMetadata,
} from "@/lib/mediaOptimizer";
import { type MediaItem, type MediaType } from "@/types";

export type PrivateBucket =
  | "avatars"
  | "couple-photos"
  | "couple-videos"
  | "couple-music"
  | "book-assets"
  | "thumbnails";

export function bucketForMediaType(type: MediaType): PrivateBucket {
  switch (type) {
    case "photo":
      return "couple-photos";
    case "video":
      return "couple-videos";
    case "audio":
      return "couple-music";
    case "book_asset":
      return "book-assets";
  }
}

// In-memory short-lived signed URL cache (never persisted to DB or localStorage)
const SIGNED_URL_TTL_SEC = 900; // 15 minutes
const REFRESH_BUFFER_MS = 90_000; // Refresh if < 90s remaining
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

export async function getSignedUrl(
  bucket: PrivateBucket,
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;
  const cacheKey = `${bucket}:${storagePath}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return cached.url;
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    return null;
  }

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
  });
  return data.signedUrl;
}

export async function getSignedUrlsBatch(
  bucket: PrivateBucket,
  paths: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    const cacheKey = `${bucket}:${p}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt - Date.now() > REFRESH_BUFFER_MS) {
      result[p] = cached.url;
    } else if (!missing.includes(p)) {
      missing.push(p);
    }
  }

  if (missing.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(missing, SIGNED_URL_TTL_SEC);

  if (!error && Array.isArray(data)) {
    const expiresAt = Date.now() + SIGNED_URL_TTL_SEC * 1000;
    for (const entry of data) {
      if (entry.path && entry.signedUrl) {
        signedUrlCache.set(`${bucket}:${entry.path}`, {
          url: entry.signedUrl,
          expiresAt,
        });
        result[entry.path] = entry.signedUrl;
      }
    }
  }

  return result;
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface UploadMediaOptions {
  coupleId: string;
  file: File;
  mediaType: MediaType;
  title?: string;
  description?: string;
  memoryDate?: string | null;
  dedupHash?: string | null;
  signal?: AbortSignal;
  onProgress?: (percent: number, stage: string) => void;
}

/**
 * Atomic quota-reserved direct upload to private Supabase Storage:
 * 1. Validate & optimize on client
 * 2. Reserve couple quota via DB RPC (prevents concurrent quota bypass)
 * 3. Upload main file (+ thumbnail) directly to private Storage with UUID path
 * 4. Finalize DB `media` record + consume quota via RPC
 * 5. On ANY failure or abort: remove orphaned storage files & release quota reservation
 */
export async function uploadCoupleMedia(
  options: UploadMediaOptions
): Promise<MediaItem> {
  const {
    coupleId,
    file,
    mediaType,
    title,
    description,
    memoryDate,
    signal,
    onProgress,
  } = options;

  const supabase = createClient();
  const mainBucket = bucketForMediaType(mediaType);
  const mediaUuid = createUuid();

  const checkAborted = () => {
    if (signal?.aborted) {
      throw new Error("UPLOAD_CANCELLED");
    }
  };

  let mainBlob: Blob;
  let thumbBlob: Blob | null = null;
  let mimeType: string;
  let extension: string;
  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = null;
  let dedupHash: string | null = options.dedupHash || null;

  onProgress?.(10, "Dosya doğrulanıyor ve optimize ediliyor...");

  if (mediaType === "photo" || mediaType === "book_asset") {
    const processed = await processPhotoForUpload(file);
    mainBlob = processed.blob;
    thumbBlob = processed.thumbnailBlob;
    mimeType = processed.mimeType;
    extension = processed.extension;
    width = processed.width;
    height = processed.height;
    dedupHash = dedupHash || processed.dedupHash;
  } else if (mediaType === "video") {
    const processed = await processVideoMetadata(file);
    mainBlob = processed.blob;
    thumbBlob = processed.thumbnailBlob;
    mimeType = processed.mimeType;
    extension = processed.extension;
    width = processed.width;
    height = processed.height;
    duration = processed.duration;
  } else {
    const processed = await processAudioMetadata(file);
    mainBlob = processed.blob;
    mimeType = processed.mimeType;
    extension = processed.extension;
    duration = processed.duration;
  }

  checkAborted();

  const totalBytes = mainBlob.size + (thumbBlob ? thumbBlob.size : 0);
  onProgress?.(30, "Depolama kotası doğrulanıyor...");

  const { data: reservationId, error: reserveErr } = await supabase.rpc(
    "reserve_storage_quota",
    { p_bytes: totalBytes }
  );

  if (reserveErr || !reservationId) {
    throw new Error(
      reserveErr?.message?.includes("STORAGE_QUOTA_EXCEEDED")
        ? "Çift alanınızın depolama kotası doldu. Yeni dosya yüklemek için alan açın."
        : reserveErr?.message || "Depolama kotası doğrulanamadı."
    );
  }

  const mainPath = `${coupleId}/${mediaUuid}.${extension}`;
  const thumbPath = thumbBlob ? `${coupleId}/${mediaUuid}.webp` : null;
  let mainUploaded = false;
  let thumbUploaded = false;

  try {
    checkAborted();
    onProgress?.(55, "Dosya güvenli depolamaya yükleniyor...");

    const { error: mainUpErr } = await supabase.storage
      .from(mainBucket)
      .upload(mainPath, mainBlob, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (mainUpErr) {
      throw new Error(mainUpErr.message || "Dosya Storage'a yüklenemedi.");
    }
    mainUploaded = true;

    checkAborted();

    if (thumbBlob && thumbPath) {
      onProgress?.(75, "Önizleme (thumbnail) oluşturuluyor...");
      const { error: thumbUpErr } = await supabase.storage
        .from("thumbnails")
        .upload(thumbPath, thumbBlob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });
      if (!thumbUpErr) {
        thumbUploaded = true;
      }
    }

    checkAborted();
    onProgress?.(90, "Veritabanı kaydı tamamlanıyor...");

    const cleanTitle = (title || file.name.replace(/\.[^.]+$/, "")).trim() || "Adsız";
    const { data: finalizedMedia, error: finalizeErr } = await supabase.rpc(
      "finalize_media_upload",
      {
        p_reservation_id: reservationId,
        p_media_type: mediaType,
        p_storage_path: mainPath,
        p_thumbnail_path: thumbUploaded ? thumbPath : null,
        p_original_filename: file.name.slice(0, 180),
        p_mime_type: mimeType,
        p_file_size: totalBytes,
        p_width: width,
        p_height: height,
        p_duration: duration,
        p_title: cleanTitle.slice(0, 140),
        p_description: (description || "").trim().slice(0, 500) || null,
        p_memory_date: memoryDate || null,
        p_dedup_hash: dedupHash,
      }
    );

    if (finalizeErr || !finalizedMedia) {
      throw new Error(finalizeErr?.message || "Veritabanı kaydı oluşturulamadı.");
    }

    onProgress?.(100, "Tamamlandı");
    return finalizedMedia as MediaItem;
  } catch (err) {
    // Cleanup orphaned storage objects & release reservation atomically
    if (mainUploaded) {
      await supabase.storage.from(mainBucket).remove([mainPath]).catch(() => {});
    }
    if (thumbUploaded && thumbPath) {
      await supabase.storage.from("thumbnails").remove([thumbPath]).catch(() => {});
    }
    try {
      await supabase.rpc("release_storage_reservation", {
        p_reservation_id: reservationId,
      });
    } catch {
      // Best-effort reservation cleanup
    }

    if (err instanceof Error && err.message === "UPLOAD_CANCELLED") {
      throw new Error("Yükleme iptal edildi.");
    }
    throw err;
  }
}

export async function deleteCoupleMedia(mediaId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("delete_media_and_reclaim_quota", {
    p_media_id: mediaId,
  });

  if (error) {
    throw new Error(error.message || "Medya silinemedi.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.deleted_storage_path && row?.deleted_media_type) {
    const bucket = bucketForMediaType(row.deleted_media_type as MediaType);
    await supabase.storage.from(bucket).remove([row.deleted_storage_path]).catch(() => {});
    signedUrlCache.delete(`${bucket}:${row.deleted_storage_path}`);
  }
  if (row?.deleted_thumbnail_path) {
    await supabase.storage
      .from("thumbnails")
      .remove([row.deleted_thumbnail_path])
      .catch(() => {});
    signedUrlCache.delete(`thumbnails:${row.deleted_thumbnail_path}`);
  }
}

export async function uploadUserAvatar(
  userId: string,
  file: File,
  previousAvatarPath?: string | null
): Promise<string> {
  const supabase = createClient();
  const processed = await processPhotoForUpload(file, 400);
  const avatarPath = `${userId}/${createUuid()}.${processed.extension}`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(avatarPath, processed.blob, {
      contentType: processed.mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(uploadErr.message || "Profil fotoğrafı yüklenemedi.");
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("id", userId);

  if (updateErr) {
    await supabase.storage.from("avatars").remove([avatarPath]).catch(() => {});
    throw new Error(updateErr.message || "Profil güncellenemedi.");
  }

  if (previousAvatarPath) {
    await supabase.storage.from("avatars").remove([previousAvatarPath]).catch(() => {});
    signedUrlCache.delete(`avatars:${previousAvatarPath}`);
  }

  return avatarPath;
}
