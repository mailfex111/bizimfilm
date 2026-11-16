export interface OptimizedImageResult {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalSizeBytes: number;
}

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE_MB = 25;
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.84;

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const fileName = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  const hasAllowedMime =
    ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) || file.type === "";

  if (!hasAllowedExt && !hasAllowedMime) {
    return {
      valid: false,
      error:
        "Desteklenmeyen dosya formatı. Lütfen JPG, JPEG, PNG, WebP veya HEIC formatında bir görsel seçin.",
    };
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return {
      valid: false,
      error: `Dosya boyutu çok büyük (${(file.size / (1024 * 1024)).toFixed(
        1
      )} MB). Maksimum ${MAX_FILE_SIZE_MB} MB yüklenebilir.`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "Seçilen dosya boş görünüyor.",
    };
  }

  return { valid: true };
}

/**
 * Optimizes an image file on the client:
 * 1. Validates format and size
 * 2. Renders onto an HTML5 Canvas (automatically stripping EXIF/GPS location metadata)
 * 3. Scales down proportionally to max 1600px
 * 4. Converts to WebP (with JPEG fallback if WebP encoding isn't supported)
 */
export async function optimizeImageToWebP(
  file: File,
  onProgress?: (percent: number, stage: string) => void
): Promise<OptimizedImageResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  onProgress?.(15, "Görsel okunuyor...");

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        const isHeic =
          file.name.toLowerCase().endsWith(".heic") ||
          file.name.toLowerCase().endsWith(".heif") ||
          file.type.toLowerCase().includes("heic");
        if (isHeic) {
          reject(
            new Error(
              "Kullandığınız tarayıcı doğrudan HEIC görüntülemeyi desteklemiyor. Lütfen JPG, PNG veya WebP formatında yükleyin."
            )
          );
        } else {
          reject(new Error("Görsel dosyası çözümlenemedi. Lütfen başka bir fotoğraf deneyin."));
        }
      };
      image.src = objectUrl;
    });

    onProgress?.(45, "EXIF konum bilgileri temizleniyor ve boyut optimize ediliyor...");

    let targetWidth = img.naturalWidth || img.width;
    let targetHeight = img.naturalHeight || img.height;

    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
        targetWidth = MAX_DIMENSION;
      } else {
        targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
        targetHeight = MAX_DIMENSION;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Tarayıcı görsel işleme (Canvas) bağlamını başlatamadı.");
    }

    // Drawing to canvas strips all EXIF metadata (including GPS coordinates)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    onProgress?.(75, "WebP formatına dönüştürülüyor...");

    let dataUrl = canvas.toDataURL("image/webp", WEBP_QUALITY);
    let mimeType = "image/webp";

    // Fallback if browser returns PNG instead of WebP
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.86);
      mimeType = "image/jpeg";
    }

    // Calculate approximate byte size of base64 payload
    const base64Length = dataUrl.split(",")[1]?.length || 0;
    const sizeBytes = Math.round((base64Length * 3) / 4);

    onProgress?.(95, "IndexedDB'ye kaydediliyor...");

    return {
      dataUrl,
      mimeType,
      width: targetWidth,
      height: targetHeight,
      sizeBytes,
      originalSizeBytes: file.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
