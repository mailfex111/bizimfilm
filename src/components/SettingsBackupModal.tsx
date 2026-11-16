"use client";

import React, { useState } from "react";
import {
  Download,
  Upload,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
} from "lucide-react";
import { exportCoupleBackup, importCoupleBackup } from "@/lib/backup";
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

  const handleExport = async () => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await exportCoupleBackup(coupleId);
      setStatusMessage(
        `${coupleId.toUpperCase()} hesabına ait ${photosCount} fotoğraf ve ${pagesCount} kitap sayfası başarıyla dışa aktarıldı.`
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
        `Yedek başarıyla içe aktarıldı! (${result.photoCount} fotoğraf, ${result.pageCount} kitap sayfası yüklendi.)`
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-rose-200/20 bg-[#210b11] p-6 text-white shadow-[0_25px_70px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center justify-between border-b border-rose-200/10 pb-3.5 mb-4">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-[#f06c82]" />
            <h3 className="text-base sm:text-lg font-bold">
              Hesap Ayarları ve Veri Yedekleme ({coupleId.toUpperCase()})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-rose-200/70 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Storage Summary */}
        <div className="rounded-xl border border-rose-200/15 bg-[#15060a] p-4 mb-4">
          <div className="text-xs font-semibold text-rose-200 mb-1">
            Aktif IndexedDB Veri Alanı: <code className="text-white">BizimFilmDB_{coupleId}</code>
          </div>
          <p className="text-xs text-rose-100/75">
            Kayıtlı Fotoğraf: <strong>{photosCount} adet</strong> • Anı Kitabı Sayfası:{" "}
            <strong>{pagesCount} sayfa</strong>
          </p>
        </div>

        {/* Browser Data Warning required by Prompt Section 7 */}
        <div className="rounded-xl border border-amber-400/25 bg-amber-950/30 p-3.5 mb-5 flex items-start gap-2.5 text-xs text-amber-100/90 leading-relaxed">
          <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <strong>Önemli Veri Saklama Uyarısı:</strong> Bu demoda tüm fotoğraflar ve anı kitabı
            sayfaları sunucu yerine tarayıcınızın <strong>IndexedDB</strong> veritabanında saklanır.
            Tarayıcı geçmişini veya site verilerini temizlerseniz IndexedDB kayıtları silinebilir.
            Verilerinizi korumak için aşağıdan yedek dosyası indirebilirsiniz.
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-950/70 p-3 text-xs text-emerald-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/75 p-3 text-xs text-rose-100">
            <AlertCircle className="h-4 w-4 text-rose-300 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Backup Export & Import Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExport()}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#c81e3a] hover:bg-[#e02444] py-3 px-4 text-xs sm:text-sm font-semibold text-white shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Verileri Dışa Aktar</span>
          </button>

          <label className="flex items-center justify-center gap-2 rounded-xl border border-rose-200/20 bg-white/5 hover:bg-white/10 py-3 px-4 text-xs sm:text-sm font-semibold text-rose-100 transition cursor-pointer">
            <Upload className="h-4 w-4 text-[#f06c82]" />
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
