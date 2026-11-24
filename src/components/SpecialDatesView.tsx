"use client";

import React, { useState } from "react";
import { Plus, Trash2, Calendar, Edit3, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  formatTurkishDate,
  getDaysSince,
  getDaysUntilNextOccurrence,
} from "@/lib/dateUtils";
import { type SpecialDateCategory, type SpecialDateItem } from "@/types";

interface SpecialDatesViewProps {
  coupleId: string;
  dates: SpecialDateItem[];
  onDatesChange: () => Promise<void>;
}

const CATEGORIES: { id: SpecialDateCategory; label: string }[] = [
  { id: "met", label: "Tanışma Tarihi" },
  { id: "dating", label: "Sevgili Olma" },
  { id: "anniversary", label: "Yıl Dönümü" },
  { id: "birthday", label: "Doğum Günü" },
  { id: "wedding", label: "Evlilik Tarihi" },
  { id: "custom", label: "Özel Etkinlik" },
];

export default function SpecialDatesView({
  coupleId,
  dates,
  onDatesChange,
}: SpecialDatesViewProps) {
  const { user, couple, refreshAccount } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SpecialDateCategory>("anniversary");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [repeatYearly, setRepeatYearly] = useState(true);
  const [saving, setSaving] = useState(false);

  const [startDateInput, setStartDateInput] = useState(
    couple?.relationship_start_date || ""
  );
  const [editingStartDate, setEditingStartDate] = useState(false);

  const daysTogether = getDaysSince(couple?.relationship_start_date);
  const nextAnniversary = couple?.relationship_start_date
    ? getDaysUntilNextOccurrence(couple.relationship_start_date, true)
    : null;

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setCategory("anniversary");
    setEventDate("");
    setDescription("");
    setRepeatYearly(true);
    setShowForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;
    setSaving(true);

    const supabase = createClient();
    try {
      if (editingId) {
        await supabase
          .from("special_dates")
          .update({
            title: title.trim(),
            category,
            event_date: eventDate,
            description: description.trim(),
            repeat_yearly: repeatYearly,
          })
          .eq("id", editingId);
      } else {
        await supabase.from("special_dates").insert({
          couple_id: coupleId,
          title: title.trim(),
          category,
          event_date: eventDate,
          description: description.trim(),
          repeat_yearly: repeatYearly,
          created_by: user?.id || null,
        });
      }
      await onDatesChange();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("special_dates").delete().eq("id", id);
    await onDatesChange();
  };

  const handleSaveRelationshipStart = async () => {
    const supabase = createClient();
    await supabase
      .from("couples")
      .update({ relationship_start_date: startDateInput || null })
      .eq("id", coupleId);
    setEditingStartDate(false);
    await refreshAccount();
  };

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#343438]/70 pb-6 mb-8">
        <div>
          <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
            Özel Günler ve İlişki Sayacı
          </h1>
          <p className="mt-1 text-[14px] text-[#A1A1A6]">
            Dönüm noktalarınız, yıl dönümleriniz ve geri sayımlarınız.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2.5 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Özel Gün Ekle</span>
        </button>
      </div>

      {/* Real Relationship Counter Panel */}
      <div className="mb-8 rounded-2xl border border-[#343438] bg-[#18181B] p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#D88A96]">
            Birlikte Geçen Süre
          </span>
          <div className="mt-1 text-[34px] sm:text-[42px] font-semibold tracking-[-0.03em] text-[#F5F5F7] tabular-nums">
            {daysTogether !== null
              ? `${daysTogether.toLocaleString("tr-TR")} Gün`
              : "Tarih Belirlenmedi"}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#A1A1A6]">
            Sonraki Yıl Dönümü
          </span>
          <div className="mt-1 text-[22px] font-semibold text-[#F5F5F7] tabular-nums">
            {nextAnniversary
              ? nextAnniversary.isToday
                ? "Bugün Yıl Dönümünüz"
                : `${nextAnniversary.daysRemaining} gün kaldı`
              : "—"}
          </div>
          {nextAnniversary?.nextYearNumber && (
            <p className="text-[12px] text-[#A1A1A6]">
              {nextAnniversary.nextYearNumber}. yıl dönümü
            </p>
          )}
        </div>

        <div className="flex flex-col sm:items-end justify-center gap-2">
          {editingStartDate ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="rounded-lg border border-[#343438] bg-[#101012] px-3 py-1.5 text-[13px] text-[#F5F5F7]"
              />
              <button
                type="button"
                onClick={() => void handleSaveRelationshipStart()}
                className="rounded-lg bg-[#F5F5F7] px-3 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => setEditingStartDate(false)}
                className="p-1.5 text-[#A1A1A6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="text-[13px] text-[#A1A1A6]">
                Başlangıç:{" "}
                <strong className="text-[#F5F5F7]">
                  {couple?.relationship_start_date
                    ? formatTurkishDate(couple.relationship_start_date)
                    : "Belirtilmedi"}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStartDateInput(couple?.relationship_start_date || "");
                  setEditingStartDate(true);
                }}
                className="text-[12px] font-medium text-[#D88A96] hover:underline cursor-pointer"
              >
                Başlangıç tarihini düzenle
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="mb-8 rounded-xl border border-[#343438] bg-[#18181B] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#F5F5F7]">
              {editingId ? "Özel Günü Düzenle" : "Yeni Özel Gün Ekle"}
            </h2>
            <button type="button" onClick={resetForm} className="text-[#A1A1A6]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Başlık
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: İlk Tanıştığımız Gün"
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SpecialDateCategory)}
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Tarih
              </label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
              Açıklama (isteğe bağlı)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu güne dair kısa bir not..."
              className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="inline-flex items-center gap-2 text-[13px] text-[#A1A1A6] cursor-pointer">
              <input
                type="checkbox"
                checked={repeatYearly}
                onChange={(e) => setRepeatYearly(e.target.checked)}
                className="accent-[#D88A96]"
              />
              <span>Her yıl tekrarla</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-[#343438] px-4 py-2 text-[13px] text-[#A1A1A6]"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#F5F5F7] hover:bg-white px-5 py-2 text-[13px] font-medium text-[#101012] cursor-pointer"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </form>
      )}

      {dates.length === 0 ? (
        <div className="rounded-2xl border border-[#343438]/70 bg-[#18181B] px-6 py-16 text-center">
          <Calendar className="h-6 w-6 text-[#A1A1A6] mx-auto mb-2.5" />
          <p className="text-[16px] font-medium text-[#F5F5F7]">
            Henüz özel gün kaydı bulunmuyor.
          </p>
          <p className="mt-1 text-[13px] text-[#A1A1A6]">
            Tanışma tarihinizi, doğum günlerinizi veya evlilik yıl dönümünüzü ekleyin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {dates.map((item) => {
            const info = getDaysUntilNextOccurrence(item.event_date, item.repeat_yearly);
            const catLabel =
              CATEGORIES.find((c) => c.id === item.category)?.label || "Özel Gün";

            return (
              <div
                key={item.id}
                className="rounded-xl border border-[#343438] bg-[#18181B] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#D88A96]">
                      {catLabel}
                    </span>
                    <span className="text-[11px] text-[#A1A1A6] tabular-nums">
                      {info.isToday
                        ? "Bugün"
                        : info.isPastOneTime
                        ? `${info.daysRemaining} gün önce`
                        : `${info.daysRemaining} gün kaldı`}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#F5F5F7]">
                    {item.title}
                  </h3>
                  <p className="text-[12px] text-[#A1A1A6] mt-0.5">
                    {formatTurkishDate(item.event_date)}
                    {item.repeat_yearly ? " • Her yıl" : ""}
                  </p>
                  {item.description && (
                    <p className="mt-2.5 text-[13px] leading-relaxed text-[#A1A1A6]">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#343438]/60 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setTitle(item.title);
                      setCategory(item.category);
                      setEventDate(item.event_date);
                      setDescription(item.description || "");
                      setRepeatYearly(item.repeat_yearly);
                      setShowForm(true);
                    }}
                    className="rounded p-1.5 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="rounded p-1.5 text-[#A1A1A6] hover:text-[#D88A96] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
