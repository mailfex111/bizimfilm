"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Yeni şifreniz en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Girilen şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(
          updateErr.message ||
            "Şifre güncellenemedi. Sıfırlama bağlantısının süresi dolmuş olabilir."
        );
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 1800);
    } catch {
      setError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F5F7] flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#A1A1A6] hover:text-[#F5F5F7] mb-8 transition-apple cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Miora&apos;ya dön</span>
        </button>

        <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
          Yeni şifre belirleyin.
        </h1>
        <p className="mt-2 text-[14px] text-[#A1A1A6]">
          Hesabınız için güçlü ve hatırlayabileceğiniz yeni bir şifre oluşturun.
        </p>

        {success ? (
          <div className="mt-8 rounded-xl border border-[#343438] bg-[#18181B] p-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#D88A96] shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-[#F5F5F7]">
                Şifreniz başarıyla güncellendi.
              </p>
              <p className="text-[13px] text-[#A1A1A6] mt-1">
                Ana sayfaya yönlendiriliyorsunuz...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label
                htmlFor="new-password"
                className="block text-[13px] font-medium text-[#A1A1A6] mb-2"
              >
                Yeni şifre (en az 8 karakter)
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-[#343438] bg-[#18181B] pl-3.5 pr-10 py-2.5 text-[15px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Şifreyi göster/gizle"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-[13px] font-medium text-[#A1A1A6] mb-2"
              >
                Yeni şifre (tekrar)
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[15px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[#D88A96]/40 bg-[#18181B] p-3 text-[13px] text-[#F5F5F7]"
              >
                <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#F5F5F7] hover:bg-white py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-50"
            >
              {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
