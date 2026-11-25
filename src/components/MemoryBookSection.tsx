"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import HTMLFlipBookBase from "react-pageflip";
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  getSignedUrl,
  getSignedUrlsBatch,
  uploadCoupleMedia,
} from "@/lib/storage";
import {
  A4_PAGE_RATIO,
  applyTemplateToCanvasState,
  clampCanvasElement,
  createLocalElementId,
  createMediaCanvasElement,
  createTextCanvasElement,
  extractPageSummaryForDb,
  getPaperPreset,
  normalizePageToCanvasState,
  serializeCanvasToDbRows,
  type BookTemplateId,
  type CanvasElement,
  type PageCanvasState,
  type PaperPresetId,
} from "@/lib/bookCanvas";
import BookPageCanvas from "@/components/book/BookPageCanvas";
import BookEditorToolbar, {
  type ActiveToolbarPopover,
  type EditorSaveState,
} from "@/components/book/BookEditorToolbar";
import BookPageFilmstrip from "@/components/book/BookPageFilmstrip";
import {
  type MediaItem,
  type MemoryBook,
  type MemoryPage,
  type MemoryPageElement,
} from "@/types";

const HTMLFlipBook =
  HTMLFlipBookBase as unknown as React.ComponentType<Record<string, unknown>>;

interface MemoryBookSectionProps {
  coupleId: string;
  books: MemoryBook[];
  activeBook: MemoryBook | null;
  pages: MemoryPage[];
  photos: MediaItem[];
  videos: MediaItem[];
  isFullPageView?: boolean;
  onSelectBook: (bookId: string) => void;
  onBooksChange: () => Promise<void>;
  onPagesChange: () => Promise<void>;
  onMediaChange: () => Promise<void>;
  onOpenPhotoUploadModal: () => void;
}

interface HistoryEntry {
  pageId: string;
  before: PageCanvasState;
  after: PageCanvasState;
}

interface ConflictSnapshot {
  pageId: string;
  latestPage: MemoryPage;
  latestCanvas: PageCanvasState;
}

function cloneCanvas(state: PageCanvasState): PageCanvasState {
  return {
    ...state,
    elements: state.elements.map((el) => ({
      ...el,
      style: { ...el.style },
    })),
  };
}

export default function MemoryBookSection({
  coupleId,
  books,
  activeBook,
  pages,
  photos,
  videos,
  isFullPageView = false,
  onSelectBook,
  onBooksChange,
  onPagesChange,
  onMediaChange,
  onOpenPhotoUploadModal,
}: MemoryBookSectionProps) {
  const { user, preferences, updatePreferences, refreshStorage } = useAuth();

  const flipBookRef = useRef<{
    pageFlip: () => {
      flipNext: () => void;
      flipPrev: () => void;
      turnToPage: (page: number) => void;
    };
  } | null>(null);

  // Per-page debounced autosave timers, sequence guards, and version tracker
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveSeqRef = useRef<Record<string, number>>({});
  const versionMapRef = useRef<Record<string, number>>({});
  const pendingDraftsRef = useRef<Record<string, PageCanvasState>>({});
  const pendingSlotTargetRef = useRef<{ pageId: string; elementId: string } | null>(
    null
  );

  // Viewport-aware vertical A4 book sizing (210:297)
  const [bookMetrics, setBookMetrics] = useState({
    pageW: 410,
    pageH: 580,
    isMobile: false,
  });

  // Dual mode: "read" | "edit", plus temporary "preview" flag from Edit Mode
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [isPreviewFromEdit, setIsPreviewFromEdit] = useState(false);

  const [currentPageIndex, setCurrentPageIndex] = useState(
    preferences?.last_open_page_order || 0
  );
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [cropElementId, setCropElementId] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<ActiveToolbarPopover>(null);

  // Local editable drafts (never overwritten mid-drag; synced cleanly with DB)
  const [drafts, setDrafts] = useState<Record<string, PageCanvasState>>({});
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [saveState, setSaveState] = useState<EditorSaveState>("idle");
  const [conflict, setConflict] = useState<ConflictSnapshot | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Book management modal (book title / description / cover)
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookModalMode, setBookModalMode] = useState<"create" | "edit">("create");
  const [bookTitleInput, setBookTitleInput] = useState("");
  const [bookDescInput, setBookDescInput] = useState("");
  const [bookCoverId, setBookCoverId] = useState<string | null>(null);

  // Optional fullscreen video fallback modal (inline play is default inside the book)
  const [fullscreenVideo, setFullscreenVideo] = useState<MediaItem | null>(null);
  const [resolvedFullscreenVideo, setResolvedFullscreenVideo] = useState<{
    mediaId: string;
    url: string | null;
  } | null>(null);
  const fullscreenVideoUrl =
    fullscreenVideo && resolvedFullscreenVideo?.mediaId === fullscreenVideo.id
      ? resolvedFullscreenVideo.url
      : null;

  const allMedia = useMemo(() => [...photos, ...videos], [photos, videos]);
  const mediaById = useMemo(
    () => new Map(allMedia.map((m) => [m.id, m])),
    [allMedia]
  );

  // Keep version map fresh for pages that do not currently have pending unsaved edits
  useEffect(() => {
    for (const p of pages) {
      if (!pendingDraftsRef.current[p.id]) {
        versionMapRef.current[p.id] = p.version || 1;
      }
    }
  }, [pages]);

  // Compute responsive vertical A4 page dimensions (210:297)
  useEffect(() => {
    const computeMetrics = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 768;

      if (mobile) {
        const w = Math.min(368, Math.max(264, vw - 36));
        const h = Math.round(w / A4_PAGE_RATIO);
        setBookMetrics({ pageW: w, pageH: h, isMobile: true });
      } else {
        // Reserve room for navbar (64), compact header + toolbar (~108), filmstrip (~110), fixed music bar (64)
        // so the entire vertical A4 book + CapCut filmstrip sit above the MusicPlayerBar on 900px+ screens
        const chromeHeight = isFullPageView
          ? mode === "edit"
            ? 440
            : 390
          : 390;
        const maxH = Math.min(isFullPageView ? 600 : 520, Math.max(390, vh - chromeHeight));
        const maxWPerPage = Math.floor(Math.min(1100, vw - 148) / 2);
        const w = Math.max(265, Math.min(Math.floor(maxH * A4_PAGE_RATIO), maxWPerPage));
        const h = Math.round(w / A4_PAGE_RATIO);
        setBookMetrics({ pageW: w, pageH: h, isMobile: false });
      }
    };

    computeMetrics();
    window.addEventListener("resize", computeMetrics);
    return () => window.removeEventListener("resize", computeMetrics);
  }, [isFullPageView, mode]);

  // Resolve full-res photo signed URLs (for sharp A4 book pages) + thumbnail URLs (for videos & picker)
  useEffect(() => {
    let active = true;
    const resolveAll = async () => {
      const thumbPaths: string[] = [];
      const photoPaths: string[] = [];

      for (const m of allMedia) {
        if (m.thumbnail_path) thumbPaths.push(m.thumbnail_path);
        if (m.media_type === "photo" && m.storage_path) {
          photoPaths.push(m.storage_path);
        }
      }

      const [tMap, pMap] = await Promise.all([
        thumbPaths.length > 0 ? getSignedUrlsBatch("thumbnails", thumbPaths) : {},
        photoPaths.length > 0 ? getSignedUrlsBatch("couple-photos", photoPaths) : {},
      ]);
      if (active) setSignedUrls({ ...tMap, ...pMap });
    };
    void resolveAll();
    return () => {
      active = false;
    };
  }, [allMedia]);

  // Resolve fullscreen video URL only when requested
  useEffect(() => {
    if (!fullscreenVideo) return;
    let active = true;
    const targetId = fullscreenVideo.id;
    void getSignedUrl("couple-videos", fullscreenVideo.storage_path).then((u) => {
      if (active) setResolvedFullscreenVideo({ mediaId: targetId, url: u });
    });
    return () => {
      active = false;
    };
  }, [fullscreenVideo]);

  // Derived normalized canvas map (local draft takes precedence while editing a page)
  const canvasByPageId = useMemo(() => {
    const map: Record<string, PageCanvasState> = {};
    for (const p of pages) {
      map[p.id] = drafts[p.id] || normalizePageToCanvasState(p);
    }
    return map;
  }, [pages, drafts]);

  // Clamp currentPageIndex safely against pages.length
  const safePageIndex =
    pages.length === 0
      ? 0
      : Math.min(Math.max(0, currentPageIndex), pages.length - 1);

  const leftSpreadIdx = bookMetrics.isMobile
    ? safePageIndex
    : safePageIndex % 2 === 0
    ? safePageIndex
    : Math.max(0, safePageIndex - 1);
  const rightSpreadIdx = bookMetrics.isMobile ? -1 : leftSpreadIdx + 1;

  const leftPage = pages[leftSpreadIdx] || null;
  const rightPage =
    rightSpreadIdx >= 0 && rightSpreadIdx < pages.length
      ? pages[rightSpreadIdx]
      : null;

  // Resolve effective activePageId (always points to a real page in current spread)
  const effectiveActivePageId = useMemo(() => {
    if (pages.length === 0) return null;
    if (
      activePageId &&
      (leftPage?.id === activePageId || rightPage?.id === activePageId)
    ) {
      return activePageId;
    }
    return leftPage?.id || pages[safePageIndex]?.id || null;
  }, [pages, activePageId, leftPage, rightPage, safePageIndex]);

  const activePage =
    pages.find((p) => p.id === effectiveActivePageId) || null;
  const activeCanvas =
    (effectiveActivePageId && canvasByPageId[effectiveActivePageId]) || null;

  const selectedElement = useMemo(() => {
    if (!activeCanvas || !selectedElementId) return null;
    return (
      activeCanvas.elements.find((e) => e.id === selectedElementId) || null
    );
  }, [activeCanvas, selectedElementId]);

  const activePageLabel = useMemo(() => {
    if (!effectiveActivePageId) return "Sayfa";
    const idx = pages.findIndex((p) => p.id === effectiveActivePageId);
    if (idx < 0) return "Sayfa";
    const num = String(idx + 1).padStart(2, "0");
    if (bookMetrics.isMobile) return `Sayfa ${num}`;
    return idx % 2 === 0 ? `Sol Sayfa (${num})` : `Sağ Sayfa (${num})`;
  }, [effectiveActivePageId, pages, bookMetrics.isMobile]);

  // Core optimistic-concurrency save for a single page (never called on drag frames)
  const commitPageToSupabase = useCallback(
    async (pageId: string, draftToSave: PageCanvasState, forceVersion?: number) => {
      const pageRecord = pages.find((p) => p.id === pageId);
      if (!pageRecord) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        pendingDraftsRef.current[pageId] = draftToSave;
        setSaveState("offline");
        return;
      }

      const nextSeq = (saveSeqRef.current[pageId] || 0) + 1;
      saveSeqRef.current[pageId] = nextSeq;
      pendingDraftsRef.current[pageId] = draftToSave;
      setSaveState("saving");
      setEditorError(null);

      const supabase = createClient();
      const expectedVersion =
        forceVersion ?? versionMapRef.current[pageId] ?? pageRecord.version ?? 1;
      const summary = extractPageSummaryForDb(draftToSave, pageRecord);

      const { data, error } = await supabase.rpc("save_memory_page_optimistic", {
        p_page_id: pageId,
        p_expected_version: expectedVersion,
        p_title: summary.title,
        p_content: summary.content,
        p_memory_date: summary.memory_date,
        p_layout_type: summary.layout_type,
      });

      if (saveSeqRef.current[pageId] !== nextSeq) {
        return; // A newer save superseded this one
      }

      if (error) {
        if (
          error.message?.includes("VERSION_CONFLICT") ||
          error.code === "40001" ||
          error.code === "P0001"
        ) {
          setSaveState("conflict");
          const [{ data: latestRow }, { data: latestEls }] = await Promise.all([
            supabase.from("memory_pages").select("*").eq("id", pageId).single(),
            supabase
              .from("memory_page_elements")
              .select("*")
              .eq("page_id", pageId)
              .order("layer_order", { ascending: true }),
          ]);
          if (latestRow) {
            const fullLatest: MemoryPage = {
              ...(latestRow as MemoryPage),
              elements: (latestEls || []) as MemoryPageElement[],
            };
            setConflict({
              pageId,
              latestPage: fullLatest,
              latestCanvas: normalizePageToCanvasState(fullLatest),
            });
          }
          return;
        }
        setSaveState("error");
        setEditorError(error.message || "Değişiklikler kaydedilemedi.");
        return;
      }

      const savedPage = data as MemoryPage;
      versionMapRef.current[pageId] = savedPage.version;

      // Persist normalized canvas elements atomically after version check passes
      const { error: delErr } = await supabase
        .from("memory_page_elements")
        .delete()
        .eq("page_id", pageId);

      if (delErr) {
        setSaveState("error");
        setEditorError(delErr.message);
        return;
      }

      const rows = serializeCanvasToDbRows(draftToSave, pageId, coupleId);
      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from("memory_page_elements")
          .insert(rows);
        if (insErr) {
          setSaveState("error");
          setEditorError(insErr.message);
          return;
        }
      }

      if (saveSeqRef.current[pageId] === nextSeq) {
        delete pendingDraftsRef.current[pageId];
        setSaveState("saved");
        await onPagesChange();
      }
    },
    [coupleId, onPagesChange, pages]
  );

  // Schedule debounced autosave (~650ms after edit finishes)
  const schedulePageAutosave = useCallback(
    (pageId: string, nextCanvas: PageCanvasState) => {
      pendingDraftsRef.current[pageId] = nextCanvas;
      if (saveTimersRef.current[pageId]) {
        clearTimeout(saveTimersRef.current[pageId]);
      }
      setSaveState("saving");
      saveTimersRef.current[pageId] = setTimeout(() => {
        delete saveTimersRef.current[pageId];
        void commitPageToSupabase(pageId, nextCanvas);
      }, 650);
    },
    [commitPageToSupabase]
  );

  // Flush all pending timers immediately (e.g. when finishing Edit Mode or previewing)
  const flushAllPendingSaves = useCallback(async () => {
    const timers = saveTimersRef.current;
    const pageIds = Object.keys(timers);
    for (const pid of pageIds) {
      clearTimeout(timers[pid]);
      delete timers[pid];
    }
    const entries = Object.entries(pendingDraftsRef.current);
    await Promise.all(
      entries.map(([pid, draft]) => commitPageToSupabase(pid, draft))
    );
  }, [commitPageToSupabase]);

  // Retry queued offline saves automatically when network comes back
  useEffect(() => {
    const handleOnline = () => {
      if (Object.keys(pendingDraftsRef.current).length > 0) {
        void flushAllPendingSaves();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushAllPendingSaves]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Apply a committed mutation to a page (records Undo history + schedules autosave)
  const mutatePageCanvas = useCallback(
    (
      pageId: string,
      updater: (prev: PageCanvasState) => PageCanvasState,
      options?: { recordHistory?: boolean; scheduleSave?: boolean }
    ) => {
      const recordHistory = options?.recordHistory ?? true;
      const scheduleSave = options?.scheduleSave ?? true;

      const current = canvasByPageId[pageId];
      if (!current) return;
      const before = cloneCanvas(current);
      const after = cloneCanvas(updater(before));

      setDrafts((prev) => ({ ...prev, [pageId]: after }));

      if (recordHistory) {
        setUndoStack((prev) => [...prev.slice(-39), { pageId, before, after }]);
        setRedoStack([]);
      }

      if (scheduleSave) {
        schedulePageAutosave(pageId, after);
      }
    },
    [canvasByPageId, schedulePageAutosave]
  );

  // Live drag/resize/rotate mutation — PURE LOCAL STATE, ZERO DB QUERIES
  const handleLiveElementChange = useCallback(
    (pageId: string, updatedEl: CanvasElement) => {
      // Pause any pending debounce timer while a live pointer/touch gesture is active
      if (saveTimersRef.current[pageId]) {
        clearTimeout(saveTimersRef.current[pageId]);
        delete saveTimersRef.current[pageId];
      }
      setDrafts((prev) => {
        const base = prev[pageId] || canvasByPageId[pageId];
        if (!base) return prev;
        return {
          ...prev,
          [pageId]: {
            ...base,
            elements: base.elements.map((e) =>
              e.id === updatedEl.id ? updatedEl : e
            ),
          },
        };
      });
    },
    [canvasByPageId]
  );

  // Pointer-up / edit-end commit — records ONE Undo step and starts debounced autosave
  const dragOriginSnapshotRef = useRef<Record<string, PageCanvasState>>({});

  const captureSnapshotBeforeGesture = useCallback(
    (pageId: string) => {
      if (saveTimersRef.current[pageId]) {
        clearTimeout(saveTimersRef.current[pageId]);
        delete saveTimersRef.current[pageId];
      }
      if (!dragOriginSnapshotRef.current[pageId] && canvasByPageId[pageId]) {
        dragOriginSnapshotRef.current[pageId] = cloneCanvas(
          canvasByPageId[pageId]
        );
      }
    },
    [canvasByPageId]
  );

  const handleCommitElementChange = useCallback(
    (pageId: string, finalEl: CanvasElement) => {
      const current = canvasByPageId[pageId];
      if (!current) return;
      const before =
        dragOriginSnapshotRef.current[pageId] || cloneCanvas(current);
      delete dragOriginSnapshotRef.current[pageId];

      const after: PageCanvasState = {
        ...current,
        elements: current.elements.map((e) =>
          e.id === finalEl.id ? clampCanvasElement(finalEl) : e
        ),
      };

      setDrafts((prev) => ({ ...prev, [pageId]: after }));
      setUndoStack((prev) => [...prev.slice(-39), { pageId, before, after }]);
      setRedoStack([]);
      schedulePageAutosave(pageId, after);
    },
    [canvasByPageId, schedulePageAutosave]
  );

  // Undo / Redo (local session history — never silently overwrites partner edits)
  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r.slice(-39), last]);
      const restored = cloneCanvas(last.before);
      setDrafts((d) => ({ ...d, [last.pageId]: restored }));
      schedulePageAutosave(last.pageId, restored);
      return prev.slice(0, -1);
    });
  }, [schedulePageAutosave]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((u) => [...u.slice(-39), last]);
      const reapplied = cloneCanvas(last.after);
      setDrafts((d) => ({ ...d, [last.pageId]: reapplied }));
      schedulePageAutosave(last.pageId, reapplied);
      return prev.slice(0, -1);
    });
  }, [schedulePageAutosave]);

  // Keyboard shortcuts in Edit Mode (Undo, Redo, Delete selected element, Escape)
  useEffect(() => {
    if (mode !== "edit") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditableField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !inEditableField) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "y" &&
        !inEditableField
      ) {
        e.preventDefault();
        handleRedo();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !inEditableField &&
        selectedElementId &&
        effectiveActivePageId
      ) {
        e.preventDefault();
        const delId = selectedElementId;
        setSelectedElementId(null);
        setCropElementId(null);
        mutatePageCanvas(effectiveActivePageId, (prev) => ({
          ...prev,
          elements: prev.elements.filter((el) => el.id !== delId),
        }));
      } else if (e.key === "Escape" && !inEditableField) {
        setActivePopover(null);
        setCropElementId(null);
        setSelectedElementId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    mode,
    selectedElementId,
    effectiveActivePageId,
    handleUndo,
    handleRedo,
    mutatePageCanvas,
  ]);

  // Read-mode flip handler
  const handleFlip = useCallback(
    (e: { data: number }) => {
      const nextIdx = typeof e?.data === "number" ? e.data : 0;
      setCurrentPageIndex(nextIdx);
      if (pages[nextIdx]) {
        setActivePageId(pages[nextIdx].id);
      }
      if (activeBook) {
        void updatePreferences({
          last_open_book_id: activeBook.id,
          last_open_page_order: nextIdx,
        });
      }
    },
    [activeBook, pages, updatePreferences]
  );

  // Navigate to any page index (works smoothly in both Read Mode and Edit Mode)
  const jumpToPage = useCallback(
    (index: number, pageId?: string) => {
      const clamped = Math.min(Math.max(0, index), Math.max(0, pages.length - 1));
      setCurrentPageIndex(clamped);
      const targetId = pageId || pages[clamped]?.id || null;
      setActivePageId(targetId);
      setSelectedElementId(null);
      setCropElementId(null);

      if (mode === "read") {
        try {
          flipBookRef.current?.pageFlip()?.turnToPage(clamped);
        } catch {
          // Ignore pageFlip transition race
        }
      }
    },
    [mode, pages]
  );

  const stepSpread = (delta: -1 | 1) => {
    if (mode === "read") {
      if (delta < 0) flipBookRef.current?.pageFlip()?.flipPrev();
      else flipBookRef.current?.pageFlip()?.flipNext();
      return;
    }
    const step = bookMetrics.isMobile ? 1 : 2;
    const nextIdx = Math.min(
      Math.max(0, leftSpreadIdx + delta * step),
      Math.max(0, pages.length - 1)
    );
    jumpToPage(nextIdx);
  };

  // Add photo or video to active page (or fill clicked template placeholder slot)
  const addMediaToActivePage = useCallback(
    (media: MediaItem) => {
      const targetSlot = pendingSlotTargetRef.current;
      pendingSlotTargetRef.current = null;

      const targetPageId = targetSlot?.pageId || effectiveActivePageId;
      if (!targetPageId) return;
      const canvas = canvasByPageId[targetPageId];
      if (!canvas) return;

      if (targetSlot) {
        mutatePageCanvas(targetPageId, (prev) => ({
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === targetSlot.elementId
              ? {
                  ...el,
                  element_type: media.media_type === "video" ? "video" : "photo",
                  media_id: media.id,
                  style: {
                    ...el.style,
                    placeholderLabel: undefined,
                    polaroidCaption:
                      el.style.polaroidCaption || media.title || "",
                  },
                }
              : el
          ),
        }));
        setSelectedElementId(targetSlot.elementId);
      } else {
        const newEl = createMediaCanvasElement(media, canvas.elements);
        mutatePageCanvas(targetPageId, (prev) => ({
          ...prev,
          elements: [...prev.elements, newEl],
        }));
        setSelectedElementId(newEl.id);
      }

      setActivePageId(targetPageId);
      setActivePopover(null);
      setCropElementId(null);
    },
    [canvasByPageId, effectiveActivePageId, mutatePageCanvas]
  );

  // Direct device upload (photo or video) via secure quota-checked Storage helper
  const handleDirectMediaUpload = async (
    file: File,
    kind: "photo" | "video"
  ) => {
    if (!effectiveActivePageId) return;
    setUploadingMedia(true);
    setEditorError(null);
    try {
      const uploaded = await uploadCoupleMedia({
        coupleId,
        file,
        mediaType: kind,
        title: file.name.replace(/\.[^.]+$/, ""),
      });
      await Promise.all([onMediaChange(), refreshStorage()]);
      addMediaToActivePage(uploaded);
    } catch (err) {
      setEditorError(
        err instanceof Error
          ? err.message
          : kind === "video"
          ? "Video yüklenemedi."
          : "Fotoğraf yüklenemedi."
      );
    } finally {
      setUploadingMedia(false);
    }
  };

  // Add new editable text box directly onto active page
  const handleAddText = () => {
    if (!effectiveActivePageId || !activeCanvas) return;
    const newEl = createTextCanvasElement(
      activeCanvas.elements,
      activeCanvas.paperPreset
    );
    mutatePageCanvas(effectiveActivePageId, (prev) => ({
      ...prev,
      elements: [...prev.elements, newEl],
    }));
    setSelectedElementId(newEl.id);
    setCropElementId(null);
  };

  // Apply template to active page
  const handleApplyTemplate = (templateId: BookTemplateId) => {
    if (!effectiveActivePageId || !activePage) return;
    mutatePageCanvas(effectiveActivePageId, (prev) =>
      applyTemplateToCanvasState(prev, templateId, activePage.memory_date)
    );
    setSelectedElementId(null);
    setCropElementId(null);
  };

  // Change paper background on active page
  const handleChangePaperPreset = (presetId: PaperPresetId) => {
    if (!effectiveActivePageId) return;
    const preset = getPaperPreset(presetId);
    mutatePageCanvas(effectiveActivePageId, (prev) => ({
      ...prev,
      paperPreset: preset.id,
      background: preset.background,
      elements: prev.elements.map((el) => {
        if (el.element_type !== "text") return el;
        // Gently adapt dark/light default text color when switching to/from charcoal paper
        const curColor = (el.style.color || "#1C1917").toLowerCase();
        if (preset.isDark && (curColor === "#1c1917" || curColor === "#3f3a35" || curColor === "#4a443f")) {
          return { ...el, style: { ...el.style, color: "#F5F5F7" } };
        }
        if (!preset.isDark && curColor === "#f5f5f7") {
          return { ...el, style: { ...el.style, color: "#1C1917" } };
        }
        return el;
      }),
    }));
  };

  // Selected element toolbar updates
  const handleUpdateSelectedElement = (
    patch: Partial<CanvasElement>,
    stylePatch?: Partial<CanvasElement["style"]>,
    commit = true
  ) => {
    if (!effectiveActivePageId || !selectedElementId) return;
    const applyUpdate = (el: CanvasElement) =>
      clampCanvasElement({
        ...el,
        ...patch,
        style: {
          ...el.style,
          ...(stylePatch || {}),
        },
      });

    if (commit) {
      mutatePageCanvas(effectiveActivePageId, (prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === selectedElementId ? applyUpdate(el) : el
        ),
      }));
    } else {
      setDrafts((prev) => {
        const base = prev[effectiveActivePageId] || canvasByPageId[effectiveActivePageId];
        if (!base) return prev;
        return {
          ...prev,
          [effectiveActivePageId]: {
            ...base,
            elements: base.elements.map((el) =>
              el.id === selectedElementId ? applyUpdate(el) : el
            ),
          },
        };
      });
    }
  };

  const handleBringToFront = (elementId: string) => {
    if (!effectiveActivePageId) return;
    mutatePageCanvas(effectiveActivePageId, (prev) => {
      const maxLayer = prev.elements.reduce(
        (max, el) => Math.max(max, el.layer_order || 1),
        1
      );
      return {
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === elementId ? { ...el, layer_order: maxLayer + 1 } : el
        ),
      };
    });
  };

  const handleSendToBack = (elementId: string) => {
    if (!effectiveActivePageId) return;
    mutatePageCanvas(effectiveActivePageId, (prev) => {
      const others = prev.elements
        .filter((el) => el.id !== elementId)
        .sort((a, b) => a.layer_order - b.layer_order);
      const target = prev.elements.find((el) => el.id === elementId);
      if (!target) return prev;
      const reordered = [target, ...others].map((el, i) => ({
        ...el,
        layer_order: i + 1,
      }));
      return { ...prev, elements: reordered };
    });
  };

  const handleDuplicateElement = (elementId: string) => {
    if (!effectiveActivePageId || !activeCanvas) return;
    const orig = activeCanvas.elements.find((e) => e.id === elementId);
    if (!orig) return;
    const maxLayer = activeCanvas.elements.reduce(
      (max, e) => Math.max(max, e.layer_order || 1),
      1
    );
    const copy = clampCanvasElement({
      ...orig,
      id: createLocalElementId(orig.element_type),
      position_x: orig.position_x + 4,
      position_y: orig.position_y + 4,
      layer_order: maxLayer + 1,
      style: { ...orig.style },
    });
    mutatePageCanvas(effectiveActivePageId, (prev) => ({
      ...prev,
      elements: [...prev.elements, copy],
    }));
    setSelectedElementId(copy.id);
  };

  const handleDeleteElement = (elementId: string) => {
    if (!effectiveActivePageId) return;
    setSelectedElementId(null);
    setCropElementId(null);
    mutatePageCanvas(effectiveActivePageId, (prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== elementId),
    }));
  };

  // Move overflowing text non-destructively onto a brand-new next page
  const handleMoveOverflowToNextPage = async (
    pageId: string,
    elementId: string,
    remainingText: string,
    overflowText: string
  ) => {
    if (!activeBook) return;
    const pageIdx = pages.findIndex((p) => p.id === pageId);
    const sourceCanvas = canvasByPageId[pageId];
    const sourceEl = sourceCanvas?.elements.find((e) => e.id === elementId);
    if (pageIdx < 0 || !sourceCanvas || !sourceEl) return;

    // 1. Keep remaining text on current page
    mutatePageCanvas(pageId, (prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === elementId ? { ...el, text_content: remainingText } : el
      ),
    }));

    // 2. Insert a new page right after current page & shift subsequent page_order values
    const supabase = createClient();
    const insertOrder = pageIdx + 1;
    const following = pages.slice(insertOrder);
    if (following.length > 0) {
      await Promise.all(
        following.map((p, offset) =>
          supabase
            .from("memory_pages")
            .update({ page_order: insertOrder + 1 + offset })
            .eq("id", p.id)
        )
      );
    }

    const { data: created, error } = await supabase
      .from("memory_pages")
      .insert({
        book_id: activeBook.id,
        couple_id: coupleId,
        page_order: insertOrder,
        title: pages[pageIdx]?.title ? `${pages[pageIdx].title} (devam)` : "Devam",
        content: overflowText,
        memory_date: pages[pageIdx]?.memory_date || "",
        layout_type: "full-text",
        created_by: user?.id || null,
      })
      .select("*")
      .single();

    if (error || !created) return;

    const continuedCanvas: PageCanvasState = {
      pageId: created.id,
      paperPreset: sourceCanvas.paperPreset,
      background: sourceCanvas.background,
      templateId: "full-text",
      dbLayout: "full-text",
      elements: [
        clampCanvasElement({
          id: createLocalElementId("body"),
          element_type: "text",
          media_id: null,
          text_content: overflowText,
          position_x: 10,
          position_y: 12,
          width: 80,
          height: 76,
          rotation: 0,
          layer_order: 1,
          style: {
            ...sourceEl.style,
            canvasV2: true,
            role: "body",
          },
        }),
      ],
    };

    const rows = serializeCanvasToDbRows(continuedCanvas, created.id, coupleId);
    await supabase.from("memory_page_elements").insert(rows);
    await onPagesChange();
    setCurrentPageIndex(insertOrder);
    setActivePageId(created.id);
    setSelectedElementId(null);
  };

  // Add a fresh blank-ready vertical A4 page & jump into editing it
  const handleAddNewPage = async (enterEdit = true) => {
    if (!activeBook) return;
    await flushAllPendingSaves();
    const supabase = createClient();
    const todayStr = new Date().toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const newOrder = pages.length;
    const { data, error } = await supabase
      .from("memory_pages")
      .insert({
        book_id: activeBook.id,
        couple_id: coupleId,
        page_order: newOrder,
        title: "",
        content: "",
        memory_date: todayStr,
        layout_type: "full-text",
        created_by: user?.id || null,
      })
      .select("*")
      .single();

    if (error || !data) return;

    // Pre-select the new page immediately so Realtime broadcast renders it active with zero flicker
    setCurrentPageIndex(newOrder);
    setActivePageId(data.id);
    setSelectedElementId(null);
    if (enterEdit) {
      setMode("edit");
      setIsPreviewFromEdit(false);
    }

    // Seed v2 blank canvas metadata so it opens completely freeform and crisp
    const blankCanvas: PageCanvasState = {
      pageId: data.id,
      paperPreset: "cream",
      background: getPaperPreset("cream").background,
      templateId: "blank",
      dbLayout: "full-text",
      elements: [],
    };
    const metaRows = serializeCanvasToDbRows(blankCanvas, data.id, coupleId);
    await supabase.from("memory_page_elements").insert(metaRows);
    await onPagesChange();
  };

  // Duplicate an entire page including all normalized elements
  const handleDuplicatePage = async (pageId: string) => {
    if (!activeBook) return;
    await flushAllPendingSaves();
    const idx = pages.findIndex((p) => p.id === pageId);
    const srcPage = pages[idx];
    const srcCanvas = canvasByPageId[pageId];
    if (idx < 0 || !srcPage || !srcCanvas) return;

    const supabase = createClient();
    const insertOrder = idx + 1;
    const following = pages.slice(insertOrder);
    if (following.length > 0) {
      await Promise.all(
        following.map((p, offset) =>
          supabase
            .from("memory_pages")
            .update({ page_order: insertOrder + 1 + offset })
            .eq("id", p.id)
        )
      );
    }

    const { data: created, error } = await supabase
      .from("memory_pages")
      .insert({
        book_id: activeBook.id,
        couple_id: coupleId,
        page_order: insertOrder,
        title: srcPage.title,
        content: srcPage.content,
        memory_date: srcPage.memory_date,
        layout_type: srcPage.layout_type,
        created_by: user?.id || null,
      })
      .select("*")
      .single();

    if (error || !created) return;

    const copiedCanvas: PageCanvasState = {
      ...cloneCanvas(srcCanvas),
      pageId: created.id,
    };
    const rows = serializeCanvasToDbRows(copiedCanvas, created.id, coupleId);
    if (rows.length > 0) {
      await supabase.from("memory_page_elements").insert(rows);
    }

    await onPagesChange();
    setCurrentPageIndex(insertOrder);
    setActivePageId(created.id);
    setSelectedElementId(null);
  };

  // Delete a page safely and normalize remaining order
  const handleDeletePage = async (pageId: string) => {
    if (saveTimersRef.current[pageId]) {
      clearTimeout(saveTimersRef.current[pageId]);
      delete saveTimersRef.current[pageId];
    }
    delete pendingDraftsRef.current[pageId];

    const idx = pages.findIndex((p) => p.id === pageId);
    const supabase = createClient();
    await supabase.from("memory_pages").delete().eq("id", pageId);

    const remaining = pages.filter((p) => p.id !== pageId);
    if (remaining.length > 0) {
      await Promise.all(
        remaining.map((p, order) =>
          p.page_order !== order
            ? supabase
                .from("memory_pages")
                .update({ page_order: order })
                .eq("id", p.id)
            : Promise.resolve()
        )
      );
    }

    setDrafts((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setSelectedElementId(null);
    setCropElementId(null);

    const nextIndex = Math.max(0, Math.min(idx, remaining.length - 1));
    setCurrentPageIndex(nextIndex);
    setActivePageId(remaining[nextIndex]?.id || null);
    await onPagesChange();
  };

  // Drag-and-drop / arrow page reorder from CapCut filmstrip
  const handleReorderPages = async (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= pages.length ||
      toIndex >= pages.length
    ) {
      return;
    }

    const clone = [...pages];
    const [moved] = clone.splice(fromIndex, 1);
    clone.splice(toIndex, 0, moved);

    const supabase = createClient();
    await Promise.all(
      clone.map((p, order) =>
        supabase
          .from("memory_pages")
          .update({ page_order: order })
          .eq("id", p.id)
      )
    );

    setCurrentPageIndex(toIndex);
    setActivePageId(moved.id);
    await onPagesChange();
  };

  // Book settings create/update
  const handleSaveBookMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitleInput.trim()) return;
    const supabase = createClient();

    if (bookModalMode === "create") {
      const { data } = await supabase
        .from("memory_books")
        .insert({
          couple_id: coupleId,
          title: bookTitleInput.trim(),
          description: bookDescInput.trim() || null,
          cover_media_id: bookCoverId,
          created_by: user?.id || null,
        })
        .select("id")
        .single();
      await onBooksChange();
      if (data?.id) onSelectBook(data.id);
    } else if (activeBook) {
      await supabase
        .from("memory_books")
        .update({
          title: bookTitleInput.trim(),
          description: bookDescInput.trim() || null,
          cover_media_id: bookCoverId,
        })
        .eq("id", activeBook.id);
      await onBooksChange();
    }
    setShowBookModal(false);
  };

  // Mode transitions
  const enterEditMode = () => {
    setMode("edit");
    setIsPreviewFromEdit(false);
    setSelectedElementId(null);
    setCropElementId(null);
    setActivePopover(null);
    if (!effectiveActivePageId && pages[safePageIndex]) {
      setActivePageId(pages[safePageIndex].id);
    }
  };

  const handlePreviewFromEdit = async () => {
    await flushAllPendingSaves();
    setActivePopover(null);
    setSelectedElementId(null);
    setCropElementId(null);
    setIsPreviewFromEdit(true);
    setMode("read");
  };

  const handleFinishEditing = async () => {
    await flushAllPendingSaves();
    setActivePopover(null);
    setSelectedElementId(null);
    setCropElementId(null);
    setIsPreviewFromEdit(false);
    setMode("read");
  };

  const spreadWidth = bookMetrics.isMobile
    ? bookMetrics.pageW
    : bookMetrics.pageW * 2;

  return (
    <section
      className={`mx-auto max-w-[1360px] px-3 sm:px-6 lg:px-10 ${
        isFullPageView ? "pt-2.5 pb-28 sm:pb-24" : "pt-3 pb-10"
      }`}
    >
      {/* Compact Editorial Book Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[20px] sm:text-[24px] font-semibold tracking-[-0.02em] text-[#F5F5F7] truncate">
              {activeBook?.title || "Anı Kitabımız"}
            </h2>
            {books.length > 1 && (
              <select
                value={activeBook?.id || ""}
                onChange={(e) => {
                  void flushAllPendingSaves();
                  setDrafts({});
                  setUndoStack([]);
                  setRedoStack([]);
                  onSelectBook(e.target.value);
                }}
                aria-label="Anı kitabı seç"
                className="rounded-lg border border-[#343438] bg-[#18181B] px-2.5 py-1 text-[12px] text-[#F5F5F7] cursor-pointer"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}
            <span className="rounded-full border border-[#2E2E33] bg-[#18181B] px-2 py-0.5 text-[11px] text-[#A1A1A6]">
              {mode === "edit"
                ? "Düzenleme Modu"
                : isPreviewFromEdit
                ? "Önizleme"
                : "Okuma Modu"}
            </span>
          </div>
          {mode === "read" && !isPreviewFromEdit && activeBook?.description && (
            <p className="text-[12px] text-[#A1A1A6] mt-0.5 truncate">
              {activeBook.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === "read" && isPreviewFromEdit ? (
            <>
              <button
                type="button"
                onClick={enterEditMode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-3 py-1.5 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#D88A96]" />
                <span>Düzenlemeye dön</span>
              </button>
              <button
                type="button"
                onClick={() => void handleFinishEditing()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[12px] font-medium text-[#101012] transition-apple cursor-pointer"
              >
                <span>Düzenlemeyi bitir</span>
              </button>
            </>
          ) : mode === "read" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setBookModalMode("edit");
                  setBookTitleInput(activeBook?.title || "");
                  setBookDescInput(activeBook?.description || "");
                  setBookCoverId(activeBook?.cover_media_id || null);
                  setShowBookModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-2.5 py-1.5 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#A1A1A6]" />
                <span className="hidden sm:inline">Kitap Ayarları</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookModalMode("create");
                  setBookTitleInput("");
                  setBookDescInput("");
                  setBookCoverId(null);
                  setShowBookModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-2.5 py-1.5 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-[#A1A1A6]" />
                <span className="hidden sm:inline">Yeni Kitap</span>
              </button>

              {pages.length > 0 && (
                <button
                  type="button"
                  onClick={enterEditMode}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#101012] transition-apple cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Kitabı Düzenle</span>
                </button>
              )}
            </>
          ) : (
            <span className="text-[11px] text-[#A1A1A6]">
              Aktif: <strong className="text-[#F5F5F7]">{activePageLabel}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Picsart / CapCut Studio Toolbar (Visible ONLY in Edit Mode) */}
      {mode === "edit" && pages.length > 0 && activeCanvas && (
        <BookEditorToolbar
          activePopover={activePopover}
          onChangePopover={setActivePopover}
          activePageLabel={activePageLabel}
          activePageHasContent={activeCanvas.elements.length > 0}
          activePaperPreset={activeCanvas.paperPreset}
          activeTemplateId={activeCanvas.templateId}
          selectedElement={selectedElement}
          cropElementId={cropElementId}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          saveState={saveState}
          uploadingMedia={uploadingMedia}
          uploadError={editorError}
          photos={photos}
          videos={videos}
          signedUrls={signedUrls}
          onSelectTool={() => {
            setActivePopover(null);
            setCropElementId(null);
          }}
          onPickGalleryMedia={addMediaToActivePage}
          onUploadMediaFile={(file, kind) =>
            void handleDirectMediaUpload(file, kind)
          }
          onAddText={handleAddText}
          onApplyTemplate={handleApplyTemplate}
          onChangePaperPreset={handleChangePaperPreset}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPreview={() => void handlePreviewFromEdit()}
          onFinishEditing={() => void handleFinishEditing()}
          onUpdateSelectedElement={handleUpdateSelectedElement}
          onToggleCropMode={(id) => setCropElementId(id)}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onDuplicateElement={handleDuplicateElement}
          onDeleteElement={handleDeleteElement}
        />
      )}

      {/* Optimistic Concurrency Conflict Resolution Banner (never overwrites partner silently) */}
      {saveState === "conflict" && conflict && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/45 bg-[#18181B] px-4 py-3 text-[12px]">
          <div className="flex items-center gap-2 text-[#F5F5F7]">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Bu sayfa partneriniz tarafından güncellenmiş (v
              {conflict.latestPage.version}). Değişiklikleri kaybetmemek için
              seçim yapın:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                versionMapRef.current[conflict.pageId] =
                  conflict.latestPage.version;
                delete pendingDraftsRef.current[conflict.pageId];
                setDrafts((prev) => ({
                  ...prev,
                  [conflict.pageId]: conflict.latestCanvas,
                }));
                setConflict(null);
                setSaveState("saved");
                void onPagesChange();
              }}
              className="rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#2E2E33] px-3 py-1.5 text-[11px] font-medium text-[#F5F5F7] cursor-pointer"
            >
              Partnerin sürümünü yükle
            </button>
            <button
              type="button"
              onClick={() => {
                const targetId = conflict.pageId;
                const latestVer = conflict.latestPage.version;
                const myDraft =
                  pendingDraftsRef.current[targetId] || canvasByPageId[targetId];
                setConflict(null);
                if (myDraft) {
                  void commitPageToSupabase(targetId, myDraft, latestVer);
                }
              }}
              className="rounded-lg bg-[#F5F5F7] hover:bg-white px-3 py-1.5 text-[11px] font-medium text-[#101012] cursor-pointer"
            >
              Benim düzenlememi kaydet
            </button>
          </div>
        </div>
      )}

      {/* Centerpiece Vertical A4 Physical Book */}
      {pages.length === 0 ? (
        <div className="mx-auto max-w-[640px] rounded-[14px] border border-[#343438] bg-[#1D1C20] p-3 shadow-[0_26px_68px_rgba(0,0,0,0.7)]">
          <div className="rounded-[5px] bg-[#F6F2EA] px-8 py-16 text-center text-[#1C1917]">
            <p className="font-editorial text-[24px] font-medium">
              İlk anı sayfanızı birlikte oluşturun.
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-[#57524E]">
              Kitabınız şu an boş. İlk sayfayı ekleyerek doğrudan kitabın
              üzerinde fotoğraf, video ve hikâyelerinizi tasarlayabilirsiniz.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void handleAddNewPage(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1C1917] hover:bg-black px-5 py-2.5 text-[13px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>İlk Sayfayı Oluştur</span>
              </button>
              <button
                type="button"
                onClick={onOpenPhotoUploadModal}
                className="inline-flex items-center gap-2 rounded-lg border border-[#CFC6BA] bg-[#FAF8F5] hover:bg-white px-5 py-2.5 text-[13px] font-medium text-[#1C1917] transition-apple cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Fotoğraf Yükle</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Edit Mode Subtle Page Side Labels above open spread */}
          {mode === "edit" && !bookMetrics.isMobile && (
            <div
              style={{ width: `${spreadWidth}px` }}
              className="mb-1.5 grid grid-cols-2 px-3 text-[11px] text-[#8E8E96]"
            >
              <button
                type="button"
                onClick={() => {
                  if (leftPage) {
                    setActivePageId(leftPage.id);
                    setSelectedElementId(null);
                    setCropElementId(null);
                  }
                }}
                className={`text-left transition-apple cursor-pointer ${
                  effectiveActivePageId === leftPage?.id
                    ? "text-[#D88A96] font-medium"
                    : "hover:text-[#F5F5F7]"
                }`}
              >
                Sol Sayfa ({String(leftSpreadIdx + 1).padStart(2, "0")})
                {effectiveActivePageId === leftPage?.id ? " • Seçili" : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (rightPage) {
                    setActivePageId(rightPage.id);
                    setSelectedElementId(null);
                    setCropElementId(null);
                  }
                }}
                className={`text-right transition-apple cursor-pointer ${
                  effectiveActivePageId === rightPage?.id
                    ? "text-[#D88A96] font-medium"
                    : "hover:text-[#F5F5F7]"
                }`}
              >
                {rightPage
                  ? `Sağ Sayfa (${String(rightSpreadIdx + 1).padStart(2, "0")})${
                      effectiveActivePageId === rightPage.id ? " • Seçili" : ""
                    }`
                  : "Sağ Sayfa (Boş)"}
              </button>
            </div>
          )}

          {/* Book Stage + Flanking Navigation Chevrons */}
          <div className="relative flex w-full items-center justify-center">
            <button
              type="button"
              onClick={() => stepSpread(-1)}
              disabled={safePageIndex <= 0 && mode === "edit"}
              aria-label="Önceki Sayfa"
              className="z-20 mr-1.5 sm:mr-4 hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#343438] bg-[#18181B]/90 text-[#F5F5F7] hover:bg-[#242429] disabled:opacity-30 transition-apple cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Hardcover Book Binding + Realistic Stacked Paper Edges */}
            <div
              data-book-stage="true"
              data-book-mode={mode}
              className="relative rounded-[12px] border border-[#343438] bg-[#1D1C20] p-[6px] sm:p-[10px] shadow-[0_28px_72px_rgba(0,0,0,0.75),0_8px_22px_rgba(0,0,0,0.45)]"
            >
              {/* Stacked Paper Thickness Rim */}
              <div
                className="relative rounded-[6px] p-[2px] sm:px-[5px] sm:py-[3px]"
                style={{
                  background:
                    "linear-gradient(90deg, #C7BEB1 0%, #E7E0D5 1.5%, #D5CCC0 3%, #EDE7DD 50%, #D5CCC0 97%, #E7E0D5 98.5%, #C7BEB1 100%)",
                }}
              >
                <div
                  style={{
                    width: `${spreadWidth}px`,
                    height: `${bookMetrics.pageH}px`,
                  }}
                  className="relative overflow-hidden rounded-[4px] bg-[#F6F2EA]"
                >
                  {mode === "read" ? (
                    /* READ MODE: Apple Books Realistic Page Flip (isolated keyed shell protects React 19 from st-pageflip DOM reparenting) */
                    <div
                      key={`flip-shell-${activeBook?.id || "b"}-${pages
                        .map((p) => p.id)
                        .join("_")}-${bookMetrics.pageW}x${bookMetrics.pageH}-${
                        bookMetrics.isMobile ? "m" : "d"
                      }`}
                      className="h-full w-full"
                    >
                      <HTMLFlipBook
                        ref={flipBookRef}
                        width={bookMetrics.pageW}
                        height={bookMetrics.pageH}
                        size="fixed"
                        minWidth={bookMetrics.pageW}
                        maxWidth={bookMetrics.pageW}
                        minHeight={bookMetrics.pageH}
                        maxHeight={bookMetrics.pageH}
                        maxShadowOpacity={0.36}
                        showCover={false}
                        mobileScrollSupport={true}
                        usePortrait={bookMetrics.isMobile}
                        startPage={safePageIndex}
                        drawShadow={true}
                        flippingTime={720}
                        useMouseEvents={true}
                        swipeDistance={28}
                        onFlip={handleFlip}
                        className="mx-auto"
                      >
                        {pages.map((page, index) => (
                          <BookPageCanvas
                            key={page.id}
                            canvas={canvasByPageId[page.id]}
                            pageNumber={index + 1}
                            isLeftPage={index % 2 === 0}
                            isSingleMobile={bookMetrics.isMobile}
                            mode="read"
                            mediaById={mediaById}
                            signedUrls={signedUrls}
                            onExpandVideoFullscreen={(m) => setFullscreenVideo(m)}
                          />
                        ))}
                      </HTMLFlipBook>
                    </div>
                  ) : (
                    /* EDIT MODE: Direct Interactive Canvas Spread (Zero Accidental Flips!) */
                    <div
                      key="edit-spread-shell"
                      className={`grid h-full w-full ${
                        bookMetrics.isMobile ? "grid-cols-1" : "grid-cols-2"
                      }`}
                    >
                      {leftPage && canvasByPageId[leftPage.id] && (
                        <BookPageCanvas
                          canvas={canvasByPageId[leftPage.id]}
                          pageNumber={leftSpreadIdx + 1}
                          isLeftPage={true}
                          isSingleMobile={bookMetrics.isMobile}
                          mode="edit"
                          isActivePage={effectiveActivePageId === leftPage.id}
                          selectedElementId={
                            effectiveActivePageId === leftPage.id
                              ? selectedElementId
                              : null
                          }
                          cropElementId={
                            effectiveActivePageId === leftPage.id
                              ? cropElementId
                              : null
                          }
                          mediaById={mediaById}
                          signedUrls={signedUrls}
                          onActivatePage={() => {
                            if (effectiveActivePageId !== leftPage.id) {
                              setActivePageId(leftPage.id);
                              setSelectedElementId(null);
                              setCropElementId(null);
                            }
                          }}
                          onSelectElement={(elId) => {
                            setActivePageId(leftPage.id);
                            setSelectedElementId(elId);
                            if (elId !== cropElementId) setCropElementId(null);
                            if (elId) captureSnapshotBeforeGesture(leftPage.id);
                          }}
                          onLiveElementChange={(el) =>
                            handleLiveElementChange(leftPage.id, el)
                          }
                          onCommitElementChange={(el) =>
                            handleCommitElementChange(leftPage.id, el)
                          }
                          onRequestSlotMedia={(elId, kind) => {
                            pendingSlotTargetRef.current = {
                              pageId: leftPage.id,
                              elementId: elId,
                            };
                            setActivePageId(leftPage.id);
                            setActivePopover(kind);
                          }}
                          onMoveOverflowToNextPage={(elId, rem, ov) =>
                            void handleMoveOverflowToNextPage(
                              leftPage.id,
                              elId,
                              rem,
                              ov
                            )
                          }
                        />
                      )}

                      {!bookMetrics.isMobile &&
                        (rightPage && canvasByPageId[rightPage.id] ? (
                          <BookPageCanvas
                            canvas={canvasByPageId[rightPage.id]}
                            pageNumber={rightSpreadIdx + 1}
                            isLeftPage={false}
                            isSingleMobile={false}
                            mode="edit"
                            isActivePage={effectiveActivePageId === rightPage.id}
                            selectedElementId={
                              effectiveActivePageId === rightPage.id
                                ? selectedElementId
                                : null
                            }
                            cropElementId={
                              effectiveActivePageId === rightPage.id
                                ? cropElementId
                                : null
                            }
                            mediaById={mediaById}
                            signedUrls={signedUrls}
                            onActivatePage={() => {
                              if (effectiveActivePageId !== rightPage.id) {
                                setActivePageId(rightPage.id);
                                setSelectedElementId(null);
                                setCropElementId(null);
                              }
                            }}
                            onSelectElement={(elId) => {
                              setActivePageId(rightPage.id);
                              setSelectedElementId(elId);
                              if (elId !== cropElementId)
                                setCropElementId(null);
                              if (elId)
                                captureSnapshotBeforeGesture(rightPage.id);
                            }}
                            onLiveElementChange={(el) =>
                              handleLiveElementChange(rightPage.id, el)
                            }
                            onCommitElementChange={(el) =>
                              handleCommitElementChange(rightPage.id, el)
                            }
                            onRequestSlotMedia={(elId, kind) => {
                              pendingSlotTargetRef.current = {
                                pageId: rightPage.id,
                                elementId: elId,
                              };
                              setActivePageId(rightPage.id);
                              setActivePopover(kind);
                            }}
                            onMoveOverflowToNextPage={(elId, rem, ov) =>
                              void handleMoveOverflowToNextPage(
                                rightPage.id,
                                elId,
                                rem,
                                ov
                              )
                            }
                          />
                        ) : (
                          /* Balanced Physical Facing Blank Sheet when total pages is odd */
                          <div className="relative flex h-full w-full flex-col items-center justify-center rounded-r-[4px] border-l border-[#DFD8CE] bg-[#F4EFE6] p-6 text-center">
                            <div className="pointer-events-none absolute inset-y-0 left-0 w-[10%] bg-gradient-to-r from-[#1C1917]/[0.14] via-[#1C1917]/[0.04] to-transparent" />
                            <p className="text-[13px] font-medium text-[#6E675F]">
                              Karşı sayfa henüz oluşturulmadı
                            </p>
                            <button
                              type="button"
                              onClick={() => void handleAddNewPage(true)}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#CFC6B8] bg-[#FAF8F5] hover:bg-white px-3.5 py-2 text-[12px] font-medium text-[#1C1917] shadow-xs transition-apple cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Sağ Sayfa Ekle</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Center Physical Book Spine Crease (Desktop Open Spread) */}
                  {!bookMetrics.isMobile && (
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] z-30 bg-gradient-to-r from-[#1C1917]/25 via-[#1C1917]/45 to-white/35" />
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => stepSpread(1)}
              disabled={
                mode === "edit" &&
                (bookMetrics.isMobile
                  ? safePageIndex >= pages.length - 1
                  : rightSpreadIdx >= pages.length - 1)
              }
              aria-label="Sonraki Sayfa"
              className="z-20 ml-1.5 sm:ml-4 hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#343438] bg-[#18181B]/90 text-[#F5F5F7] hover:bg-[#242429] disabled:opacity-30 transition-apple cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Compact Page Prev/Next Controls */}
          {bookMetrics.isMobile && pages.length > 1 && (
            <div className="mt-2.5 flex items-center justify-center gap-4 text-[12px] text-[#A1A1A6]">
              <button
                type="button"
                onClick={() => stepSpread(-1)}
                disabled={safePageIndex <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-[#343438] bg-[#18181B] px-3 py-1 text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Önceki</span>
              </button>
              <span className="tabular-nums text-[12px] text-[#F5F5F7]">
                {safePageIndex + 1} / {pages.length}
              </span>
              <button
                type="button"
                onClick={() => stepSpread(1)}
                disabled={safePageIndex >= pages.length - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-[#343438] bg-[#18181B] px-3 py-1 text-[#F5F5F7] disabled:opacity-30 cursor-pointer"
              >
                <span>Sonraki</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* CapCut-Style Horizontal Scrollable Bottom Page Filmstrip */}
          <div className="w-full max-w-[1060px]">
            <BookPageFilmstrip
              pages={pages}
              canvasByPageId={canvasByPageId}
              currentPageIndex={safePageIndex}
              activePageId={effectiveActivePageId}
              isEditMode={mode === "edit"}
              isMobile={bookMetrics.isMobile}
              mediaById={mediaById}
              signedUrls={signedUrls}
              onSelectPage={(idx, pid) => jumpToPage(idx, pid)}
              onAddPage={() => void handleAddNewPage(true)}
              onDuplicatePage={(pid) => void handleDuplicatePage(pid)}
              onDeletePage={(pid) => void handleDeletePage(pid)}
              onReorderPages={(from, to) => void handleReorderPages(from, to)}
            />
          </div>
        </div>
      )}

      {/* Create / Edit Memory Book Metadata Modal (Book Title & Cover Only — NOT Page Editor) */}
      {showBookModal && (
        <div
          onClick={() => setShowBookModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSaveBookMeta}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#343438] bg-[#18181B] p-6 text-[#F5F5F7] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold">
                {bookModalMode === "create"
                  ? "Yeni Anı Kitabı Oluştur"
                  : "Kitap Başlığı ve Kapağı"}
              </h3>
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                className="text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Kitap Başlığı
              </label>
              <input
                type="text"
                required
                value={bookTitleInput}
                onChange={(e) => setBookTitleInput(e.target.value)}
                placeholder="Örn: İlk Yılımız"
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                Açıklama
              </label>
              <input
                type="text"
                value={bookDescInput}
                onChange={(e) => setBookDescInput(e.target.value)}
                placeholder="Kısa alt başlık"
                className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
              />
            </div>

            {photos.length > 0 && (
              <div>
                <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                  Kapak Fotoğrafı (isteğe bağlı)
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-24 overflow-y-auto">
                  {photos.slice(0, 15).map((p) => {
                    const url =
                      (p.thumbnail_path && signedUrls[p.thumbnail_path]) ||
                      signedUrls[p.storage_path];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setBookCoverId(bookCoverId === p.id ? null : p.id)
                        }
                        className={`aspect-square overflow-hidden rounded border-2 cursor-pointer ${
                          bookCoverId === p.id
                            ? "border-[#D88A96]"
                            : "border-transparent opacity-70"
                        }`}
                      >
                        {url && (
                          <img
                            src={url}
                            alt={p.title || "Kapak"}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                className="rounded-lg border border-[#343438] px-4 py-2 text-[13px] text-[#A1A1A6] cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2 text-[13px] font-medium text-[#101012] cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Optional Fullscreen Video Modal (Triggered only if user clicks expand button inside book player) */}
      {fullscreenVideo && (
        <div
          onClick={() => setFullscreenVideo(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101012]/95 p-6 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#F5F5F7]">
                {fullscreenVideo.title || "Video"}
              </h3>
              <button
                type="button"
                onClick={() => setFullscreenVideo(null)}
                className="rounded-lg border border-[#343438] bg-[#18181B] p-2 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {fullscreenVideoUrl ? (
              <video
                src={fullscreenVideoUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[75vh] w-full rounded-xl border border-[#343438] bg-black"
              />
            ) : (
              <div className="flex h-60 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D88A96] border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
