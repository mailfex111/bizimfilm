"use client";

import React from "react";
import { Play } from "lucide-react";
import { type NavTab } from "@/types";

interface ContinueRowProps {
  onSelectTab: (tab: NavTab) => void;
  photoCount?: number;
  bookProgress?: number;
}

export default function ContinueRow({
  onSelectTab,
  photoCount = 248,
  bookProgress = 72,
}: ContinueRowProps) {
  const displayPhotoCount = photoCount > 6 ? 248 + (photoCount - 6) : 248;

  const cards: {
    id: string;
    title: string;
    subtitle?: string;
    progress?: number;
    image: string;
    targetTab: NavTab;
    hasPlayOverlay?: boolean;
  }[] = [
    {
      id: "ani-kitabi",
      title: "Anı Kitabı",
      progress: bookProgress,
      image: "/images/card-book.webp",
      targetTab: "ani-kitabi",
    },
    {
      id: "videolarimiz",
      title: "Videolarımız",
      subtitle: "12 video",
      image: "/images/card-videos.webp",
      targetTab: "videolar",
      hasPlayOverlay: true,
    },
    {
      id: "fotograflarimiz",
      title: "Fotoğraflarımız",
      subtitle: `${displayPhotoCount} fotoğraf`,
      image: "/images/card-photos.webp",
      targetTab: "fotograflar",
    },
    {
      id: "muzik-listemiz",
      title: "Müzik Listemiz",
      subtitle: "37 şarkı",
      image: "/images/card-music.webp",
      targetTab: "muzik",
    },
    {
      id: "ozel-gunler",
      title: "Özel Günler",
      subtitle: "8 tarih",
      image: "/images/card-dates.webp",
      targetTab: "ozel-gunler",
    },
    {
      id: "notlarimiz",
      title: "Notlarımız",
      subtitle: "14 not",
      image: "/images/card-notes.webp",
      targetTab: "notlar",
    },
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 pt-0.5 pb-2.5">
      <h2 className="text-sm sm:text-[15px] font-semibold text-white mb-2 tracking-tight">
        Devam Et
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectTab(card.targetTab)}
            className="group relative h-[86px] sm:h-[90px] w-full overflow-hidden rounded-xl border border-rose-200/15 bg-[#1c090e] text-left shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300/35 hover:shadow-[0_10px_24px_rgba(200,30,58,0.22)] cursor-pointer focus:outline-none"
          >
            {/* Card Artwork */}
            <img
              src={card.image}
              alt={card.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />

            {/* Smooth Dark Burgundy Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#140509] via-[#140509]/50 to-transparent" />

            {/* Subtle Center Play Triangle on Videolarımız */}
            {card.hasPlayOverlay && (
              <div className="absolute inset-0 flex items-center justify-center pb-3">
                <Play className="h-3 w-3 fill-white/90 text-white/90 drop-shadow" />
              </div>
            )}

            {/* Bottom Content */}
            <div className="absolute inset-x-0 bottom-0 p-2 flex flex-col justify-end">
              {typeof card.progress === "number" ? (
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold text-white leading-none">
                      {card.title}
                    </span>
                    <span className="text-[10px] font-medium text-rose-200/75 leading-none">
                      %{card.progress}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#e64965] to-[#f47b90]"
                      style={{ width: `${card.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-semibold text-white leading-tight">
                    {card.title}
                  </div>
                  {card.subtitle && (
                    <div className="mt-0.5 text-[10px] text-rose-100/70 leading-tight">
                      {card.subtitle}
                    </div>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
