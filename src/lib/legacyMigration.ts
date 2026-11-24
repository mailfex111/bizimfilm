"use client";

import Dexie from "dexie";
import { createClient } from "@/lib/supabase/client";
import { computeSha256Hex } from "@/lib/mediaOptimizer";
import { uploadCoupleMedia } from "@/lib/storage";

const LEGACY_DB_NAMES = [
  "BizimFilmDB_v2_cift1",
  "BizimFilmDB_v2_cift2",
  "BizimFilmDB_v2_cift3",
  "BizimFilmDB_cift1",
  "BizimFilmDB_cift2",
  "BizimFilmDB_cift3",
];

const SEED_TITLES = new Set([
  "Bizim Hikayemiz",
  "Bizim Hikayemiz ♡",
  "Yıldızların Altında",
  "İlk Gün Batımımız",
  "İlk Gün Batımımız ♡",
  "Bizim Şarkımız Çalarken",
  "Sana Yazdığım Mektuplar",
  "Sonsuza Dek Biz ♡",
  "Birlikte Nice Yıllara",
]);

export interface LegacyPhotoRecord {
  id: string;
  sourceDb: string;
  title: string;
  date: string;
  dataUrl: string;
  mimeType: string;
}

export interface LegacyBookPageRecord {
  id: string;
  sourceDb: string;
  title: string;
  date: string;
  content: string;
  photoUrl: string | null;
}

export interface LegacyInspectionResult {
  hasRealUserData: boolean;
  photos: LegacyPhotoRecord[];
  pages: LegacyBookPageRecord[];
  detectedDatabases: string[];
}

export async function inspectLegacyIndexedDB(): Promise<LegacyInspectionResult> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return { hasRealUserData: false, photos: [], pages: [], detectedDatabases: [] };
  }

  let existingNames: string[] = [];
  if (typeof window.indexedDB.databases === "function") {
    try {
      const list = await window.indexedDB.databases();
      existingNames = list
        .map((d) => d.name || "")
        .filter((name) => LEGACY_DB_NAMES.includes(name));
    } catch {
      existingNames = [];
    }
  }

  const photos: LegacyPhotoRecord[] = [];
  const pages: LegacyBookPageRecord[] = [];

  for (const dbName of existingNames) {
    const db = new Dexie(dbName);
    try {
      db.version(1).stores({
        photos: "id, coupleId, createdAt, date",
        bookPages: "id, coupleId, order, updatedAt",
        coupleState: "coupleId",
      });
      await db.open();

      const rawPhotos = (await db.table("photos").toArray()) as Array<{
        id: string;
        title?: string;
        date?: string;
        dataUrl?: string;
        mimeType?: string;
        isSeed?: boolean;
      }>;

      for (const p of rawPhotos) {
        // Strictly ignore static demo seed assets (/images/...)
        if (!p.isSeed && p.dataUrl && p.dataUrl.startsWith("data:image/")) {
          photos.push({
            id: p.id,
            sourceDb: dbName,
            title: p.title || "Yerel Fotoğraf",
            date: p.date || new Date().toISOString().slice(0, 10),
            dataUrl: p.dataUrl,
            mimeType: p.mimeType || "image/webp",
          });
        }
      }

      const rawPages = (await db.table("bookPages").toArray()) as Array<{
        id: string;
        title?: string;
        date?: string;
        content?: string;
        photoUrl?: string | null;
      }>;

      for (const pg of rawPages) {
        const isStaticSeedPhoto =
          !pg.photoUrl || pg.photoUrl.startsWith("/images/");
        const isStaticSeedTitle = SEED_TITLES.has((pg.title || "").trim());
        const isCustomPage =
          !pg.id.match(/-page-[1-6]$/) || !isStaticSeedPhoto || !isStaticSeedTitle;

        if (isCustomPage) {
          pages.push({
            id: pg.id,
            sourceDb: dbName,
            title: (pg.title || "Anı Sayfası").replace(/\s*♡/g, "").trim(),
            date: pg.date || "",
            content: (pg.content || "").replace(/\s*♡/g, "").trim(),
            photoUrl:
              pg.photoUrl && pg.photoUrl.startsWith("data:image/")
                ? pg.photoUrl
                : null,
          });
        }
      }
    } catch {
      // Skip unreadable legacy DB
    } finally {
      db.close();
    }
  }

  return {
    hasRealUserData: photos.length > 0 || pages.length > 0,
    photos,
    pages,
    detectedDatabases: existingNames,
  };
}

export function downloadLegacyLocalBackup(data: LegacyInspectionResult): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: "Miora Legacy IndexedDB Backup",
    photos: data.photos,
    pages: data.pages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `miora-yerel-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/webp" });
}

export async function migrateLegacyToSupabase(
  coupleId: string,
  targetBookId: string,
  data: LegacyInspectionResult,
  onProgress?: (msg: string) => void
): Promise<{ uploadedPhotos: number; skippedPhotos: number; importedPages: number; skippedPages: number }> {
  const supabase = createClient();
  let uploadedPhotos = 0;
  let skippedPhotos = 0;
  let importedPages = 0;
  let skippedPages = 0;

  // Fetch existing dedup hashes to guarantee idempotency
  const { data: existingMedia } = await supabase
    .from("media")
    .select("id, dedup_hash")
    .eq("couple_id", coupleId)
    .not("dedup_hash", "is", null);

  const existingPhotoHashes = new Map<string, string>(
    (existingMedia || []).map((m) => [m.dedup_hash as string, m.id as string])
  );

  const photoUrlToMediaId = new Map<string, string>();

  for (let i = 0; i < data.photos.length; i++) {
    const p = data.photos[i];
    onProgress?.(`Fotoğraf aktarılıyor (${i + 1}/${data.photos.length})...`);
    const file = await dataUrlToFile(p.dataUrl, `${p.title || "photo"}.webp`);
    const hash = await computeSha256Hex(file);

    const existingId = existingPhotoHashes.get(hash);
    if (existingId) {
      skippedPhotos++;
      photoUrlToMediaId.set(p.dataUrl, existingId);
      continue;
    }

    const uploaded = await uploadCoupleMedia({
      coupleId,
      file,
      mediaType: "photo",
      title: p.title,
      memoryDate: /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : null,
      dedupHash: hash,
    });
    uploadedPhotos++;
    existingPhotoHashes.set(hash, uploaded.id);
    photoUrlToMediaId.set(p.dataUrl, uploaded.id);
  }

  // Fetch existing book pages for idempotency
  const { data: existingPages } = await supabase
    .from("memory_pages")
    .select("id, page_order, dedup_hash")
    .eq("book_id", targetBookId);

  const existingPageHashes = new Set<string>(
    (existingPages || []).map((ep) => ep.dedup_hash).filter(Boolean) as string[]
  );
  let nextOrder =
    existingPages && existingPages.length > 0
      ? Math.max(...existingPages.map((ep) => ep.page_order)) + 1
      : 0;

  for (let i = 0; i < data.pages.length; i++) {
    const pg = data.pages[i];
    onProgress?.(`Kitap sayfası aktarılıyor (${i + 1}/${data.pages.length})...`);

    const pageHash = await computeSha256Hex(
      new Blob([`${pg.title}|${pg.date}|${pg.content}`])
    );
    if (existingPageHashes.has(pageHash)) {
      skippedPages++;
      continue;
    }

    const { data: insertedPage, error: pageErr } = await supabase
      .from("memory_pages")
      .insert({
        book_id: targetBookId,
        couple_id: coupleId,
        page_order: nextOrder++,
        title: pg.title,
        content: pg.content,
        memory_date: pg.date,
        layout_type: pg.photoUrl ? "photo-text" : "full-text",
        dedup_hash: pageHash,
      })
      .select("id")
      .single();

    if (!pageErr && insertedPage) {
      importedPages++;
      existingPageHashes.add(pageHash);

      if (pg.photoUrl) {
        let linkedMediaId = photoUrlToMediaId.get(pg.photoUrl);
        if (!linkedMediaId) {
          const file = await dataUrlToFile(pg.photoUrl, `${pg.title || "book-photo"}.webp`);
          const hash = await computeSha256Hex(file);
          linkedMediaId = existingPhotoHashes.get(hash);
          if (!linkedMediaId) {
            const uploaded = await uploadCoupleMedia({
              coupleId,
              file,
              mediaType: "photo",
              title: pg.title || "Kitap Fotoğrafı",
              dedupHash: hash,
            });
            linkedMediaId = uploaded.id;
            uploadedPhotos++;
          }
        }
        if (linkedMediaId) {
          await supabase.from("memory_page_elements").insert({
            page_id: insertedPage.id,
            couple_id: coupleId,
            element_type: "photo",
            media_id: linkedMediaId,
            layer_order: 0,
          });
        }
      }
    }
  }

  return { uploadedPhotos, skippedPhotos, importedPages, skippedPages };
}

export async function clearLegacyIndexedDB(dbNames: string[]): Promise<void> {
  for (const name of dbNames) {
    if (LEGACY_DB_NAMES.includes(name)) {
      await Dexie.delete(name);
    }
  }
}
