"use client";

import React, { useState } from "react";
import {
  Play,
  Clock,
  Search,
  Bell,
  X,
  BookOpen,
  Image as ImageIcon,
  Download,
  PlaySquare,
  Music,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type BookPageItem, type NavTab, type PhotoItem } from "@/types";

export function VideosDemoView({ onSelectTab }: { onSelectTab: (tab: NavTab) => void }) {
  const sampleVideos = [
    {
      id: "v1",
      title: "Gün Batımında Şehrin Işıkları",
      date: "14 Ağustos 2025",
      duration: "01:24",
      thumb: "/images/hero-couple.webp",
      tag: "Öne Çıkan",
    },
    {
      id: "v2",
      title: "Mum Işığında Akşam Yemeğimiz",
      date: "02 Eylül 2025",
      duration: "02:18",
      thumb: "/images/polaroid-night.webp",
      tag: "Yıldönümü",
    },
    {
      id: "v3",
      title: "Sahil Yürüyüşü ve Dalga Sesleri",
      date: "19 Ekim 2025",
      duration: "00:54",
      thumb: "/images/card-videos.webp",
      tag: "Yolculuk",
    },
    {
      id: "v4",
      title: "Kış Akşamı Kahve Keyfimiz",
      date: "28 Kasım 2025",
      duration: "01:42",
      thumb: "/images/polaroid-hands.webp",
      tag: "Ev Hali",
    },
    {
      id: "v5",
      title: "İlk Konserimizden Kesitler",
      date: "12 Aralık 2025",
      duration: "03:10",
      thumb: "/images/card-music.webp",
      tag: "Müzik",
    },
    {
      id: "v6",
      title: "Yeni Yıl Geri Sayımı",
      date: "31 Aralık 2025",
      duration: "01:05",
      thumb: "/images/polaroid-sunset.webp",
      tag: "Özel Gün",
    },
  ];

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#343438]/70 pb-6 mb-8">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
              Videolarımız
            </h1>
            <span className="text-[14px] font-medium text-[#A1A1A6]">
              12 kayıt
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[#A1A1A6]">
            Birlikte kaydettiğimiz hareketli anılar ve kısa filmler.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab("ani-kitabi")}
          className="rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-4 py-2 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
        >
          Anı Kitabını Aç
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleVideos.map((vid) => (
          <div key={vid.id} className="group flex flex-col">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B]">
              <img
                src={vid.thumb}
                alt={vid.title}
                className="h-full w-full object-cover opacity-90 transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-apple flex items-center justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101012]/80 border border-[#F5F5F7]/20 text-[#F5F5F7]">
                  <Play className="h-4 w-4 fill-[#F5F5F7] ml-0.5" />
                </div>
              </div>
              <span className="absolute top-3 left-3 rounded-md bg-[#101012]/80 border border-[#343438] px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7]">
                {vid.tag}
              </span>
              <span className="absolute bottom-2.5 right-3 rounded bg-[#101012]/85 px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7] tabular-nums">
                {vid.duration}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-[16px] font-medium text-[#F5F5F7]">{vid.title}</h3>
              <p className="mt-0.5 text-[12px] text-[#A1A1A6]">{vid.date}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MusicDemoView({ onSelectTab }: { onSelectTab: (tab: NavTab) => void }) {
  void onSelectTab;
  const { currentCouple } = useAuth();
  const coupleNames = currentCouple
    ? `${currentCouple.partner1Name} & ${currentCouple.partner2Name}`
    : "Bizim Şarkılarımız";

  const sampleTracks = [
    { id: "01", title: "Bizim Şarkımız", artist: "Özel Seçki", duration: "3:56", memory: "İlk dans ettiğimiz şarkı" },
    { id: "02", title: "Gün Batımı Melodisi", artist: "Akustik Kayıt", duration: "4:12", memory: "Sahil yolunda dinlediğimiz" },
    { id: "03", title: "Gece Yarısı Fısıltısı", artist: "Enstrümantal", duration: "2:58", memory: "Yağmurlu sonbahar akşamı" },
    { id: "04", title: "Seninle Her An", artist: "Piyano & Yaylılar", duration: "3:34", memory: "Yıldönümü yemeğimiz" },
    { id: "05", title: "Sonbahar Yaprakları", artist: "Indie Seçki", duration: "3:45", memory: "Kahve dükkanı anımız" },
    { id: "06", title: "Sonsuzluğa Doğru", artist: "Sinematik Orkestra", duration: "4:20", memory: "Yaz yolculuğumuz" },
  ];

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 rounded-2xl border border-[#343438] bg-[#18181B] p-6">
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-[#343438]/70 mb-5">
            <img
              src="/images/card-music.webp"
              alt="Müzik Listemiz"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#D88A96]">
            Çalma Listesi
          </span>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
            Bizim Şarkılarımız
          </h1>
          <p className="mt-1 text-[13px] text-[#A1A1A6]">
            {coupleNames} • 37 Şarkı, 2 sa 18 dk
          </p>
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-[#343438] bg-[#18181B] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#343438]/70 flex items-center justify-between text-[12px] font-medium text-[#A1A1A6]">
            <span># Başlık ve Anı Notu</span>
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div className="divide-y divide-[#343438]/50">
            {sampleTracks.map((track, idx) => (
              <div
                key={track.id}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-[#222226] transition-apple"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`text-[13px] font-medium tabular-nums w-5 ${
                      idx === 0 ? "text-[#D88A96]" : "text-[#A1A1A6]"
                    }`}
                  >
                    {track.id}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-[15px] font-medium truncate ${
                        idx === 0 ? "text-[#D88A96]" : "text-[#F5F5F7]"
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="text-[12px] text-[#A1A1A6] truncate">
                      {track.artist} — {track.memory}
                    </div>
                  </div>
                </div>
                <span className="text-[13px] text-[#A1A1A6] tabular-nums shrink-0 ml-4">
                  {track.duration}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SpecialDatesDemoView({ onSelectTab }: { onSelectTab: (tab: NavTab) => void }) {
  void onSelectTab;
  const dates = [
    { title: "İlk Tanıştığımız Gün", date: "14 Şubat 2024", badge: "Başlangıç", desc: "Hikâyemizin başladığı o unutulmaz gün." },
    { title: "İlk Kahve Randevumuz", date: "18 Şubat 2024", badge: "İlkler", desc: "Saatlerce konuşup zamanın nasıl geçtiğini anlamadığımız akşam." },
    { title: "İlk Tatilimiz", date: "22 Temmuz 2024", badge: "Yolculuk", desc: "Ege kıyısında gün batımını izlediğimiz ilk yaz tatilimiz." },
    { title: "Bizim Şarkımızı Seçtiğimiz Gün", date: "09 Eylül 2024", badge: "Müzik", desc: "Yolculuk sırasında 'Bu bizim şarkımız olsun' dediğimiz an." },
    { title: "İlk Yıl Dönümümüz", date: "14 Şubat 2025", badge: "Yıldönümü", desc: "365 günü birlikte geride bıraktığımız akşam." },
    { title: "Yıldızları İzlediğimiz Gece", date: "14 Ağustos 2025", badge: "Anı", desc: "Şehrin ışıklarını yukarıdan izlediğimiz yaz gecesi." },
    { title: "Anı Kitabımıza Başladığımız Gün", date: "02 Kasım 2025", badge: "Anı Kitabı", desc: "Tüm fotoğraflarımızı ve notlarımızı tek bir yerde topladığımız gün." },
    { title: "İkinci Yıl Dönümümüz", date: "14 Şubat 2026", badge: "Kutlama", desc: "Birlikte kutladığımız yeni yıl dönümümüz." },
  ];

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="border-b border-[#343438]/70 pb-6 mb-8">
        <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
          Birlikte Geçen Günler
        </h1>
        <p className="mt-1 text-[14px] text-[#A1A1A6]">
          Unutmak istemediğimiz dönüm noktaları ve özel tarihler.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {dates.map((item, i) => (
          <div
            key={i}
            className="rounded-xl border border-[#343438] bg-[#18181B] p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#D88A96]">
                  {item.badge}
                </span>
                <span className="text-[12px] text-[#A1A1A6] tabular-nums">{item.date}</span>
              </div>
              <h3 className="text-[16px] font-semibold text-[#F5F5F7] mb-1.5">
                {item.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-[#A1A1A6]">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NotesDemoView({ onSelectTab }: { onSelectTab: (tab: NavTab) => void }) {
  void onSelectTab;
  const { currentCouple } = useAuth();
  const p1 = currentCouple?.partner1Name || "Emir";
  const p2 = currentCouple?.partner2Name || "Hazal";

  const sampleNotes = [
    { title: "Sabah Notu", date: "12 Ekim 2025", author: p1, text: "Sabah uyanır uyanmaz aklıma gelen ilk şey yine senin gülüşündü." },
    { title: "Sinema Bileti", date: "25 Ekim 2025", author: p2, text: "O akşam izlediğimiz filmden çok, elimi tutuşunu hatırlıyorum." },
    { title: "Yağmurlu Gün Hatırası", date: "08 Kasım 2025", author: p1, text: "Tek bir şemsiyenin altında yürürken bile zaman seninle çok güzeldi." },
    { title: "Küçük Bir Söz", date: "19 Kasım 2025", author: p2, text: "Hangi mevsim olursa olsun, senin yanın benim hep ilkbaharım." },
    { title: "Gece Yarısı Mektubu", date: "01 Aralık 2025", author: p1, text: "Seninle geçen her an daha anlamlı, her yeni gün ayrı bir hikâye." },
    { title: "Kahve Kokulu Sabahlar", date: "15 Aralık 2025", author: p2, text: "Birlikte içtiğimiz her kahvenin kırk yıl değil, bir ömür hatırı var." },
  ];

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="border-b border-[#343438]/70 pb-6 mb-8">
        <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
          Notlarımız
        </h1>
        <p className="mt-1 text-[14px] text-[#A1A1A6]">
          Birbirimize bıraktığımız satırlar ve kısa mektuplar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sampleNotes.map((n, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[#343438] bg-[#18181B] p-6"
          >
            <div className="flex items-center justify-between text-[12px] text-[#A1A1A6] mb-3">
              <span className="font-medium text-[#D88A96]">{n.author}</span>
              <span>{n.date}</span>
            </div>
            <h3 className="text-[16px] font-semibold text-[#F5F5F7] mb-2">{n.title}</h3>
            <p className="font-editorial italic text-[15px] text-[#F5F5F7]/90 leading-relaxed">
              &ldquo;{n.text}&rdquo;
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UsCoupleView({
  photosCount,
  pagesCount,
  onSelectTab,
  onOpenBackupModal,
}: {
  photosCount: number;
  pagesCount: number;
  onSelectTab: (tab: NavTab) => void;
  onOpenBackupModal: () => void;
}) {
  const { currentCouple } = useAuth();

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="rounded-2xl border border-[#343438] bg-[#18181B] p-6 sm:p-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="flex items-center -space-x-3">
              <img
                src={currentCouple?.avatar1 || "/images/avatar-ben.webp"}
                alt={currentCouple?.partner1Name || "Emir"}
                className="h-18 w-18 rounded-full border-2 border-[#101012] object-cover"
              />
              <img
                src={currentCouple?.avatar2 || "/images/avatar-sen.webp"}
                alt={currentCouple?.partner2Name || "Hazal"}
                className="h-18 w-18 rounded-full border-2 border-[#101012] object-cover"
              />
            </div>
            <div>
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#D88A96]">
                Özel Dijital Anı Alanı
              </span>
              <h1 className="mt-1 text-[28px] sm:text-[34px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {currentCouple?.partner1Name} ve {currentCouple?.partner2Name}
              </h1>
              <p className="mt-1 text-[14px] text-[#A1A1A6]">
                Başlangıç Tarihimiz: {currentCouple?.anniversaryDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenBackupModal}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2.5 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Verileri Yedekle / İçe Aktar</span>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            onClick={() => onSelectTab("ani-kitabi")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <BookOpen className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">
              {pagesCount}
            </div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Anı Kitabı Sayfası</div>
          </div>

          <div
            onClick={() => onSelectTab("fotograflar")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <ImageIcon className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">
              {photosCount}
            </div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Arşivlenen Fotoğraf</div>
          </div>

          <div
            onClick={() => onSelectTab("videolar")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <PlaySquare className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">12</div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Video Kaydı</div>
          </div>

          <div
            onClick={() => onSelectTab("muzik")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <Music className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">37</div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Seçili Şarkı</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SearchModal({
  isOpen,
  onClose,
  photos,
  bookPages,
  onSelectTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  photos: PhotoItem[];
  bookPages: BookPageItem[];
  onSelectTab: (tab: NavTab) => void;
}) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const matchedPages = bookPages.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.date.toLowerCase().includes(q)
  );
  const matchedPhotos = photos.filter(
    (p) => p.title.toLowerCase().includes(q) || p.date.toLowerCase().includes(q)
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-20 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-[#343438] bg-[#18181B] p-5 text-[#F5F5F7] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[#343438] pb-3.5">
          <Search className="h-4 w-4 text-[#A1A1A6]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Anı kitabı sayfalarında veya fotoğraflarda ara..."
            className="flex-1 bg-transparent text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto space-y-5">
          <div>
            <h4 className="text-[12px] font-medium text-[#A1A1A6] mb-2">
              Anı Kitabı Sayfaları ({matchedPages.length})
            </h4>
            <div className="space-y-1.5">
              {matchedPages.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectTab("ani-kitabi");
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-lg bg-[#101012] hover:bg-[#222226] px-3.5 py-2.5 text-left text-[13px] transition-apple cursor-pointer"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-medium text-[#F5F5F7] truncate">
                      Sayfa {String(p.order + 1).padStart(2, "0")} —{" "}
                      {p.title.replace(/\s*♡/g, "")}
                    </div>
                    <p className="text-[12px] text-[#A1A1A6] truncate">
                      {p.content.replace(/\s*♡/g, "")}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#A1A1A6] shrink-0">{p.date}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[12px] font-medium text-[#A1A1A6] mb-2">
              Fotoğraflar ({matchedPhotos.length})
            </h4>
            <div className="space-y-1.5">
              {matchedPhotos.slice(0, 5).map((ph) => (
                <button
                  key={ph.id}
                  type="button"
                  onClick={() => {
                    onSelectTab("fotograflar");
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg bg-[#101012] hover:bg-[#222226] px-3.5 py-2 text-left text-[13px] transition-apple cursor-pointer"
                >
                  <img
                    src={ph.dataUrl}
                    alt={ph.title}
                    className="h-8 w-10 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#F5F5F7] truncate">
                      {ph.title.replace(/\s*\([^)]*\)/g, "")}
                    </div>
                    <div className="text-[11px] text-[#A1A1A6]">{ph.date}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsModal({
  isOpen,
  onClose,
  onSelectTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavTab) => void;
}) {
  if (!isOpen) return null;

  const sampleNotifications = [
    {
      title: "Anı Kitabı Güncel",
      desc: "Yeni fotoğraflarınızı ve hikâyelerinizi ekleyerek kitabınızı zenginleştirebilirsiniz.",
      time: "Anı Kitabı",
      tab: "ani-kitabi" as NavTab,
    },
    {
      title: "Özel Tarihler",
      desc: "Takviminizde kayıtlı 8 dönüm noktası bulunuyor.",
      time: "Takvim",
      tab: "ozel-gunler" as NavTab,
    },
    {
      title: "Veri Yedekleme",
      desc: "Fotoğraflarınızı ve kitap sayfalarınızı Veri ve Yedekleme menüsünden dışa aktarabilirsiniz.",
      time: "Ayarlar",
      tab: "biz" as NavTab,
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 pt-16 pr-4 sm:pr-8 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-[#343438] bg-[#18181B] p-4 text-[#F5F5F7] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#343438] pb-3 mb-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <Bell className="h-4 w-4 text-[#D88A96]" />
            <span>Bildirimler</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {sampleNotifications.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSelectTab(item.tab);
                onClose();
              }}
              className="w-full rounded-lg border border-[#343438]/70 bg-[#101012] hover:bg-[#222226] p-3 text-left transition-apple cursor-pointer"
            >
              <div className="flex items-center justify-between text-[13px] font-medium text-[#F5F5F7] mb-1">
                <span>{item.title}</span>
                <span className="text-[11px] text-[#D88A96]">{item.time}</span>
              </div>
              <p className="text-[12px] text-[#A1A1A6] leading-relaxed">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
