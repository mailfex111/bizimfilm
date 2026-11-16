"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import {
  getCoupleBookPages,
  getCouplePhotos,
  getLastOpenBookPage,
  setLastOpenBookPage,
} from "@/lib/db";
import { type BookPageItem, type NavTab, type PhotoItem } from "@/types";
import LoginView from "@/components/LoginView";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ContinueRow from "@/components/ContinueRow";
import {
  MusicDemoView,
  NotesDemoView,
  NotificationsModal,
  SearchModal,
  SpecialDatesDemoView,
  UsCoupleView,
  VideosDemoView,
} from "@/components/DemoViews";
import MusicPlayerBar from "@/components/MusicPlayerBar";
import SettingsBackupModal from "@/components/SettingsBackupModal";

const MemoryBookSection = dynamic(() => import("@/components/MemoryBookSection"), {
  ssr: false,
});
const PhotosView = dynamic(() => import("@/components/PhotosView"), {
  ssr: false,
});

export default function BizimFilmApp() {
  const { currentCouple, isHydrated } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>("ana-sayfa");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [bookPages, setBookPages] = useState<BookPageItem[]>([]);
  const [lastOpenPage, setLastOpenPage] = useState<number>(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [autoTriggerPhotoUpload, setAutoTriggerPhotoUpload] = useState(false);

  const loadCoupleData = useCallback(async () => {
    if (!currentCouple) return;
    const [loadedPhotos, loadedPages, savedPageIdx] = await Promise.all([
      getCouplePhotos(currentCouple.id),
      getCoupleBookPages(currentCouple.id),
      getLastOpenBookPage(currentCouple.id),
    ]);
    setPhotos(loadedPhotos);
    setBookPages(loadedPages);
    setLastOpenPage(savedPageIdx);
  }, [currentCouple]);

  useEffect(() => {
    if (currentCouple) {
      void loadCoupleData();
    } else {
      setPhotos([]);
      setBookPages([]);
      setLastOpenPage(0);
    }
  }, [currentCouple, loadCoupleData]);

  if (!currentCouple) {
    return <LoginView />;
  }

  const handleOpenPhotoUploadFromAnywhere = () => {
    setActiveTab("fotograflar");
    setAutoTriggerPhotoUpload(true);
  };

  const handleSwitchToBookPage = (targetPageIdx?: number) => {
    if (typeof targetPageIdx === "number") {
      setLastOpenPage(targetPageIdx);
      void setLastOpenBookPage(currentCouple.id, targetPageIdx);
    }
    setActiveTab("ani-kitabi");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#17060b] via-[#120508] to-[#0e0406] text-white flex flex-col">
      {/* Sticky Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
      />

      {/* Main View Content */}
      <main className="flex-1">
        {activeTab === "ana-sayfa" && (
          <>
            <HeroSection
              onOpenMemoryBook={() => setActiveTab("ani-kitabi")}
              onAddMemory={handleOpenPhotoUploadFromAnywhere}
            />
            <ContinueRow
              onSelectTab={(tab) => setActiveTab(tab)}
              photoCount={photos.length}
              bookProgress={currentCouple.bookProgress}
            />
            <MemoryBookSection
              coupleId={currentCouple.id}
              pages={bookPages}
              photos={photos}
              initialPageIndex={lastOpenPage}
              isFullPageView={false}
              onPagesChange={setBookPages}
              onPhotosChange={loadCoupleData}
              onSelectTab={(tab) => setActiveTab(tab)}
              onOpenPhotoUploadModal={handleOpenPhotoUploadFromAnywhere}
            />
          </>
        )}

        {activeTab === "ani-kitabi" && (
          <div className="pt-4">
            <MemoryBookSection
              coupleId={currentCouple.id}
              pages={bookPages}
              photos={photos}
              initialPageIndex={lastOpenPage}
              isFullPageView={true}
              onPagesChange={setBookPages}
              onPhotosChange={loadCoupleData}
              onSelectTab={(tab) => setActiveTab(tab)}
              onOpenPhotoUploadModal={handleOpenPhotoUploadFromAnywhere}
            />
          </div>
        )}

        {activeTab === "fotograflar" && (
          <PhotosView
            coupleId={currentCouple.id}
            photos={photos}
            bookPages={bookPages}
            autoOpenUpload={autoTriggerPhotoUpload}
            onClearAutoOpen={() => setAutoTriggerPhotoUpload(false)}
            onPhotosChange={loadCoupleData}
            onPagesChange={setBookPages}
            onSwitchToBook={handleSwitchToBookPage}
          />
        )}

        {activeTab === "videolar" && (
          <VideosDemoView onSelectTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === "muzik" && (
          <MusicDemoView onSelectTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === "ozel-gunler" && (
          <SpecialDatesDemoView onSelectTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === "notlar" && (
          <NotesDemoView onSelectTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === "biz" && (
          <UsCoupleView
            photosCount={photos.length}
            pagesCount={bookPages.length}
            onSelectTab={(tab) => setActiveTab(tab)}
            onOpenBackupModal={() => setSettingsModalOpen(true)}
          />
        )}
      </main>

      {/* Modals */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        photos={photos}
        bookPages={bookPages}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      <SettingsBackupModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        coupleId={currentCouple.id}
        photosCount={photos.length}
        pagesCount={bookPages.length}
        onDataRestored={loadCoupleData}
      />

      {/* Fixed Bottom Music Player Bar */}
      <MusicPlayerBar onSelectTab={(tab) => setActiveTab(tab)} />
    </div>
  );
}
