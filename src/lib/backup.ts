import {
  getCoupleBookPages,
  getCoupleDB,
  getCouplePhotos,
  getLastOpenBookPage,
  setLastOpenBookPage,
} from "@/lib/db";
import { type BackupPayload, type CoupleId } from "@/types";

export async function exportCoupleBackup(coupleId: CoupleId): Promise<void> {
  const [photos, bookPages, lastOpenPage] = await Promise.all([
    getCouplePhotos(coupleId),
    getCoupleBookPages(coupleId),
    getLastOpenBookPage(coupleId),
  ]);

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    coupleId,
    photos,
    bookPages,
    coupleState: {
      coupleId,
      lastOpenPage,
      updatedAt: Date.now(),
    },
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bizimfilm-${coupleId}-yedek-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importCoupleBackup(
  coupleId: CoupleId,
  file: File
): Promise<{ photoCount: number; pageCount: number }> {
  const text = await file.text();
  let parsed: BackupPayload;

  try {
    parsed = JSON.parse(text) as BackupPayload;
  } catch {
    throw new Error("Geçersiz yedek dosyası formatı. Lütfen geçerli bir BizimFilm JSON yedeği seçin.");
  }

  if (
    !parsed ||
    !Array.isArray(parsed.photos) ||
    !Array.isArray(parsed.bookPages)
  ) {
    throw new Error("Yedek dosyasında fotoğraflar veya kitap sayfaları verisi eksik.");
  }

  const db = getCoupleDB(coupleId);

  const normalizedPhotos = parsed.photos.map((p, idx) => ({
    ...p,
    id: p.id || `${coupleId}-imported-photo-${Date.now()}-${idx}`,
    coupleId,
  }));

  const normalizedPages = parsed.bookPages
    .map((page, idx) => ({
      ...page,
      id: page.id || `${coupleId}-imported-page-${Date.now()}-${idx}`,
      coupleId,
      order: typeof page.order === "number" ? page.order : idx,
      updatedAt: page.updatedAt || Date.now(),
    }))
    .sort((a, b) => a.order - b.order)
    .map((p, idx) => ({ ...p, order: idx }));

  await db.transaction("rw", db.photos, db.bookPages, db.coupleState, async () => {
    await db.photos.clear();
    await db.bookPages.clear();

    if (normalizedPhotos.length > 0) {
      await db.photos.bulkPut(normalizedPhotos);
    }
    if (normalizedPages.length > 0) {
      await db.bookPages.bulkPut(normalizedPages);
    }

    const targetLastPage = parsed.coupleState?.lastOpenPage ?? 0;
    await setLastOpenBookPage(coupleId, targetLastPage);
  });

  return {
    photoCount: normalizedPhotos.length,
    pageCount: normalizedPages.length,
  };
}
