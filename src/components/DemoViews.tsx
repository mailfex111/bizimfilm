"use client";

import React, { useState } from "react";
import {
  PlaySquare,
  Music,
  CalendarHeart,
  StickyNote,
  Heart,
  Play,
  Clock,
  Sparkles,
  Search,
  Bell,
  X,
  BookOpen,
  Image as ImageIcon,
  Download,
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
      tag: "Favori Anımız",
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
      tag: "Tatil",
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
      title: "Yeni Yıl Geri Sayımı ♡",
      date: "31 Aralık 2025",
      duration: "01:05",
      thumb: "/images/polaroid-sunset.webp",
      tag: "Özel Gün",
    },
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
            <PlaySquare className="h-6 w-6 text-[#f06c82]" />
            <span>Videolarımız</span>
            <span className="rounded-full bg-[#38121c] border border-rose-300/20 px-3 py-0.5 text-xs font-medium text-rose-200">
              12 Video
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-rose-100/75">
            Birlikte kaydettiğimiz en özel anlarımız ve video kliplerimiz.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab("ani-kitabi")}
          className="rounded-xl bg-[#c81e3a] hover:bg-[#e02444] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
        >
          Anı Kitabını Aç
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sampleVideos.map((vid) => (
          <div
            key={vid.id}
            className="group overflow-hidden rounded-2xl border border-rose-200/15 bg-[#1b080e]/90 shadow-xl"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <img
                src={vid.thumb}
                alt={vid.title}
                className="h-full w-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c81e3a]/90 text-white shadow-lg">
                  <Play className="h-5 w-5 fill-white ml-0.5" />
                </div>
              </div>
              <span className="absolute top-3 left-3 rounded-full bg-black/65 border border-rose-300/20 px-2.5 py-0.5 text-[10px] font-medium text-rose-200">
                {vid.tag}
              </span>
              <span className="absolute bottom-2.5 right-3 rounded bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
                {vid.duration}
              </span>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-white">{vid.title}</h3>
              <p className="mt-1 text-xs text-rose-200/65">{vid.date}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MusicDemoView({ onSelectTab }: { onSelectTab: (tab: NavTab) => void }) {
  void onSelectTab;
  const sampleTracks = [
    { id: 1, title: "Bizim Şarkımız ♡", artist: "Sana Özel Çalma Listesi", duration: "3:56", memory: "İlk dans ettiğimiz şarkı" },
    { id: 2, title: "Gün Batımı Melodisi", artist: "Akustik Sevgili", duration: "4:12", memory: "Sahil yolunda dinlediğimiz" },
    { id: 3, title: "Gece Yarısı Fısıltısı", artist: "Lo-Fi Romantik", duration: "2:58", memory: "Yağmurlu akşamımız" },
    { id: 4, title: "Seninle Her An", artist: "Piyano & Yaylılar", duration: "3:34", memory: "Yıldönümü yemeğimiz" },
    { id: 5, title: "Sonbahar Yaprakları", artist: "Indie Aşk", duration: "3:45", memory: "Kahve dükkanı anımız" },
    { id: 6, title: "Sonsuzluğa Doğru", artist: "Sinematik Orkestra", duration: "4:20", memory: "Tatil yolculuğumuz" },
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 pb-28">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-rose-200/15 bg-[#1e0910] p-6 flex flex-col items-center text-center shadow-xl">
          <img
            src="/images/card-music.webp"
            alt="Müzik Listemiz Plak"
            className="h-44 w-full rounded-xl object-cover border border-rose-200/15 mb-4"
          />
          <h1 className="text-xl font-bold text-white">Müzik Listemiz ♡</h1>
          <p className="mt-1 text-xs text-rose-200/75">
            37 Şarkı • 2 saat 18 dakika romantik seçki
          </p>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-rose-200/15 bg-[#1b080e]/90 p-5 shadow-xl">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Music className="h-4 w-4 text-[#f06c82]" />
            <span>Öne Çıkan Şarkılarımız</span>
          </h2>
          <div className="space-y-2.5">
            {sampleTracks.map((track, idx) => (
              <div
                key={track.id}
                className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                  idx === 0
                    ? "border-[#f06c82]/40 bg-[#38121c]/80"
                    : "border-rose-200/10 bg-[#140609]/70"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-xs font-bold text-[#f06c82] w-4">{idx + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {track.title}
                    </div>
                    <div className="text-xs text-rose-200/65 truncate">
                      {track.artist} • <span className="italic">{track.memory}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-rose-200/75 shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{track.duration}</span>
                </div>
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
    { title: "İlk Tanıştığımız Gün ♡", date: "14 Şubat 2024", badge: "Yıldönümü", desc: "Göz göze geldiğimiz ve hikayemizin başladığı o unutulmaz gün." },
    { title: "İlk Kahve Randevumuz", date: "18 Şubat 2024", badge: "İlkler", desc: "Saatlerce konuşup zamanın nasıl geçtiğini anlamadığımız akşam." },
    { title: "İlk Tatilimiz", date: "22 Temmuz 2024", badge: "Tatil", desc: "Ege kıyısında gün batımını izlediğimiz ilk yaz tatilimiz." },
    { title: "Bizim Şarkımızı Seçtiğimiz Gün", date: "09 Eylül 2024", badge: "Müzik", desc: "Arabada çalarken 'Bu bizim şarkımız olsun' dediğimiz an." },
    { title: "İlk Yıl Dönümümüz", date: "14 Şubat 2025", badge: "Kutlama", desc: "365 günü sevgiyle geride bıraktığımız mum ışıklı akşam." },
    { title: "Yıldızları İzlediğimiz Gece", date: "14 Ağustos 2025", badge: "Romantik", desc: "Battaniyemize sarılıp şehrin ışıklarını yukarıdan izlediğimiz gece." },
    { title: "Anı Kitabımıza Başladığımız Gün", date: "02 Kasım 2025", badge: "Anı Kitabı", desc: "Tüm fotoğraflarımızı ve notlarımızı tek bir yerde topladığımız gün." },
    { title: "Gelecek Hayallerimiz ♡", date: "14 Şubat 2026", badge: "Yaklaşan", desc: "Birlikte kutlayacağımız nice yeni yıldönümlerine..." },
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 pb-28">
      <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5 mb-5">
        <CalendarHeart className="h-6 w-6 text-[#f06c82]" />
        <span>Özel Günlerimiz</span>
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dates.map((item, i) => (
          <div
            key={i}
            className="rounded-2xl border border-rose-200/15 bg-[#1c080e]/90 p-5 shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="rounded-full bg-[#38121c] border border-rose-300/20 px-2.5 py-0.5 text-[11px] font-medium text-[#f06c82]">
                  {item.badge}
                </span>
                <span className="text-xs font-semibold text-rose-200/80">{item.date}</span>
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">{item.title}</h3>
              <p className="text-xs leading-relaxed text-rose-100/75">{item.desc}</p>
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
    { title: "Günaydın Notu ♡", date: "12 Ekim 2025", author: p1, text: "Sabah uyanır uyanmaz aklıma gelen ilk şey yine senin gülüşündü..." },
    { title: "Cebinde Kalan Sinema Bileti", date: "25 Ekim 2025", author: p2, text: "O akşam izlediğimiz filmden çok, elimi tutuşunu hatırlıyorum." },
    { title: "Yağmurlu Gün Hatırası", date: "08 Kasım 2025", author: p1, text: "Tek bir şemsiyenin altında ıslanırken bile dünyanın en şanslı insanıydım." },
    { title: "Sana Küçük Bir Söz", date: "19 Kasım 2025", author: p2, text: "Hangi mevsim olursa olsun, senin yanın benim hep ilkbaharım." },
    { title: "Gece Yarısı Mektubu", date: "01 Aralık 2025", author: p1, text: "Seninle her an daha güzel, her yeni gün ayrı bir macera... ♡" },
    { title: "Kahve Kokulu Sabahlar", date: "15 Aralık 2025", author: p2, text: "Birlikte içtiğimiz her kahvenin kırk yıl değil, bir ömür hatırı var." },
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 pb-28">
      <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5 mb-5">
        <StickyNote className="h-6 w-6 text-[#f06c82]" />
        <span>Notlarımız</span>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sampleNotes.map((n, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-rose-200/15 bg-gradient-to-br from-[#260b13] to-[#17060b] p-5 shadow-lg"
          >
            <div className="flex items-center justify-between text-xs text-rose-200/70 mb-2">
              <span className="font-semibold text-[#f06c82]">{n.author} ♡</span>
              <span>{n.date}</span>
            </div>
            <h3 className="text-base font-bold text-white mb-2">{n.title}</h3>
            <p className="font-handwriting text-base text-rose-100/90 leading-relaxed">
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
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 pb-28">
      <div className="rounded-3xl border border-rose-200/15 bg-gradient-to-r from-[#240a11] via-[#2f0e17] to-[#1a070c] p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="flex items-center -space-x-4">
              <img
                src={currentCouple?.avatar1 || "/images/avatar-ben.webp"}
                alt={currentCouple?.partner1Name || "Emir"}
                className="h-20 w-20 rounded-full border-4 border-[#2b0c14] object-cover shadow-lg"
              />
              <img
                src={currentCouple?.avatar2 || "/images/avatar-sen.webp"}
                alt={currentCouple?.partner2Name || "Hazal"}
                className="h-20 w-20 rounded-full border-4 border-[#2b0c14] object-cover shadow-lg"
              />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3d131f] border border-rose-300/20 px-3 py-1 text-xs font-semibold text-[#f06c82]">
                <Sparkles className="h-3.5 w-3.5" />
                Bizim Hikayemiz ♡
              </span>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white">
                {currentCouple?.partner1Name} ve {currentCouple?.partner2Name}{" "}
                <span className="text-[#f06c82]">♡</span>
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-rose-100/75">
                Başlangıç Tarihimiz: {currentCouple?.anniversaryDate}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenBackupModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#c81e3a] hover:bg-[#e02444] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Verileri Yedekle / İçe Aktar</span>
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            onClick={() => onSelectTab("ani-kitabi")}
            className="rounded-2xl border border-rose-200/15 bg-black/30 p-4 cursor-pointer hover:border-rose-300/35 transition"
          >
            <BookOpen className="h-5 w-5 text-[#f06c82] mb-2" />
            <div className="text-2xl font-bold text-white">{pagesCount} Sayfa</div>
            <div className="text-xs text-rose-200/70">Anı Kitabı Sayfası</div>
          </div>

          <div
            onClick={() => onSelectTab("fotograflar")}
            className="rounded-2xl border border-rose-200/15 bg-black/30 p-4 cursor-pointer hover:border-rose-300/35 transition"
          >
            <ImageIcon className="h-5 w-5 text-[#f06c82] mb-2" />
            <div className="text-2xl font-bold text-white">{photosCount} Fotoğraf</div>
            <div className="text-xs text-rose-200/70">Fotoğraf Galerimiz</div>
          </div>

          <div
            onClick={() => onSelectTab("videolar")}
            className="rounded-2xl border border-rose-200/15 bg-black/30 p-4 cursor-pointer hover:border-rose-300/35 transition"
          >
            <PlaySquare className="h-5 w-5 text-[#f06c82] mb-2" />
            <div className="text-2xl font-bold text-white">12 Video</div>
            <div className="text-xs text-rose-200/70">Video Koleksiyonumuz</div>
          </div>

          <div
            onClick={() => onSelectTab("muzik")}
            className="rounded-2xl border border-rose-200/15 bg-black/30 p-4 cursor-pointer hover:border-rose-300/35 transition"
          >
            <Heart className="h-5 w-5 text-[#f06c82] mb-2" />
            <div className="text-2xl font-bold text-white">37 Şarkı</div>
            <div className="text-xs text-rose-200/70">Özel Çalma Listemiz</div>
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-20 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-rose-200/20 bg-[#200a10] p-5 text-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-rose-200/15 pb-3">
          <Search className="h-5 w-5 text-[#f06c82]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Anı kitabı sayfalarında veya fotoğraflarda ara..."
            className="flex-1 bg-transparent text-sm text-white placeholder-rose-200/45 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-rose-200/60 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-rose-200/70 mb-2">
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
                  className="flex w-full items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-left text-xs cursor-pointer"
                >
                  <div>
                    <span className="font-semibold text-white">
                      Sayfa {p.order + 1}: {p.title}
                    </span>
                    <p className="text-rose-200/65 truncate max-w-sm">{p.content}</p>
                  </div>
                  <span className="text-[10px] text-[#f06c82]">{p.date}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-rose-200/70 mb-2">
              Fotoğraflarımız ({matchedPhotos.length})
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
                  className="flex w-full items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-left text-xs cursor-pointer"
                >
                  <img
                    src={ph.dataUrl}
                    alt={ph.title}
                    className="h-8 w-10 rounded object-cover"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-white">{ph.title}</div>
                    <div className="text-[10px] text-rose-200/65">{ph.date}</div>
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
      title: "Anı Kitabımız %72 tamamlandı ♡",
      desc: "Yeni fotoğraflarınızı ve romantik notlarınızı ekleyerek kitabınızı zenginleştirebilirsiniz.",
      time: "Bugün",
      tab: "ani-kitabi" as NavTab,
    },
    {
      title: "Yıldönümü Hatırlatması",
      desc: "Özel Günler takviminizde kayıtlı 8 özel tarih bulunuyor.",
      time: "Takvim",
      tab: "ozel-gunler" as NavTab,
    },
    {
      title: "Veri Yedekleme",
      desc: "Fotoğraflarınızı ve kitap sayfalarınızı Hesap Ayarları menüsünden yedekleyebilirsiniz.",
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
        className="w-full max-w-sm rounded-2xl border border-rose-200/20 bg-[#210b11] p-4 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-rose-200/10 pb-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Bell className="h-4 w-4 text-[#f06c82]" />
            <span>Bildirimler</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-rose-200/60 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {sampleNotifications.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSelectTab(item.tab);
                onClose();
              }}
              className="w-full rounded-xl border border-rose-200/10 bg-[#15060a] hover:border-rose-300/30 p-3 text-left transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-white mb-1">
                <span>{item.title}</span>
                <span className="text-[10px] text-[#f06c82]">{item.time}</span>
              </div>
              <p className="text-[11px] text-rose-100/75 leading-relaxed">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
