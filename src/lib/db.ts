import Dexie, { type Table } from "dexie";
import {
  type BookPageItem,
  type CoupleAccount,
  type CoupleId,
  type CoupleState,
  type PhotoItem,
} from "@/types";

export const COUPLE_ACCOUNTS: Record<CoupleId, CoupleAccount> = {
  cift1: {
    id: "cift1",
    username: "cift1",
    partner1Name: "Emir",
    partner2Name: "Hazal",
    coupleTitle: "Bizim Hikayemiz",
    anniversaryDate: "14 Şubat 2024",
    avatar1: "/images/avatar-ben.webp",
    avatar2: "/images/avatar-sen.webp",
    songTitle: "Bizim Şarkımız",
    songSubtitle: "Sana Özel Çalma Listesi",
    bookProgress: 72,
  },
  cift2: {
    id: "cift2",
    username: "cift2",
    partner1Name: "Sümeyya",
    partner2Name: "Berke",
    coupleTitle: "Bizim Hikayemiz",
    anniversaryDate: "21 Haziran 2023",
    avatar1: "/images/avatar-ben.webp",
    avatar2: "/images/avatar-sen.webp",
    songTitle: "Bizim Şarkımız",
    songSubtitle: "Sümeyya & Berke Özel Listesi",
    bookProgress: 64,
  },
  cift3: {
    id: "cift3",
    username: "cift3",
    partner1Name: "Gamze",
    partner2Name: "Onur",
    coupleTitle: "Bizim Hikayemiz",
    anniversaryDate: "09 Eylül 2024",
    avatar1: "/images/avatar-ben.webp",
    avatar2: "/images/avatar-sen.webp",
    songTitle: "Bizim Şarkımız",
    songSubtitle: "Gamze & Onur Özel Listesi",
    bookProgress: 85,
  },
};

export class BizimFilmCoupleDB extends Dexie {
  photos!: Table<PhotoItem, string>;
  bookPages!: Table<BookPageItem, string>;
  coupleState!: Table<CoupleState, string>;

  constructor(coupleId: CoupleId) {
    // Separate IndexedDB namespace per demo couple
    super(`BizimFilmDB_v2_${coupleId}`);
    this.version(1).stores({
      photos: "id, coupleId, createdAt, date",
      bookPages: "id, coupleId, order, updatedAt",
      coupleState: "coupleId",
    });
  }
}

const dbInstances: Partial<Record<CoupleId, BizimFilmCoupleDB>> = {};

export function getCoupleDB(coupleId: CoupleId): BizimFilmCoupleDB {
  if (!dbInstances[coupleId]) {
    dbInstances[coupleId] = new BizimFilmCoupleDB(coupleId);
  }
  return dbInstances[coupleId]!;
}

function getInitialSeedPhotos(coupleId: CoupleId): PhotoItem[] {
  const now = Date.now();
  const prefix =
    coupleId === "cift1"
      ? " (Emir & Hazal)"
      : coupleId === "cift2"
      ? " (Sümeyya & Berke)"
      : " (Gamze & Onur)";

  return [
    {
      id: `${coupleId}-photo-1`,
      coupleId,
      title: `Gün Batımında Biz${prefix}`,
      date: "2025-08-14",
      dataUrl: "/images/polaroid-sunset.webp",
      mimeType: "image/webp",
      width: 900,
      height: 680,
      sizeBytes: 68400,
      createdAt: now - 600000,
      isSeed: true,
    },
    {
      id: `${coupleId}-photo-2`,
      coupleId,
      title: `Gece Işıkları ve Mumlarımız${prefix}`,
      date: "2025-09-02",
      dataUrl: "/images/polaroid-night.webp",
      mimeType: "image/webp",
      width: 900,
      height: 680,
      sizeBytes: 61200,
      createdAt: now - 500000,
      isSeed: true,
    },
    {
      id: `${coupleId}-photo-3`,
      coupleId,
      title: `Ellerimiz Hiç Ayrılmasın${prefix}`,
      date: "2025-10-19",
      dataUrl: "/images/polaroid-hands.webp",
      mimeType: "image/webp",
      width: 720,
      height: 820,
      sizeBytes: 54800,
      createdAt: now - 400000,
      isSeed: true,
    },
    {
      id: `${coupleId}-photo-4`,
      coupleId,
      title: `Şehrin Üzerinde Kalbimiz${prefix}`,
      date: "2025-11-05",
      dataUrl: "/images/hero-couple.webp",
      mimeType: "image/webp",
      width: 1280,
      height: 720,
      sizeBytes: 94200,
      createdAt: now - 300000,
      isSeed: true,
    },
    {
      id: `${coupleId}-photo-5`,
      coupleId,
      title: `Sahil Yürüyüşü Anımız${prefix}`,
      date: "2025-11-28",
      dataUrl: "/images/card-videos.webp",
      mimeType: "image/webp",
      width: 800,
      height: 520,
      sizeBytes: 49300,
      createdAt: now - 200000,
      isSeed: true,
    },
    {
      id: `${coupleId}-photo-6`,
      coupleId,
      title: `Polaroid Köşemiz${prefix}`,
      date: "2025-12-12",
      dataUrl: "/images/card-photos.webp",
      mimeType: "image/webp",
      width: 800,
      height: 520,
      sizeBytes: 52100,
      createdAt: now - 100000,
      isSeed: true,
    },
  ];
}

function getInitialSeedBookPages(coupleId: CoupleId): BookPageItem[] {
  const now = Date.now();

  const customNoteByCouple: Record<CoupleId, string> = {
    cift1: "Seninle geçen her an, zamanın en güzel yerinde duruyor.",
    cift2: "Sümeyya ve Berke — Seninle geçen her an daha anlamlı.",
    cift3: "Gamze ve Onur — Seninle geçen her an daha anlamlı.",
  };

  return [
    {
      id: `${coupleId}-page-1`,
      coupleId,
      order: 0,
      title: "Bizim Hikayemiz",
      date: "14 Ağustos 2025",
      content: "Seninle tanıştığım o günü hiçbir zaman unutmayacağım.",
      photoUrl: "/images/polaroid-sunset.webp",
      layoutVariant: "hero-left",
      updatedAt: now - 60000,
    },
    {
      id: `${coupleId}-page-2`,
      coupleId,
      order: 1,
      title: "Yıldızların Altında",
      date: "02 Eylül 2025",
      content: customNoteByCouple[coupleId],
      photoUrl: "/images/polaroid-night.webp",
      secondaryPhotoUrl: "/images/polaroid-hands.webp",
      hasVideoBadge: true,
      videoDurationText: "01:24",
      layoutVariant: "collage-right",
      updatedAt: now - 50000,
    },
    {
      id: `${coupleId}-page-3`,
      coupleId,
      order: 2,
      title: "İlk Gün Batımımız",
      date: "19 Ekim 2025",
      content:
        "Şehrin tüm ışıkları sönse bile senin gözlerindeki parıltı yolumuzu aydınlatmaya yeter.",
      photoUrl: "/images/hero-couple.webp",
      layoutVariant: "polaroid-standard",
      updatedAt: now - 40000,
    },
    {
      id: `${coupleId}-page-4`,
      coupleId,
      order: 3,
      title: "Bizim Şarkımız Çalarken",
      date: "05 Kasım 2025",
      content:
        "Aynı battaniyenin altında saatlerce konuştuğumuz, zamanın durduğu o akşamımız.",
      photoUrl: "/images/card-videos.webp",
      layoutVariant: "polaroid-standard",
      updatedAt: now - 30000,
    },
    {
      id: `${coupleId}-page-5`,
      coupleId,
      order: 4,
      title: "Sana Yazdığım Mektuplar",
      date: "24 Kasım 2025",
      content:
        "Her sayfada yeni bir tebessüm, her fotoğrafta kalbimin en güzel hatırası saklı.",
      photoUrl: "/images/card-notes.webp",
      layoutVariant: "polaroid-standard",
      updatedAt: now - 20000,
    },
    {
      id: `${coupleId}-page-6`,
      coupleId,
      order: 5,
      title: "Birlikte Nice Yıllara",
      date: "14 Şubat 2026",
      content:
        "Birlikte ekleyeceğimiz nice yeni sayfalara, nice güzel yıllara.",
      photoUrl: "/images/polaroid-hands.webp",
      layoutVariant: "polaroid-standard",
      updatedAt: now - 10000,
    },
  ];
}

export async function ensureCoupleSeedData(coupleId: CoupleId): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getCoupleDB(coupleId);

  const state = await db.coupleState.get(coupleId);
  if (state) {
    // Non-destructive migration: strip decorative heart symbols from untouched seed pages
    const existing = await db.bookPages.toArray();
    const updatedSeedPages = existing.filter(
      (p) => p.title.includes("♡") || p.content.includes("♡")
    );
    if (updatedSeedPages.length > 0) {
      await db.bookPages.bulkPut(
        updatedSeedPages.map((p) => ({
          ...p,
          title: p.title.replace(/\s*♡/g, "").trim(),
          content: p.content.replace(/\s*♡/g, "").trim(),
        }))
      );
    }
    return;
  }

  await db.transaction("rw", db.photos, db.bookPages, db.coupleState, async () => {
    const existingPages = await db.bookPages.count();
    if (existingPages === 0) {
      await db.bookPages.bulkPut(getInitialSeedBookPages(coupleId));
    }

    const existingPhotos = await db.photos.count();
    if (existingPhotos === 0) {
      await db.photos.bulkPut(getInitialSeedPhotos(coupleId));
    }

    await db.coupleState.put({
      coupleId,
      lastOpenPage: 0,
      updatedAt: Date.now(),
    });
  });
}

export async function getCouplePhotos(coupleId: CoupleId): Promise<PhotoItem[]> {
  await ensureCoupleSeedData(coupleId);
  const db = getCoupleDB(coupleId);
  const list = await db.photos.toArray();
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addCouplePhoto(photo: PhotoItem): Promise<void> {
  const db = getCoupleDB(photo.coupleId);
  await db.photos.put(photo);
}

export async function updateCouplePhoto(
  coupleId: CoupleId,
  photoId: string,
  updates: Partial<Pick<PhotoItem, "title" | "date">>
): Promise<void> {
  const db = getCoupleDB(coupleId);
  await db.photos.update(photoId, updates);
}

export async function deleteCouplePhoto(
  coupleId: CoupleId,
  photoId: string
): Promise<void> {
  const db = getCoupleDB(coupleId);
  await db.photos.delete(photoId);
}

export async function getCoupleBookPages(
  coupleId: CoupleId
): Promise<BookPageItem[]> {
  await ensureCoupleSeedData(coupleId);
  const db = getCoupleDB(coupleId);
  const pages = await db.bookPages.toArray();
  return pages.sort((a, b) => a.order - b.order);
}

export async function saveCoupleBookPage(page: BookPageItem): Promise<void> {
  const db = getCoupleDB(page.coupleId);
  await db.bookPages.put({
    ...page,
    updatedAt: Date.now(),
  });
}

export async function deleteCoupleBookPage(
  coupleId: CoupleId,
  pageId: string
): Promise<BookPageItem[]> {
  const db = getCoupleDB(coupleId);
  await db.bookPages.delete(pageId);
  const remaining = await getCoupleBookPages(coupleId);
  // Normalize order indices
  const reordered = remaining.map((p, idx) => ({
    ...p,
    order: idx,
    updatedAt: Date.now(),
  }));
  await db.bookPages.bulkPut(reordered);
  return reordered;
}

export async function reorderCoupleBookPages(
  coupleId: CoupleId,
  orderedPages: BookPageItem[]
): Promise<BookPageItem[]> {
  const db = getCoupleDB(coupleId);
  const normalized = orderedPages.map((p, idx) => ({
    ...p,
    order: idx,
    updatedAt: Date.now(),
  }));
  await db.bookPages.bulkPut(normalized);
  return normalized;
}

export async function getLastOpenBookPage(coupleId: CoupleId): Promise<number> {
  await ensureCoupleSeedData(coupleId);
  const db = getCoupleDB(coupleId);
  const state = await db.coupleState.get(coupleId);
  return state?.lastOpenPage ?? 0;
}

export async function setLastOpenBookPage(
  coupleId: CoupleId,
  pageIndex: number
): Promise<void> {
  const db = getCoupleDB(coupleId);
  await db.coupleState.put({
    coupleId,
    lastOpenPage: Math.max(0, pageIndex),
    updatedAt: Date.now(),
  });
}
