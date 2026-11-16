export type CoupleId = "cift1" | "cift2" | "cift3";

export interface CoupleAccount {
  id: CoupleId;
  username: CoupleId;
  partner1Name: string;
  partner2Name: string;
  coupleTitle: string;
  anniversaryDate: string;
  avatar1: string;
  avatar2: string;
  songTitle: string;
  songSubtitle: string;
  bookProgress: number;
}

export interface PhotoItem {
  id: string;
  coupleId: CoupleId;
  title: string;
  date: string;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: number;
  isSeed?: boolean;
}

export interface BookPageItem {
  id: string;
  coupleId: CoupleId;
  order: number;
  title: string;
  date: string;
  content: string;
  photoUrl: string | null;
  secondaryPhotoUrl?: string | null;
  hasVideoBadge?: boolean;
  videoDurationText?: string;
  layoutVariant?: "hero-left" | "collage-right" | "polaroid-standard" | "note-only";
  updatedAt: number;
}

export interface CoupleState {
  coupleId: CoupleId;
  lastOpenPage: number;
  updatedAt: number;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  coupleId: CoupleId;
  photos: PhotoItem[];
  bookPages: BookPageItem[];
  coupleState?: CoupleState;
}

export type NavTab =
  | "ana-sayfa"
  | "ani-kitabi"
  | "fotograflar"
  | "videolar"
  | "muzik"
  | "biz"
  | "ozel-gunler"
  | "notlar";
