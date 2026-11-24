export const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 MB raw input
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB per video (configurable)
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB per audio track
export const MAX_PHOTO_DIMENSION = 1920;
export const THUMBNAIL_DIMENSION = 480;
export const WEBP_QUALITY = 0.83;

const PHOTO_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const PHOTO_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const VIDEO_EXTS = [".mp4", ".webm", ".mov"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];

const AUDIO_EXTS = [".mp3", ".m4a", ".wav", ".ogg", ".webm"];
const AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];

export interface ProcessedPhotoResult {
  blob: Blob;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  thumbnailBlob: Blob;
  dedupHash: string;
}

export interface ProcessedVideoResult {
  blob: File;
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnailBlob: Blob | null;
}

export interface ProcessedAudioResult {
  blob: File;
  mimeType: string;
  extension: string;
  duration: number | null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export async function computeSha256Hex(blob: Blob): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return `${blob.size}-${Date.now()}`;
  }
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  const lower = file.name.toLowerCase();
  const extOk = PHOTO_EXTS.some((ext) => lower.endsWith(ext));
  const mimeOk = PHOTO_MIMES.includes(file.type.toLowerCase()) || file.type === "";

  if (!extOk && !mimeOk) {
    return {
      valid: false,
      error:
        "Desteklenmeyen fotoğraf formatı. Lütfen JPG, JPEG, PNG, WebP veya tarayıcı destekliyorsa HEIC seçin.",
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: "Seçilen dosya boş görünüyor." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      error: `Fotoğraf boyutu çok büyük (${formatBytes(file.size)}). Maksimum 25 MB yüklenebilir.`,
    };
  }
  return { valid: true };
}

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const lower = file.name.toLowerCase();
  const extOk = VIDEO_EXTS.some((ext) => lower.endsWith(ext));
  const mimeOk = VIDEO_MIMES.includes(file.type.toLowerCase());

  if (!extOk && !mimeOk) {
    return {
      valid: false,
      error:
        "Desteklenmeyen video formatı. Tarayıcı uyumluluğu için MP4 (öncelikli), WebM veya MOV kullanın.",
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: "Seçilen video dosyası boş." };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return {
      valid: false,
      error: `Video boyutu başlangıç limitini (50 MB) aşıyor: ${formatBytes(file.size)}.`,
    };
  }
  return { valid: true };
}

export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const lower = file.name.toLowerCase();
  const extOk = AUDIO_EXTS.some((ext) => lower.endsWith(ext));
  const mimeOk = AUDIO_MIMES.includes(file.type.toLowerCase());

  if (!extOk && !mimeOk) {
    return {
      valid: false,
      error: "Desteklenmeyen ses formatı. MP3, M4A, WAV, OGG veya WebM ses dosyası seçin.",
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: "Seçilen ses dosyası boş." };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return {
      valid: false,
      error: `Ses dosyası boyutu 25 MB limitini aşıyor: ${formatBytes(file.size)}.`,
    };
  }
  return { valid: true };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Görsel dönüştürülemedi."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function fitDimensions(
  srcW: number,
  srcH: number,
  maxDim: number
): { width: number; height: number } {
  // Never upscale small images
  if (srcW <= maxDim && srcH <= maxDim) {
    return { width: srcW, height: srcH };
  }
  if (srcW >= srcH) {
    return {
      width: maxDim,
      height: Math.max(1, Math.round((srcH * maxDim) / srcW)),
    };
  }
  return {
    width: Math.max(1, Math.round((srcW * maxDim) / srcH)),
    height: maxDim,
  };
}

/**
 * Corrects EXIF orientation via createImageBitmap, strips all EXIF/GPS metadata
 * by redrawing on clean canvas, optimizes to max 1920px WebP + 480px WebP thumbnail.
 */
export async function processPhotoForUpload(
  file: File,
  maxDimension: number = MAX_PHOTO_DIMENSION
): Promise<ProcessedPhotoResult> {
  const check = validatePhotoFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  let bitmap: ImageBitmap | null = null;
  let fallbackImg: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
      } catch {
        bitmap = null;
      }
    }

    if (!bitmap) {
      objectUrl = URL.createObjectURL(file);
      fallbackImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          const isHeic =
            file.name.toLowerCase().endsWith(".heic") ||
            file.name.toLowerCase().endsWith(".heif") ||
            file.type.toLowerCase().includes("heic");
          reject(
            new Error(
              isHeic
                ? "Bu tarayıcı HEIC görselleri doğrudan çözemiyor. Lütfen JPG, PNG veya WebP formatında yükleyin."
                : "Görsel dosyası okunamadı."
            )
          );
        };
        img.src = objectUrl!;
      });
    }

    const srcW = bitmap ? bitmap.width : fallbackImg!.naturalWidth || fallbackImg!.width;
    const srcH = bitmap ? bitmap.height : fallbackImg!.naturalHeight || fallbackImg!.height;

    const mainSize = fitDimensions(srcW, srcH, maxDimension);
    const mainCanvas = document.createElement("canvas");
    mainCanvas.width = mainSize.width;
    mainCanvas.height = mainSize.height;
    const mainCtx = mainCanvas.getContext("2d");
    if (!mainCtx) throw new Error("Canvas bağlamı oluşturulamadı.");

    mainCtx.imageSmoothingEnabled = true;
    mainCtx.imageSmoothingQuality = "high";
    mainCtx.drawImage(bitmap || fallbackImg!, 0, 0, mainSize.width, mainSize.height);

    let mainBlob = await canvasToBlob(mainCanvas, "image/webp", WEBP_QUALITY);
    let mimeType = "image/webp";
    let extension = "webp";

    if (mainBlob.type !== "image/webp") {
      mainBlob = await canvasToBlob(mainCanvas, "image/jpeg", 0.85);
      mimeType = "image/jpeg";
      extension = "jpg";
    }

    // Generate 480px WebP thumbnail
    const thumbSize = fitDimensions(srcW, srcH, THUMBNAIL_DIMENSION);
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = thumbSize.width;
    thumbCanvas.height = thumbSize.height;
    const thumbCtx = thumbCanvas.getContext("2d");
    if (!thumbCtx) throw new Error("Thumbnail canvas oluşturulamadı.");

    thumbCtx.imageSmoothingEnabled = true;
    thumbCtx.imageSmoothingQuality = "high";
    thumbCtx.drawImage(bitmap || fallbackImg!, 0, 0, thumbSize.width, thumbSize.height);

    let thumbnailBlob = await canvasToBlob(thumbCanvas, "image/webp", 0.78);
    if (thumbnailBlob.type !== "image/webp") {
      thumbnailBlob = await canvasToBlob(thumbCanvas, "image/jpeg", 0.8);
    }

    const dedupHash = await computeSha256Hex(mainBlob);

    return {
      blob: mainBlob,
      mimeType,
      extension,
      width: mainSize.width,
      height: mainSize.height,
      thumbnailBlob,
      dedupHash,
    };
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Extracts video duration, dimensions, and a WebP poster frame without heavy client transcoding.
 */
export async function processVideoMetadata(file: File): Promise<ProcessedVideoResult> {
  const check = validateVideoFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const lower = file.name.toLowerCase();
  const extension = lower.endsWith(".webm")
    ? "webm"
    : lower.endsWith(".mov")
    ? "mov"
    : "mp4";
  const mimeType =
    file.type ||
    (extension === "webm"
      ? "video/webm"
      : extension === "mov"
      ? "video/quicktime"
      : "video/mp4");

  const objectUrl = URL.createObjectURL(file);

  try {
    const metadata = await new Promise<{
      width: number | null;
      height: number | null;
      duration: number | null;
      thumbnailBlob: Blob | null;
    }>((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const finish = (thumb: Blob | null) => {
        resolve({
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          thumbnailBlob: thumb,
        });
      };

      const timeout = setTimeout(() => finish(null), 6000);

      video.onloadedmetadata = () => {
        const targetTime =
          Number.isFinite(video.duration) && video.duration > 1 ? 0.5 : 0;
        try {
          video.currentTime = targetTime;
        } catch {
          clearTimeout(timeout);
          finish(null);
        }
      };

      video.onseeked = async () => {
        clearTimeout(timeout);
        try {
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const size = fitDimensions(w, h, THUMBNAIL_DIMENSION);
          const canvas = document.createElement("canvas");
          canvas.width = size.width;
          canvas.height = size.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, size.width, size.height);
            const blob = await canvasToBlob(canvas, "image/webp", 0.78);
            finish(blob);
            return;
          }
        } catch {
          // Proceed without thumbnail
        }
        finish(null);
      };

      video.onerror = () => {
        clearTimeout(timeout);
        finish(null);
      };

      video.src = objectUrl;
    });

    return {
      blob: file,
      mimeType,
      extension,
      ...metadata,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function processAudioMetadata(file: File): Promise<ProcessedAudioResult> {
  const check = validateAudioFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const lower = file.name.toLowerCase();
  const extension = lower.endsWith(".m4a")
    ? "m4a"
    : lower.endsWith(".wav")
    ? "wav"
    : lower.endsWith(".ogg")
    ? "ogg"
    : lower.endsWith(".webm")
    ? "webm"
    : "mp3";

  const mimeType = file.type || (extension === "mp3" ? "audio/mpeg" : `audio/${extension}`);
  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number | null>((resolve) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      const timeout = setTimeout(() => resolve(null), 5000);
      audio.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve(Number.isFinite(audio.duration) ? audio.duration : null);
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
      audio.src = objectUrl;
    });

    return {
      blob: file,
      mimeType,
      extension,
      duration,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
