"use client";

import React, { useState } from "react";
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { exportCoupleBackup, importCoupleBackup } from "@/lib/backup";
import { COUPLE_ACCOUNTS } from "@/lib/db";
import { type CoupleId } from "@/types";

interface SettingsBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupleId: CoupleId;
  photosCount: number;
  pagesCount: number;
  onDataRestored: () => Promise<void>;
}

export default function SettingsBackupModal({
  isOpen,
  onClose,
  coupleId,
  photosCount,
  pagesCount,
  onDataRestored,
}: SettingsBackupModalProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const couple = COUPLE_ACCOUNTS[coupleId];
  const coupleDisplayName = couple
    ? `${couple.partner1Name} ve ${couple.partner2Name}`
    : "Bizim Hikayemiz";

  const handleExport = async () => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await exportCoupleBackup(coupleId);
      setStatusMessage(
        `${coupleDisplayName} hesabına ait ${photosCount} fotoğraf ve ${pagesCount} kitap sayfası dışa aktarıldı.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Yedek dışa aktarılırken hata oluştu."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await importCoupleBackup(coupleId, file);
      await onDataRestored();
      setStatusMessage(
        `Yedek içe aktarıldı (${result.photoCount} fotoğraf, ${result.pageCount} sayfa).`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Yedek dosyası içe aktarılamadı."
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[#343438] bg-[#18181B] p-6 text-[#F5F5F7] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#343438] pb-4 mb-5">
          <div>
            <h3 className="text-[17px] font-semibold text-[#F5F5F7]">
              Veri ve Yedekleme — {coupleDisplayName}
            </h3>
            <p className="text-[12px] text-[#A1A1A6] mt-0.5">
              Yerel arşivinizi yedekleyin veya mevcut bir yedeği geri yükleyin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 mb-4">
          <div className="text-[13px] font-medium text-[#F5F5F7]">
            {coupleDisplayName}
          </div>
          <p className="text-[12px] text-[#A1A1A6] mt-1">
            {photosCount} fotoğraf • {pagesCount} kitap sayfası yerel veritabanında (IndexedDB) kayıtlı
          </p>
        </div>

        <div className="rounded-xl border border-[#343438]/80 bg-[#101012] p-3.5 mb-5 text-[12px] text-[#A1A1A6] leading-relaxed">
          Fotoğraflarınız ve anı kitabı sayfalarınız tarayıcınızın yerel hafızasında saklanır.
          Tarayıcı verilerini temizlerseniz kayıtlar silinebileceğinden önemli değişiklikler
          sonrasında yedek dosyası indirmeniz önerilir.
        </div>

        {statusMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#343438] bg-[#222226] p-3 text-[12px] text-[#F5F5F7]">
            <CheckCircle2 className="h-4 w-4 text-[#D88A96] shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#D88A96]/40 bg-[#222226] p-3 text-[12px] text-[#F5F5F7]">
            <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExport()}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white py-2.5 px-4 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Verileri Dışa Aktar</span>
          </button>

          <label className="flex items-center justify-center gap-2 rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] py-2.5 px-4 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer">
            <Upload className="h-4 w-4 text-[#A1A1A6]" />
            <span>Yedeği İçe Aktar</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              disabled={busy}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
