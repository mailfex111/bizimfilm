"use client";

import React from "react";
import { ArrowRight, Play, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type NavTab, type PhotoItem } from "@/types";

interface HomeContentSectionsProps {
  photos: PhotoItem[];
  onSelectTab: (tab: NavTab) => void;
  onOpenPhotoUpload: () => void;
}

const FEATURED_VIDEOS = [
  {
    id: "v1",
    title: "Gün Batımında Şehrin Işıkları",
    date: "14 Ağustos 2025",
    duration: "01:24",
    thumb: "/images/hero-couple.webp",
  },
  {
    id: "v2",
    title: "Mum Işığında Akşam Yemeğimiz",
    date: "02 Eylül 2025",
    duration: "02:18",
    thumb: "/images/polaroid-night.webp",
  },
  {
    id: "v3",
    title: "Sahil Yürüyüşü ve Dalga Sesleri",
    date: "19 Ekim 2025",
    duration: "00:54",
    thumb: "/images/card-videos.webp",
  },
];

const FEATURED_SONGS = [
  {
    index: "01",
    title: "Bizim Şarkımız",
    context: "İlk dans ettiğimiz akşam",
    duration: "3:56",
  },
  {
    index: "02",
    title: "Gün Batımı Melodisi",
    context: "Sahil yolunda dinlediğimiz",
    duration: "4:12",
  },
  {
    index: "03",
    title: "Gece Yarısı Fısıltısı",
    context: "Yağmurlu sonbahar akşamı",
    duration: "2:58",
  },
  {
    index: "04",
    title: "Seninle Her An",
    context: "Yıldönümü yemeğimiz",
    duration: "3:34",
  },
];

const MILESTONES = [
  {
    date: "14 Şubat 2024",
    title: "İlk Tanıştığımız Gün",
    detail: "Hikâyemizin başladığı ilk gün.",
  },
  {
    date: "22 Temmuz 2024",
    title: "İlk Yaz Yolculuğumuz",
    detail: "Ege kıyısında gün batımını izlediğimiz akşam.",
  },
  {
    date: "14 Şubat 2025",
    title: "Birinci Yıl Dönümümüz",
    detail: "Birlikte geride bıraktığımız 365 gün.",
  },
  {
    date: "14 Ağustos 2025",
    title: "Şehrin Üzerinde Gün Batımı",
    detail: "Unutulmaz yaz akşamımız.",
  },
];

export default function ContinueRow({
  photos,
  onSelectTab,
  onOpenPhotoUpload,
}: HomeContentSectionsProps) {
  const { currentCouple } = useAuth();
  const recentPhotos = photos.slice(0, 4);

  return (
    <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 space-y-14 pb-28">
      {/* 1. Son Eklenen Fotoğraflar — Apple Photos Archival Strip */}
      <section aria-label="Son Eklenen Fotoğraflar">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
              Son Eklenen Fotoğraflar
            </h2>
            <p className="text-[13px] text-[#A1A1A6] mt-0.5">
              Arşivinize eklediğiniz güncel kareler
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenPhotoUpload}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#D88A96] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Fotoğraf Yükle</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("fotograflar")}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <span>Tümünü Gör ({photos.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {recentPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onSelectTab("fotograflar")}
              className="group text-left focus:outline-none cursor-pointer"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B]">
                <img
                  src={photo.dataUrl}
                  alt={photo.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-medium text-[#F5F5F7] truncate">
                  {photo.title.replace(/\s*\([^)]*\)/g, "")}
                </span>
                <span className="text-[12px] text-[#A1A1A6] shrink-0 tabular-nums">
                  {photo.date}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Birlikte Geçen Günler — Editorial Typographic Timeline (Not Standard Cards) */}
      <section aria-label="Birlikte Geçen Günler">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
              Birlikte Geçen Günler
            </h2>
            <p className="text-[13px] text-[#A1A1A6] mt-0.5">
              {currentCouple?.partner1Name} &amp; {currentCouple?.partner2Name} • Başlangıç:{" "}
              {currentCouple?.anniversaryDate}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab("ozel-gunler")}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <span>Tüm Tarihler</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded-2xl border border-[#343438]/80 bg-[#18181B] divide-y sm:divide-y-0 sm:divide-x divide-[#343438]/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {MILESTONES.map((m, idx) => (
            <div
              key={idx}
              onClick={() => onSelectTab("ozel-gunler")}
              className="p-5 sm:p-6 hover:bg-[#222226]/50 transition-apple cursor-pointer flex flex-col justify-between"
            >
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#D88A96]">
                {m.date}
              </span>
              <div className="mt-3">
                <h3 className="text-[16px] font-semibold text-[#F5F5F7] tracking-[-0.01em]">
                  {m.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#A1A1A6]">
                  {m.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Videolarımız & 4. Bizim Şarkılarımız — Split Asymmetric Media Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Videolarımız (7 Columns: Widescreen 16:9 Cinema Frames) */}
        <section aria-label="Videolarımız" className="lg:col-span-7">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
                Videolarımız
              </h2>
              <p className="text-[13px] text-[#A1A1A6] mt-0.5">
                Hareketli anılar ve kısa kayıtlar
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("videolar")}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <span>12 Video</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FEATURED_VIDEOS.map((vid) => (
              <button
                key={vid.id}
                type="button"
                onClick={() => onSelectTab("videolar")}
                className="group text-left focus:outline-none cursor-pointer"
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B]">
                  <img
                    src={vid.thumb}
                    alt={vid.title}
                    loading="lazy"
                    className="h-full w-full object-cover opacity-90 transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-apple flex items-center justify-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101012]/80 border border-[#F5F5F7]/20 text-[#F5F5F7]">
                      <Play className="h-3.5 w-3.5 fill-[#F5F5F7] ml-0.5" />
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 rounded bg-[#101012]/85 px-1.5 py-0.5 text-[11px] font-medium text-[#F5F5F7] tabular-nums">
                    {vid.duration}
                  </span>
                </div>
                <div className="mt-2.5">
                  <div className="text-[15px] font-medium text-[#F5F5F7] truncate">
                    {vid.title}
                  </div>
                  <div className="text-[12px] text-[#A1A1A6] mt-0.5">{vid.date}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Bizim Şarkılarımız (5 Columns: Spotify-Style Minimal Tracklist) */}
        <section aria-label="Bizim Şarkılarımız" className="lg:col-span-5">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
                Bizim Şarkılarımız
              </h2>
              <p className="text-[13px] text-[#A1A1A6] mt-0.5">
                Anılarımıza eşlik eden seçki
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("muzik")}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <span>37 Şarkı</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="rounded-xl border border-[#343438]/80 bg-[#18181B] divide-y divide-[#343438]/50 overflow-hidden">
            {FEATURED_SONGS.map((song, i) => (
              <button
                key={song.index}
                type="button"
                onClick={() => onSelectTab("muzik")}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#222226] transition-apple cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`text-[12px] font-medium tabular-nums w-5 ${
                      i === 0 ? "text-[#D88A96]" : "text-[#A1A1A6]"
                    }`}
                  >
                    {song.index}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-[14px] font-medium truncate ${
                        i === 0 ? "text-[#D88A96]" : "text-[#F5F5F7]"
                      }`}
                    >
                      {song.title}
                    </div>
                    <div className="text-[12px] text-[#A1A1A6] truncate">
                      {song.context}
                    </div>
                  </div>
                </div>
                <span className="text-[12px] text-[#A1A1A6] tabular-nums ml-3 shrink-0">
                  {song.duration}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
