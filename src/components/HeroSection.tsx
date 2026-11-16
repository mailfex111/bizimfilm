"use client";

import React from "react";
import { Heart, Play, Plus } from "lucide-react";

interface HeroSectionProps {
  onOpenMemoryBook: () => void;
  onAddMemory: () => void;
}

export default function HeroSection({
  onOpenMemoryBook,
  onAddMemory,
}: HeroSectionProps) {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="mx-auto relative max-w-[1440px] min-h-[185px] sm:min-h-[195px] lg:min-h-[205px] flex items-center px-4 sm:px-6 lg:px-10 py-4">
        {/* Background Romantic Couple Image positioned on the right like the reference */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-full md:w-[75%] lg:w-[72%]">
            <img
              src="/images/hero-couple.webp"
              alt="Gün batımında romantik çift"
              fetchPriority="high"
              className="h-full w-full object-cover object-center"
            />
            {/* Smooth left fade into deep burgundy background only on left edge */}
            <div className="absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-[#120508] via-[#120508]/65 to-transparent" />
            {/* Smooth right edge vignette */}
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#120508] to-transparent" />
          </div>
          {/* Subtle bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#110508] to-transparent" />
        </div>

        {/* Left Foreground Content */}
        <div className="relative z-10 max-w-xl">
          <h1 className="flex items-center gap-2.5 text-2xl sm:text-3xl lg:text-[38px] font-bold tracking-tight text-white leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
            <span>Bizim Hikayemiz</span>
            <Heart className="h-6 w-6 sm:h-7 sm:w-7 text-white/90 stroke-[1.8] shrink-0" />
          </h1>

          <p className="mt-1.5 max-w-md text-xs sm:text-[14px] leading-relaxed text-rose-50/85 font-normal drop-shadow">
            Fotoğraflarımız, videolarımız, müziklerimiz ve
            <br className="hidden sm:inline" /> tüm anılarımız... Tek bir yerde.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenMemoryBook}
              className="inline-flex items-center gap-2 rounded-lg bg-[#c81e3a] hover:bg-[#df2343] active:scale-[0.99] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_22px_rgba(200,30,58,0.5)] transition cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-white text-white" />
              <span>Anı Kitabını Aç</span>
            </button>

            <button
              type="button"
              onClick={onAddMemory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/20 bg-[#2b141b]/80 hover:bg-[#3b1b25] active:scale-[0.99] px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-rose-100" />
              <span>Anı Ekle</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
