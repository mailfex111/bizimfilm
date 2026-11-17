"use client";

import React from "react";
import { BookOpen, Plus } from "lucide-react";

interface HeroSectionProps {
  onOpenMemoryBook: () => void;
  onAddMemory: () => void;
}

export default function HeroSection({
  onOpenMemoryBook,
  onAddMemory,
}: HeroSectionProps) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 pt-4 pb-3">
      <div className="relative overflow-hidden rounded-2xl border border-[#343438]/70 bg-[#18181B] min-h-[260px] sm:min-h-[290px] lg:min-h-[315px] flex items-end">
        {/* Cinematic Background Photograph */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src="/images/hero-couple.webp"
            alt="Bizim Hikayemiz"
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
          {/* Controlled Dark Gradient for Crisp Readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(16,16,18,0.92) 0%, rgba(16,16,18,0.68) 46%, rgba(16,16,18,0.18) 100%), linear-gradient(180deg, rgba(16,16,18,0.12) 0%, rgba(16,16,18,0.86) 100%)",
            }}
          />
        </div>

        {/* Editorial Hero Content */}
        <div className="relative z-10 w-full max-w-2xl p-6 sm:p-10 lg:p-12">
          <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-semibold tracking-[-0.03em] leading-[1.06] text-[#F5F5F7]">
            Bizim Hikayemiz.
          </h1>

          <p className="mt-3 max-w-lg text-[15px] sm:text-[17px] leading-[1.55] text-[#A1A1A6] font-normal">
            Birlikte geçen her an, burada yaşamaya devam ediyor.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenMemoryBook}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white active:scale-[0.99] px-5 py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-[#101012]" />
              <span>Anı Kitabını Aç</span>
            </button>

            <button
              type="button"
              onClick={onAddMemory}
              className="inline-flex items-center gap-2 rounded-lg border border-[#343438] bg-[#222226]/90 hover:bg-[#2b2b30] active:scale-[0.99] px-5 py-2.5 text-[14px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <Plus className="h-4 w-4 text-[#A1A1A6]" />
              <span>Yeni Anı Ekle</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
