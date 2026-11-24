"use client";

import React, { useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatTurkishDate } from "@/lib/dateUtils";
import { type NavTab } from "@/types";

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSettingsModal: () => void;
  unreadNotificationsCount: number;
  realtimeConnected: boolean;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: "ana-sayfa", label: "Ana Sayfa" },
  { id: "ani-kitabi", label: "Anı Kitabı" },
  { id: "fotograflar", label: "Fotoğraflar" },
  { id: "videolar", label: "Videolar" },
  { id: "muzik", label: "Müzik" },
];

export default function Navbar({
  activeTab,
  onSelectTab,
  onOpenSearch,
  onOpenNotifications,
  onOpenSettingsModal,
  unreadNotificationsCount,
  realtimeConnected,
}: NavbarProps) {
  const { user, profile, couple, members, memberAvatarUrls, signOut } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const coupleTitle = couple?.couple_name || profile?.display_name || "Hesabım";

  return (
    <header className="sticky top-0 z-40 w-full bg-[#101012]/90 backdrop-blur-md border-b border-[#343438]/60">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* Left: Minimal Wordmark + Mobile Menu Trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Menü"
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-[#343438] bg-[#18181B] text-[#F5F5F7] hover:bg-[#222226] transition-apple"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick("ana-sayfa")}
            className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-[#F5F5F7] hover:opacity-85 transition-apple cursor-pointer focus:outline-none"
          >
            <span>Miora</span>
            <span
              title={realtimeConnected ? "Canlı senkronizasyon aktif" : "Bağlantı bekleniyor"}
              className={`h-1.5 w-1.5 rounded-full ${
                realtimeConnected ? "bg-[#D88A96]" : "bg-[#A1A1A6]/40"
              }`}
            />
          </button>
        </div>

        {/* Center: Clean Minimal Navigation Links */}
        <nav
          aria-label="Ana Navigasyon"
          className="hidden md:flex items-center gap-7 h-full"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative h-full flex items-center text-[14px] font-medium transition-apple cursor-pointer ${
                  isActive
                    ? "text-[#F5F5F7]"
                    : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-[#D88A96]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Search, Real Notifications, Couple Profile Menu */}
        <div className="relative flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Arama"
            title="Ara"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A1A1A6] hover:bg-[#18181B] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Bildirimler"
            title="Bildirimler"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#A1A1A6] hover:bg-[#18181B] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D88A96] px-1 text-[10px] font-semibold text-[#101012]">
                {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Netflix-style Dual Couple Avatars Pill */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-expanded={profileMenuOpen}
            aria-label="Profil Menüsü"
            className="flex items-center gap-2 rounded-full border border-[#343438] bg-[#18181B] hover:bg-[#222226] py-1 pl-1.5 pr-2.5 transition-apple cursor-pointer focus:outline-none"
          >
            <div className="flex items-center -space-x-1.5">
              {members.length > 0 ? (
                members.map((m) => {
                  const avatar = memberAvatarUrls[m.user_id];
                  const initial = (m.profile?.display_name || "M").slice(0, 1).toUpperCase();
                  return avatar ? (
                    <img
                      key={m.id}
                      src={avatar}
                      alt={m.profile?.display_name || "Üye"}
                      width={24}
                      height={24}
                      className="h-6 w-6 rounded-full border border-[#101012] object-cover"
                    />
                  ) : (
                    <span
                      key={m.id}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-[#101012] bg-[#222226] text-[10px] font-semibold text-[#F5F5F7]"
                    >
                      {initial}
                    </span>
                  );
                })
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#101012] bg-[#222226] text-[10px] font-semibold text-[#F5F5F7]">
                  {(profile?.display_name || "M").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-[13px] font-medium text-[#F5F5F7] max-w-[140px] truncate">
              {coupleTitle}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#A1A1A6] transition-transform duration-150 ${
                profileMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Clean Profile Dropdown (Read-only partner visibility, personal settings for self only) */}
          {profileMenuOpen && (
            <>
              <div
                onClick={() => setProfileMenuOpen(false)}
                className="fixed inset-0 z-40"
              />
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-[#343438] bg-[#18181B] p-2 shadow-2xl">
                <div className="px-3 py-2 border-b border-[#343438]/70 mb-1.5">
                  <div className="text-[13px] font-semibold text-[#F5F5F7] truncate">
                    {coupleTitle}
                  </div>
                  {couple?.relationship_start_date && (
                    <div className="text-[11px] text-[#A1A1A6]">
                      {formatTurkishDate(couple.relationship_start_date)}
                    </div>
                  )}
                </div>

                {/* Partner Profiles Display (Authenticated user marked clearly; no unauthorized switching) */}
                <div className="px-2 py-1 space-y-1 mb-1">
                  {members.map((m) => {
                    const isMe = m.user_id === user?.id;
                    const avatar = memberAvatarUrls[m.user_id];
                    const name = m.profile?.display_name || "Üye";
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-[#101012]/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={name}
                              className="h-6 w-6 rounded-full object-cover border border-[#343438]"
                            />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#222226] text-[10px] font-semibold text-[#F5F5F7]">
                              {name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-[#F5F5F7] truncate">
                              {name}
                            </div>
                            <div className="text-[10px] text-[#A1A1A6] truncate">
                              @{m.profile?.username || "kullanici"}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-[#D88A96] shrink-0">
                          {isMe ? "Siz" : "Partner"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => handleNavClick("biz")}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#F5F5F7] hover:bg-[#222226] transition-apple cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5 text-[#A1A1A6]" />
                  <span>Çift Alanı ve Davet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onOpenSettingsModal();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#F5F5F7] hover:bg-[#222226] transition-apple cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-[#A1A1A6]" />
                  <span>Hesap Ayarları ve Kota</span>
                </button>

                <div className="my-1.5 h-px bg-[#343438]/70" />

                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#D88A96] hover:bg-[#222226] transition-apple cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobil Navigasyon"
          className="md:hidden border-t border-[#343438] bg-[#18181B] px-4 py-3"
        >
          <div className="flex flex-col gap-1">
            {[
              ...NAV_ITEMS,
              { id: "ozel-gunler" as NavTab, label: "Özel Günler" },
              { id: "notlar" as NavTab, label: "Notlar" },
              { id: "biz" as NavTab, label: "Çift Profilimiz" },
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[14px] font-medium transition-apple ${
                    isActive
                      ? "bg-[#222226] text-[#F5F5F7]"
                      : "text-[#A1A1A6] hover:bg-[#222226]/50 hover:text-[#F5F5F7]"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D88A96]" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
