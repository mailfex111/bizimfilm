"use client";

import React, { useState } from "react";
import { ShieldCheck, Copy, Check, Download, ArrowRight } from "lucide-react";

interface RecoveryCodesScreenProps {
  codes: string[];
  username: string;
  onConfirm: () => void;
}

export default function RecoveryCodesScreen({
  codes,
  username,
  onConfirm,
}: RecoveryCodesScreenProps) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const formattedText = [
    "Miora — Tek Kullanımlık Hesap Kurtarma Kodları",
    username ? `Kullanıcı adı: ${username}` : "",
    `Oluşturulma: ${new Date().toLocaleString("tr-TR")}`,
    "",
    "Her kod yalnızca BİR KEZ kullanılabilir. Bu kodları şifrenizi unuttuğunuzda",
    "hesabınıza yeniden erişmek için güvenli bir yerde saklayın.",
    "",
    ...codes.map((c, idx) => `${idx + 1}. ${c}`),
  ]
    .filter(Boolean)
    .join("\n");

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleDownload = () => {
    const blob = new Blob([formattedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `miora-kurtarma-kodlari-${username || "hesap"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F5F7] flex flex-col">
      <header className="w-full border-b border-[#343438]/60 px-6 py-4 flex items-center justify-between">
        <span className="text-[18px] font-semibold tracking-[-0.025em]">Miora</span>
        <span className="text-[12px] text-[#A1A1A6]">Hesap Güvenliği</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-[#343438] bg-[#18181B] p-6 sm:p-9 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-[#D88A96]">
              <ShieldCheck className="h-4 w-4" />
              <span>Yalnızca Bir Kez Gösterilir</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em]">
              Kurtarma kodlarınızı saklayın.
            </h1>
            <p className="text-[14px] leading-relaxed text-[#A1A1A6]">
              Miora hesabınız e-posta veya telefon olmadan çalışır. Şifrenizi unutursanız
              aşağıdaki tek kullanımlık kodlardan biriyle yeni şifre belirleyebilirsiniz.
              Güvenliğiniz için bu kodlar sunucuda düz metin olarak saklanmaz ve bir daha
              görüntülenemez.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-[#343438] bg-[#101012] p-4">
            {codes.map((code, idx) => (
              <div
                key={code}
                className="flex items-center justify-between rounded-lg bg-[#18181B] border border-[#343438]/60 px-3 py-2.5 font-mono text-[13px] tracking-wider text-[#F5F5F7] select-all"
              >
                <span className="text-[11px] text-[#A1A1A6] mr-2 select-none">
                  {idx + 1}.
                </span>
                <span className="flex-1 text-center">{code}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => void handleCopyAll()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-4 py-2.5 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-[#D88A96]" />
                  <span>Kodlar Kopyalandı</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Tümünü Kopyala</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] px-4 py-2.5 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>.txt Olarak İndir</span>
            </button>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-[#343438]/70 bg-[#101012] p-3.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#D88A96] cursor-pointer"
            />
            <span className="text-[13px] text-[#A1A1A6] leading-snug">
              Tek kullanımlık kurtarma kodlarımı güvenli bir yere kopyaladım veya indirdim.
            </span>
          </label>

          <button
            type="button"
            disabled={!acknowledged}
            onClick={onConfirm}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Devam Et</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
