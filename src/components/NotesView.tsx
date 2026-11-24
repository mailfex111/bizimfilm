"use client";

import React, { useState } from "react";
import { Plus, Trash2, Edit3, X, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { type NoteItem } from "@/types";

interface NotesViewProps {
  coupleId: string;
  notes: NoteItem[];
  onNotesChange: () => Promise<void>;
}

export default function NotesView({ coupleId, notes, onNotesChange }: NotesViewProps) {
  const { user, members } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<"note" | "letter">("note");
  const [saving, setSaving] = useState(false);

  const authorMap = new Map(
    members.map((m) => [m.user_id, m.profile?.display_name || "Partner"])
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setNoteType("note");
    setShowForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !user) return;
    setSaving(true);
    const supabase = createClient();

    try {
      if (editingId) {
        await supabase
          .from("notes")
          .update({
            title: title.trim(),
            content: content.trim(),
            note_type: noteType,
          })
          .eq("id", editingId);
      } else {
        await supabase.from("notes").insert({
          couple_id: coupleId,
          created_by: user.id,
          title: title.trim(),
          content: content.trim(),
          note_type: noteType,
        });
      }
      await onNotesChange();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("notes").delete().eq("id", id);
    await onNotesChange();
  };

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#343438]/70 pb-6 mb-8">
        <div>
          <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
            Notlar ve Mektuplar
          </h1>
          <p className="mt-1 text-[14px] text-[#A1A1A6]">
            Birbirinize bıraktığınız özel satırlar. Yalnızca çift alanınızdan erişilebilir.
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
          <span>Yeni Not / Mektup</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="mb-8 rounded-xl border border-[#343438] bg-[#18181B] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#F5F5F7]">
              {editingId ? "Notu Düzenle" : "Partnerine Yaz"}
            </h2>
            <button type="button" onClick={resetForm} className="text-[#A1A1A6]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Başlık
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Sana küçük bir not"
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Tür
              </label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as "note" | "letter")}
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7]"
              >
                <option value="note">Kısa Not</option>
                <option value="letter">Mektup</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
              İçerik
            </label>
            <textarea
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="İçinizden geçenleri yazın..."
              className="w-full rounded-lg border border-[#343438] bg-[#101012] p-3.5 text-[14px] leading-relaxed text-[#F5F5F7]"
            />
          </div>

          <div className="flex justify-end gap-2">
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
        </form>
      )}

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-[#343438]/70 bg-[#18181B] px-6 py-16 text-center">
          <FileText className="h-6 w-6 text-[#A1A1A6] mx-auto mb-2.5" />
          <p className="text-[16px] font-medium text-[#F5F5F7]">
            Henüz not veya mektup yazmadınız.
          </p>
          <p className="mt-1 text-[13px] text-[#A1A1A6]">
            Partnerinize ilk notunuzu bırakın; anlık bildirimle ona ulaşsın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {notes.map((n) => {
            const author = n.created_by
              ? authorMap.get(n.created_by) || "Üye"
              : "Üye";
            const dateText = new Date(n.created_at).toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            return (
              <article
                key={n.id}
                className="rounded-xl border border-[#343438] bg-[#18181B] p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[12px] text-[#A1A1A6] mb-3">
                    <span className="font-medium text-[#D88A96]">
                      {author} • {n.note_type === "letter" ? "Mektup" : "Not"}
                    </span>
                    <span>{dateText}</span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#F5F5F7] mb-2">
                    {n.title}
                  </h3>
                  {/* Plain text rendering prevents XSS injection */}
                  <p className="font-editorial italic text-[15px] text-[#F5F5F7]/90 leading-relaxed whitespace-pre-line">
                    {n.content}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#343438]/60 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(n.id);
                      setTitle(n.title);
                      setContent(n.content);
                      setNoteType(n.note_type);
                      setShowForm(true);
                    }}
                    className="rounded p-1.5 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(n.id)}
                    className="rounded p-1.5 text-[#A1A1A6] hover:text-[#D88A96] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
