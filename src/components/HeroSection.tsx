"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Plus, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDaysSince } from "@/lib/dateUtils";
import { getSignedUrl, uploadCoupleMedia } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

interface HeroSectionProps {
  onOpenMemoryBook: () => void;
  onAddMemory: () => void;
}

export default function HeroSection({
  onOpenMemoryBook,
  onAddMemory,
}: HeroSectionProps) {
  const { couple, members, refreshAccount } = useAuth();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    let active = true;
    const loadCover = async () => {
      if (!couple?.cover_image_path) {
        setCoverUrl(null);
        return;
      }
      const signed = await getSignedUrl("book-assets", couple.cover_image_path);
      if (active) setCoverUrl(signed);
    };
    void loadCover();
    return () => {
      active = false;
    };
  }, [couple?.cover_image_path]);

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !couple) return;
    setUploadingCover(true);
    try {
      const uploaded = await uploadCoupleMedia({
        coupleId: couple.id,
        file,
        mediaType: "book_asset",
        title: "Kapak Fotoğrafı",
      });
      const supabase = createClient();
      await supabase
        .from("couples")
        .update({ cover_image_path: uploaded.storage_path })
        .eq("id", couple.id);
      await refreshAccount();
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  };

  const daysTogether = getDaysSince(couple?.relationship_start_date);
  const partnerCount = members.length;

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 pt-4 pb-3">
      <div className="relative overflow-hidden rounded-2xl border border-[#343438]/70 bg-[#18181B] min-h-[260px] sm:min-h-[290px] lg:min-h-[315px] flex items-end">
        {/* Background: Couple's Real Cover Image or Subtle Editorial Ambient Canvas */}
        <div className="pointer-events-none absolute inset-0 z-0">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={couple?.couple_name || "Bizim Hikayemiz"}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <img
              src="/images/hero-couple.webp"
              alt="Bizim Hikayemiz"
              fetchPriority="high"
              className="h-full w-full object-cover object-center opacity-50"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(16,16,18,0.94) 0%, rgba(16,16,18,0.72) 48%, rgba(16,16,18,0.22) 100%), linear-gradient(180deg, rgba(16,16,18,0.14) 0%, rgba(16,16,18,0.88) 100%)",
            }}
          />
        </div>

        {/* Discreet Cover Photo Upload Trigger */}
        <label className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-lg border border-[#343438]/80 bg-[#101012]/70 hover:bg-[#18181B] px-3 py-1.5 text-[12px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] backdrop-blur-xs transition-apple cursor-pointer">
          <ImageIcon className="h-3.5 w-3.5" />
          <span>{uploadingCover ? "Yükleniyor..." : "Kapak Değiştir"}</span>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/*"
            onChange={handleUploadCover}
            disabled={uploadingCover}
            className="hidden"
          />
        </label>

        {/* Editorial Hero Content */}
        <div className="relative z-10 w-full max-w-2xl p-6 sm:p-10 lg:p-12">
          {daysTogether !== null && (
            <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.12em] text-[#D88A96]">
              Birlikte {daysTogether.toLocaleString("tr-TR")}. gün
              {partnerCount < 2 ? " • Partner daveti bekleniyor" : ""}
            </div>
          )}

          <h1 className="text-[34px] sm:text-[46px] lg:text-[54px] font-semibold tracking-[-0.03em] leading-[1.06] text-[#F5F5F7]">
            {couple?.couple_name || "Bizim Hikayemiz."}
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
