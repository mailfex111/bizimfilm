import {
  type BookLayoutType,
  type MediaItem,
  type MemoryPage,
  type MemoryPageElement,
} from "@/types";

export type BookTemplateId =
  | "blank"
  | "single-photo"
  | "photo-text"
  | "two-photos"
  | "polaroid"
  | "full-text"
  | "video-note"
  | "minimal-collage";

export type PhotoFrameStyle = "none" | "thin" | "double" | "rounded" | "shadow";

export type TextFontKey = "sf-pro" | "playfair" | "georgia" | "mono";

export type TextAlignValue = "left" | "center" | "right";

export type PaperPresetId =
  | "cream"
  | "ivory"
  | "linen"
  | "sand"
  | "blush"
  | "charcoal";

export interface PaperPreset {
  id: PaperPresetId;
  label: string;
  background: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  isDark?: boolean;
}

export const PAPER_PRESETS: PaperPreset[] = [
  {
    id: "cream",
    label: "Krem Kâğıt",
    background: "#F6F2EA",
    textColor: "#1C1917",
    mutedColor: "#78716A",
    borderColor: "#DFD8CE",
  },
  {
    id: "ivory",
    label: "Fildişi",
    background: "#FAF7F2",
    textColor: "#1C1917",
    mutedColor: "#7A736C",
    borderColor: "#E5DFD6",
  },
  {
    id: "linen",
    label: "Doğal Keten",
    background: "#EFEAE1",
    textColor: "#1F1B18",
    mutedColor: "#6E675F",
    borderColor: "#D8CFC3",
  },
  {
    id: "sand",
    label: "Sıcak Kum",
    background: "#EAE0D0",
    textColor: "#241E19",
    mutedColor: "#6F6457",
    borderColor: "#D2C4B0",
  },
  {
    id: "blush",
    label: "Gül Kâğıdı",
    background: "#F5ECEE",
    textColor: "#261B1E",
    mutedColor: "#7D666C",
    borderColor: "#E1CFD4",
  },
  {
    id: "charcoal",
    label: "Gece Sayfası",
    background: "#1E1D21",
    textColor: "#F5F5F7",
    mutedColor: "#A1A1A6",
    borderColor: "#343438",
    isDark: true,
  },
];

export const TEXT_FONT_OPTIONS: Array<{
  key: TextFontKey;
  label: string;
  cssFamily: string;
}> = [
  {
    key: "sf-pro",
    label: "SF Pro",
    cssFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-inter), sans-serif',
  },
  {
    key: "playfair",
    label: "Playfair",
    cssFamily: 'var(--font-playfair), Georgia, "Times New Roman", serif',
  },
  {
    key: "georgia",
    label: "Georgia",
    cssFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    key: "mono",
    label: "Daktilo",
    cssFamily: '"SFMono-Regular", ui-monospace, "Courier New", monospace',
  },
];

export const TEXT_COLOR_SWATCHES = [
  { hex: "#1C1917", label: "Kömür" },
  { hex: "#4A443F", label: "Sıcak Gri" },
  { hex: "#78716A", label: "Taş" },
  { hex: "#8F3D4B", label: "Bordo Gül" },
  { hex: "#284B63", label: "Gece Mavisi" },
  { hex: "#2F5233", label: "Orman" },
  { hex: "#F5F5F7", label: "Açık Beyaz" },
];

export const FRAME_OPTIONS: Array<{ id: PhotoFrameStyle; label: string }> = [
  { id: "none", label: "Yok" },
  { id: "thin", label: "İnce" },
  { id: "double", label: "Çift" },
  { id: "rounded", label: "Yuvarlak" },
  { id: "shadow", label: "Gölge" },
];

export const BOOK_TEMPLATES: Array<{
  id: BookTemplateId;
  label: string;
  description: string;
  dbLayout: BookLayoutType;
}> = [
  {
    id: "blank",
    label: "Boş Sayfa",
    description: "Serbest tasarım alanı",
    dbLayout: "full-text",
  },
  {
    id: "single-photo",
    label: "Tek Büyük Fotoğraf",
    description: "Tam odak fotoğraf ve başlık",
    dbLayout: "single-photo",
  },
  {
    id: "photo-text",
    label: "Fotoğraf ve Metin",
    description: "Üstte görsel, altta hikâye",
    dbLayout: "photo-text",
  },
  {
    id: "two-photos",
    label: "İki Fotoğraf",
    description: "Dengeli çift görsel düzeni",
    dbLayout: "two-photos",
  },
  {
    id: "polaroid",
    label: "Polaroid",
    description: "Klasik Polaroid kart ve not",
    dbLayout: "polaroid",
  },
  {
    id: "full-text",
    label: "Tam Sayfa Metin",
    description: "Roman sayfası görünümü",
    dbLayout: "full-text",
  },
  {
    id: "video-note",
    label: "Video ve Açıklama",
    description: "Kitap içi video oynatıcı",
    dbLayout: "video-note",
  },
  {
    id: "minimal-collage",
    label: "Minimal Kolaj",
    description: "Asimetrik galeri düzeni",
    dbLayout: "minimal-collage",
  },
];

export interface CanvasElementStyle {
  canvasV2?: boolean;
  isPageMeta?: boolean;
  // Page meta fields (only when isPageMeta === true)
  paperPreset?: PaperPresetId;
  background?: string;
  templateId?: BookTemplateId;
  // Photo / video fields
  frameStyle?: PhotoFrameStyle;
  polaroid?: boolean;
  polaroidCaption?: string;
  cropX?: number; // 0..100
  cropY?: number; // 0..100
  cropZoom?: number; // 1..3
  aspectRatio?: number; // natural width / height
  placeholderLabel?: string;
  // Text fields
  role?: "title" | "body" | "date" | "caption";
  fontFamily?: TextFontKey;
  fontSize?: number; // reference px on 420px wide A4 page
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  color?: string;
  textAlign?: TextAlignValue;
  lineHeight?: number;
}

export interface CanvasElement {
  id: string;
  element_type: "photo" | "video" | "text" | "caption";
  media_id: string | null;
  text_content: string;
  /** Normalized 0..100 (% of A4 page width) */
  position_x: number;
  /** Normalized 0..100 (% of A4 page height) */
  position_y: number;
  /** Normalized 4..100 (% of A4 page width) */
  width: number;
  /** Normalized 3..100 (% of A4 page height) */
  height: number;
  /** Degrees -180..180 */
  rotation: number;
  layer_order: number;
  style: CanvasElementStyle;
}

export interface PageCanvasState {
  pageId: string;
  paperPreset: PaperPresetId;
  background: string;
  templateId: BookTemplateId;
  dbLayout: BookLayoutType;
  elements: CanvasElement[];
}

export const A4_PAGE_RATIO = 210 / 297; // ~0.70707

export function createLocalElementId(prefix = "el"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getPaperPreset(id?: string | null): PaperPreset {
  return PAPER_PRESETS.find((p) => p.id === id) || PAPER_PRESETS[0];
}

export function getFontCssFamily(key?: TextFontKey | string | null): string {
  return (
    TEXT_FONT_OPTIONS.find((f) => f.key === key)?.cssFamily ||
    TEXT_FONT_OPTIONS[0].cssFamily
  );
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Clamp element coordinates so it never escapes the A4 page bounds
 * and always satisfies DB CHECK (width > 0 AND height > 0).
 */
export function clampCanvasElement(el: CanvasElement): CanvasElement {
  const minW = el.element_type === "text" ? 14 : 10;
  const minH = el.element_type === "text" ? 4.5 : 8;
  const width = round2(Math.min(96, Math.max(minW, Number(el.width) || 30)));
  const height = round2(Math.min(94, Math.max(minH, Number(el.height) || 20)));
  const maxX = Math.max(0, 100 - width);
  const maxY = Math.max(0, 100 - height);
  const position_x = round2(
    Math.min(maxX, Math.max(0, Number(el.position_x) || 0))
  );
  const position_y = round2(
    Math.min(maxY, Math.max(0, Number(el.position_y) || 0))
  );

  let rotation = Number(el.rotation) || 0;
  while (rotation > 180) rotation -= 360;
  while (rotation < -180) rotation += 360;
  rotation = round2(rotation);

  return {
    ...el,
    position_x,
    position_y,
    width,
    height,
    rotation,
  };
}

/**
 * Convert a DB MemoryPage (either new canvasV2 OR legacy format) into
 * a normalized PageCanvasState for direct rendering and editing.
 */
export function normalizePageToCanvasState(page: MemoryPage): PageCanvasState {
  const rawElements = [...(page.elements || [])].sort(
    (a, b) => (a.layer_order ?? 0) - (b.layer_order ?? 0)
  );

  const metaEl = rawElements.find((el) => el.style?.isPageMeta === true);
  const isV2 =
    Boolean(metaEl) ||
    rawElements.some((el) => el.style?.canvasV2 === true);

  if (isV2) {
    const metaStyle = (metaEl?.style || {}) as CanvasElementStyle;
    const preset = getPaperPreset(metaStyle.paperPreset);
    const background =
      typeof metaStyle.background === "string" && metaStyle.background
        ? metaStyle.background
        : preset.background;
    const templateId: BookTemplateId =
      (metaStyle.templateId as BookTemplateId) ||
      (page.layout_type as BookTemplateId) ||
      "photo-text";

    const visibleElements: CanvasElement[] = rawElements
      .filter((el) => el.style?.isPageMeta !== true)
      .map((el, idx) =>
        clampCanvasElement({
          id: el.id || createLocalElementId(),
          element_type: el.element_type,
          media_id: el.media_id || null,
          text_content: el.text_content || "",
          position_x: Number(el.position_x ?? 8),
          position_y: Number(el.position_y ?? 8),
          width: Number(el.width ?? 60),
          height: Number(el.height ?? 30),
          rotation: Number(el.rotation ?? 0),
          layer_order: typeof el.layer_order === "number" ? el.layer_order : idx + 1,
          style: {
            canvasV2: true,
            ...(el.style as CanvasElementStyle),
          },
        })
      );

    return {
      pageId: page.id,
      paperPreset: preset.id,
      background,
      templateId,
      dbLayout: page.layout_type || "photo-text",
      elements: visibleElements,
    };
  }

  // Legacy page backward-compatible projection into vertical A4 proportions
  const legacyMedia = rawElements.filter(
    (el) =>
      (el.element_type === "photo" || el.element_type === "video") &&
      Boolean(el.media_id)
  );
  const firstMedia = legacyMedia[0];
  const secondMedia = legacyMedia[1];
  const firstCropX = Math.min(100, Math.max(0, 50 + Number(firstMedia?.position_x || 0)));
  const firstCropY = Math.min(100, Math.max(0, 50 + Number(firstMedia?.position_y || 0)));
  const firstZoom = Math.min(2.5, Math.max(1, Number(firstMedia?.width || 100) / 100));

  const titleText = (page.title || "").trim();
  const dateText = (page.memory_date || "").trim();
  const bodyText = (page.content || "").trim();

  const elements: CanvasElement[] = [];
  let layer = 1;

  const pushDate = (x: number, y: number, w: number, align: TextAlignValue = "left") => {
    if (!dateText) return;
    elements.push(
      clampCanvasElement({
        id: createLocalElementId("date"),
        element_type: "text",
        media_id: null,
        text_content: dateText,
        position_x: x,
        position_y: y,
        width: w,
        height: 5,
        rotation: 0,
        layer_order: layer++,
        style: {
          canvasV2: true,
          role: "date",
          fontFamily: "sf-pro",
          fontSize: 10.5,
          fontWeight: "bold",
          fontStyle: "normal",
          textDecoration: "none",
          color: "#78716A",
          textAlign: align,
          lineHeight: 1.3,
        },
      })
    );
  };

  const pushTitle = (
    x: number,
    y: number,
    w: number,
    h: number,
    size = 22,
    align: TextAlignValue = "left"
  ) => {
    if (!titleText) return;
    elements.push(
      clampCanvasElement({
        id: createLocalElementId("title"),
        element_type: "text",
        media_id: null,
        text_content: titleText,
        position_x: x,
        position_y: y,
        width: w,
        height: h,
        rotation: 0,
        layer_order: layer++,
        style: {
          canvasV2: true,
          role: "title",
          fontFamily: "playfair",
          fontSize: size,
          fontWeight: "normal",
          fontStyle: "normal",
          textDecoration: "none",
          color: "#1C1917",
          textAlign: align,
          lineHeight: 1.22,
        },
      })
    );
  };

  const pushBody = (
    x: number,
    y: number,
    w: number,
    h: number,
    size = 13.5,
    align: TextAlignValue = "left"
  ) => {
    if (!bodyText) return;
    elements.push(
      clampCanvasElement({
        id: createLocalElementId("body"),
        element_type: "text",
        media_id: null,
        text_content: bodyText,
        position_x: x,
        position_y: y,
        width: w,
        height: h,
        rotation: 0,
        layer_order: layer++,
        style: {
          canvasV2: true,
          role: "body",
          fontFamily: "sf-pro",
          fontSize: size,
          fontWeight: "normal",
          fontStyle: "normal",
          textDecoration: "none",
          color: "#3F3A35",
          textAlign: align,
          lineHeight: 1.62,
        },
      })
    );
  };

  const pushMedia = (
    mediaEl: MemoryPageElement | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: {
      polaroid?: boolean;
      polaroidCaption?: string;
      frameStyle?: PhotoFrameStyle;
      rotation?: number;
      cropX?: number;
      cropY?: number;
      cropZoom?: number;
      forceType?: "photo" | "video";
    }
  ) => {
    if (!mediaEl?.media_id) return;
    elements.push(
      clampCanvasElement({
        id: mediaEl.id || createLocalElementId("media"),
        element_type: opts?.forceType || (mediaEl.element_type === "video" ? "video" : "photo"),
        media_id: mediaEl.media_id,
        text_content: "",
        position_x: x,
        position_y: y,
        width: w,
        height: h,
        rotation: opts?.rotation ?? 0,
        layer_order: layer++,
        style: {
          canvasV2: true,
          frameStyle: opts?.frameStyle ?? "thin",
          polaroid: opts?.polaroid ?? false,
          polaroidCaption: opts?.polaroidCaption ?? "",
          cropX: opts?.cropX ?? 50,
          cropY: opts?.cropY ?? 50,
          cropZoom: opts?.cropZoom ?? 1,
        },
      })
    );
  };

  const layout = page.layout_type || "photo-text";

  switch (layout) {
    case "full-text":
      pushDate(10, 12, 80, "left");
      pushTitle(10, 18, 80, 11, 25, "left");
      pushBody(10, 31, 80, 56, 14, "left");
      break;

    case "single-photo":
      pushMedia(firstMedia, 8, 8, 84, 65, {
        frameStyle: "thin",
        cropX: firstCropX,
        cropY: firstCropY,
        cropZoom: firstZoom,
      });
      pushDate(8, 76, 84, "left");
      pushTitle(8, 81, 84, 9, 19, "left");
      if (bodyText) pushBody(8, 88, 84, 8, 12.5, "left");
      break;

    case "two-photos":
      pushMedia(firstMedia, 8, 9, 84, 34, {
        frameStyle: "thin",
        cropX: firstCropX,
        cropY: firstCropY,
        cropZoom: firstZoom,
      });
      pushMedia(secondMedia, 8, 46, 84, 34, {
        frameStyle: "thin",
      });
      pushDate(8, 82, 84, "left");
      pushTitle(8, 86, 84, 8, 16, "left");
      if (bodyText && !titleText) pushBody(8, 86, 84, 9, 13, "left");
      break;

    case "minimal-collage":
      pushMedia(firstMedia, 8, 9, 64, 42, {
        frameStyle: "shadow",
        rotation: -1.5,
        cropX: firstCropX,
        cropY: firstCropY,
        cropZoom: firstZoom,
      });
      pushMedia(secondMedia, 32, 42, 60, 34, {
        frameStyle: "thin",
        rotation: 1.5,
      });
      pushDate(8, 79, 84, "left");
      pushTitle(8, 83, 84, 8, 17, "left");
      if (bodyText) pushBody(8, 89, 84, 7, 12.5, "left");
      break;

    case "polaroid":
      pushMedia(firstMedia, 14, 9, 72, 49, {
        polaroid: true,
        polaroidCaption: dateText || titleText,
        frameStyle: "shadow",
        rotation: -1.2,
        cropX: firstCropX,
        cropY: firstCropY,
        cropZoom: firstZoom,
      });
      pushTitle(10, 62, 80, 9, 21, "center");
      pushBody(10, 72, 80, 20, 13.5, "center");
      break;

    case "video-note":
      pushMedia(firstMedia, 8, 10, 84, 42, {
        frameStyle: "rounded",
        forceType: "video",
      });
      pushDate(8, 56, 84, "left");
      pushTitle(8, 61, 84, 9, 20, "left");
      pushBody(8, 71, 84, 21, 13.5, "left");
      break;

    case "photo-text":
    default:
      if (firstMedia) {
        pushMedia(firstMedia, 8, 8, 84, 46, {
          frameStyle: "thin",
          cropX: firstCropX,
          cropY: firstCropY,
          cropZoom: firstZoom,
        });
        pushDate(8, 57, 84, "left");
        pushTitle(8, 62, 84, 9, 21, "left");
        pushBody(8, 72, 84, 21, 13.5, "left");
      } else {
        pushDate(10, 12, 80, "left");
        pushTitle(10, 18, 80, 10, 23, "left");
        pushBody(10, 30, 80, 56, 14, "left");
      }
      break;
  }

  return {
    pageId: page.id,
    paperPreset: "cream",
    background: PAPER_PRESETS[0].background,
    templateId: (layout as BookTemplateId) || "photo-text",
    dbLayout: layout,
    elements,
  };
}

/**
 * Apply one of the 8 visual templates to a page.
 * Intelligently preserves existing photos/videos/texts when switching layouts
 * (except "blank", which intentionally provides a clean empty page after user confirmation).
 */
export function applyTemplateToCanvasState(
  current: PageCanvasState,
  templateId: BookTemplateId,
  fallbackDate?: string
): PageCanvasState {
  const tplMeta =
    BOOK_TEMPLATES.find((t) => t.id === templateId) || BOOK_TEMPLATES[0];
  const preset = getPaperPreset(current.paperPreset);
  const textColor = preset.textColor;
  const mutedColor = preset.mutedColor;

  if (templateId === "blank") {
    return {
      ...current,
      templateId: "blank",
      dbLayout: "full-text",
      elements: [],
    };
  }

  const existingPhotos = current.elements.filter((e) => e.element_type === "photo");
  const existingVideos = current.elements.filter((e) => e.element_type === "video");
  const existingMedia = [...existingPhotos, ...existingVideos];
  const existingTexts = current.elements.filter((e) => e.element_type === "text");

  const titleEl =
    existingTexts.find((t) => t.style.role === "title") || existingTexts[0];
  const dateEl = existingTexts.find((t) => t.style.role === "date");
  const bodyEl =
    existingTexts.find((t) => t.style.role === "body") ||
    (existingTexts.length > 1 ? existingTexts[1] : undefined);

  const titleText = titleEl?.text_content || "Yeni Anımız";
  const dateText =
    dateEl?.text_content ||
    fallbackDate ||
    new Date().toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const bodyText =
    bodyEl?.text_content ||
    "Bu anıyı yazmak için metne çift tıklayın...";

  const media1 = existingMedia[0];
  const media2 = existingMedia[1];
  const video1 = existingVideos[0] || existingMedia[0];

  const makeText = (
    role: "title" | "body" | "date",
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fontSize: number,
    opts?: {
      fontFamily?: TextFontKey;
      fontWeight?: "normal" | "bold";
      color?: string;
      textAlign?: TextAlignValue;
      lineHeight?: number;
    }
  ): CanvasElement =>
    clampCanvasElement({
      id: createLocalElementId(role),
      element_type: "text",
      media_id: null,
      text_content: text,
      position_x: x,
      position_y: y,
      width: w,
      height: h,
      rotation: 0,
      layer_order: 1,
      style: {
        canvasV2: true,
        role,
        fontFamily: opts?.fontFamily || (role === "title" ? "playfair" : "sf-pro"),
        fontSize,
        fontWeight: opts?.fontWeight || (role === "date" ? "bold" : "normal"),
        fontStyle: "normal",
        textDecoration: "none",
        color: opts?.color || (role === "date" ? mutedColor : textColor),
        textAlign: opts?.textAlign || "left",
        lineHeight: opts?.lineHeight || (role === "body" ? 1.6 : 1.25),
      },
    });

  const makeMediaSlot = (
    src: CanvasElement | undefined,
    type: "photo" | "video",
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: {
      frameStyle?: PhotoFrameStyle;
      polaroid?: boolean;
      polaroidCaption?: string;
      rotation?: number;
      placeholderLabel?: string;
    }
  ): CanvasElement =>
    clampCanvasElement({
      id: src?.id || createLocalElementId(type),
      element_type: src?.media_id ? (src.element_type === "video" ? "video" : "photo") : type,
      media_id: src?.media_id || null,
      text_content: "",
      position_x: x,
      position_y: y,
      width: w,
      height: h,
      rotation: opts?.rotation ?? 0,
      layer_order: 1,
      style: {
        canvasV2: true,
        frameStyle: opts?.frameStyle ?? "thin",
        polaroid: opts?.polaroid ?? false,
        polaroidCaption: opts?.polaroidCaption ?? src?.style.polaroidCaption ?? "",
        cropX: src?.style.cropX ?? 50,
        cropY: src?.style.cropY ?? 50,
        cropZoom: src?.style.cropZoom ?? 1,
        aspectRatio: src?.style.aspectRatio,
        placeholderLabel: opts?.placeholderLabel,
      },
    });

  let nextElements: CanvasElement[] = [];

  switch (templateId) {
    case "single-photo":
      nextElements = [
        makeMediaSlot(media1, "photo", 8, 8, 84, 65, {
          frameStyle: "thin",
          placeholderLabel: "Fotoğraf eklemek için tıklayın",
        }),
        makeText("date", dateText, 8, 76, 84, 4.5, 10.5),
        makeText("title", titleText, 8, 81, 84, 9, 20),
      ];
      break;

    case "photo-text":
      nextElements = [
        makeMediaSlot(media1, "photo", 8, 8, 84, 45, {
          frameStyle: "thin",
          placeholderLabel: "Fotoğraf eklemek için tıklayın",
        }),
        makeText("date", dateText, 8, 56, 84, 4.5, 10.5),
        makeText("title", titleText, 8, 61, 84, 9, 21),
        makeText("body", bodyText, 8, 71, 84, 22, 13.5),
      ];
      break;

    case "two-photos":
      nextElements = [
        makeMediaSlot(media1, "photo", 8, 8, 84, 36, {
          frameStyle: "thin",
          placeholderLabel: "1. Fotoğraf",
        }),
        makeMediaSlot(media2, "photo", 8, 47, 84, 34, {
          frameStyle: "thin",
          placeholderLabel: "2. Fotoğraf",
        }),
        makeText("date", dateText, 8, 83, 84, 4.5, 10.5),
        makeText("title", titleText, 8, 87.5, 84, 7.5, 16),
      ];
      break;

    case "polaroid":
      nextElements = [
        makeMediaSlot(media1, "photo", 14, 8, 72, 50, {
          polaroid: true,
          polaroidCaption: dateText,
          frameStyle: "shadow",
          rotation: -1.5,
          placeholderLabel: "Polaroid fotoğraf",
        }),
        makeText("title", titleText, 10, 62, 80, 9, 21, { textAlign: "center" }),
        makeText("body", bodyText, 10, 72, 80, 21, 13.5, { textAlign: "center" }),
      ];
      break;

    case "full-text":
      nextElements = [
        makeText("date", dateText, 10, 11, 80, 4.5, 10.5),
        makeText("title", titleText, 10, 17, 80, 10, 25),
        makeText("body", bodyText, 10, 30, 80, 58, 14, { lineHeight: 1.72 }),
      ];
      break;

    case "video-note":
      nextElements = [
        makeMediaSlot(video1, "video", 8, 9, 84, 42, {
          frameStyle: "rounded",
          placeholderLabel: "Video eklemek için tıklayın",
        }),
        makeText("date", dateText, 8, 55, 84, 4.5, 10.5),
        makeText("title", titleText, 8, 60, 84, 9, 20),
        makeText("body", bodyText, 8, 70, 84, 22, 13.5),
      ];
      break;

    case "minimal-collage":
      nextElements = [
        makeMediaSlot(media1, "photo", 8, 8, 62, 42, {
          frameStyle: "shadow",
          rotation: -1.5,
          placeholderLabel: "Ana fotoğraf",
        }),
        makeMediaSlot(media2, "photo", 34, 41, 58, 34, {
          frameStyle: "thin",
          rotation: 1.5,
          placeholderLabel: "İkinci fotoğraf",
        }),
        makeText("date", dateText, 8, 78, 84, 4.5, 10.5),
        makeText("title", titleText, 8, 82.5, 84, 9, 18),
      ];
      break;
  }

  // Reassign crisp sequential layer_order
  nextElements = nextElements.map((el, idx) => ({
    ...el,
    layer_order: idx + 1,
  }));

  return {
    ...current,
    templateId,
    dbLayout: tplMeta.dbLayout,
    elements: nextElements,
  };
}

/**
 * Create a nicely proportioned photo/video element preserving natural aspect ratio
 * on an A4 vertical page (ratio 210:297).
 */
export function createMediaCanvasElement(
  media: MediaItem,
  existingElements: CanvasElement[]
): CanvasElement {
  const isVideo = media.media_type === "video";
  const naturalRatio =
    media.width && media.height && media.height > 0
      ? media.width / media.height
      : isVideo
      ? 16 / 9
      : 4 / 3;

  // On an A4 page (width/height = 0.707), visual ratio of an element is:
  // (el.width% / el.height%) * A4_PAGE_RATIO = naturalRatio
  // => el.height% = el.width% * A4_PAGE_RATIO / naturalRatio
  let widthPct = isVideo ? 76 : naturalRatio < 0.9 ? 54 : 68;
  let heightPct = (widthPct * A4_PAGE_RATIO) / naturalRatio;

  if (heightPct > 64) {
    heightPct = 64;
    widthPct = (heightPct * naturalRatio) / A4_PAGE_RATIO;
  }
  if (heightPct < 18) {
    heightPct = 18;
    widthPct = Math.min(86, (heightPct * naturalRatio) / A4_PAGE_RATIO);
  }

  // Subtle stagger if multiple elements already exist
  const offset = (existingElements.length % 4) * 3.5;
  const maxLayer = existingElements.reduce(
    (max, e) => Math.max(max, e.layer_order || 0),
    0
  );

  return clampCanvasElement({
    id: createLocalElementId(isVideo ? "video" : "photo"),
    element_type: isVideo ? "video" : "photo",
    media_id: media.id,
    text_content: "",
    position_x: Math.max(6, (100 - widthPct) / 2 + offset - 3),
    position_y: Math.max(8, 14 + offset),
    width: widthPct,
    height: heightPct,
    rotation: 0,
    layer_order: maxLayer + 1,
    style: {
      canvasV2: true,
      frameStyle: isVideo ? "rounded" : "thin",
      polaroid: false,
      polaroidCaption: media.title || "",
      cropX: 50,
      cropY: 50,
      cropZoom: 1,
      aspectRatio: round2(naturalRatio),
    },
  });
}

export function createTextCanvasElement(
  existingElements: CanvasElement[],
  paperPreset: PaperPresetId,
  initialText = "Anınızı buraya yazın..."
): CanvasElement {
  const preset = getPaperPreset(paperPreset);
  const offset = (existingElements.length % 5) * 4;
  const maxLayer = existingElements.reduce(
    (max, e) => Math.max(max, e.layer_order || 0),
    0
  );

  return clampCanvasElement({
    id: createLocalElementId("text"),
    element_type: "text",
    media_id: null,
    text_content: initialText,
    position_x: 10 + (offset % 12),
    position_y: 56 + offset,
    width: 78,
    height: 16,
    rotation: 0,
    layer_order: maxLayer + 1,
    style: {
      canvasV2: true,
      role: "body",
      fontFamily: "sf-pro",
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: preset.textColor,
      textAlign: "left",
      lineHeight: 1.55,
    },
  });
}

/**
 * Extract summary fields for memory_pages (title, content, memory_date)
 * so search_couple_content RPC & legacy exports continue working seamlessly.
 */
export function extractPageSummaryForDb(
  canvas: PageCanvasState,
  fallbackPage: MemoryPage
): {
  title: string;
  content: string;
  memory_date: string;
  layout_type: BookLayoutType;
} {
  const texts = canvas.elements.filter((e) => e.element_type === "text");
  const titleEl =
    texts.find((t) => t.style.role === "title") ||
    texts.find((t) => (t.style.fontSize || 14) >= 18);
  const dateEl = texts.find((t) => t.style.role === "date");
  const bodyEls = texts.filter((t) => t.id !== titleEl?.id && t.id !== dateEl?.id);

  const title = (titleEl?.text_content || "").trim().slice(0, 140) || fallbackPage.title || "";
  const memory_date =
    (dateEl?.text_content || "").trim().slice(0, 60) || fallbackPage.memory_date || "";
  const content = bodyEls
    .map((b) => b.text_content.trim())
    .filter(Boolean)
    .join("\n\n");

  const validLayouts: BookLayoutType[] = [
    "single-photo",
    "two-photos",
    "photo-text",
    "polaroid",
    "full-text",
    "video-note",
    "minimal-collage",
  ];
  const layout_type: BookLayoutType = validLayouts.includes(canvas.dbLayout)
    ? canvas.dbLayout
    : "photo-text";

  return { title, content, memory_date, layout_type };
}

/**
 * Serialize PageCanvasState into memory_page_elements insert rows
 * compatible with existing SQL constraints (ZERO new migrations).
 */
export function serializeCanvasToDbRows(
  canvas: PageCanvasState,
  pageId: string,
  coupleId: string
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [
    {
      page_id: pageId,
      couple_id: coupleId,
      element_type: "caption",
      media_id: null,
      text_content: null,
      position_x: 0,
      position_y: 0,
      width: 1,
      height: 1,
      rotation: 0,
      layer_order: -1,
      style: {
        isPageMeta: true,
        canvasV2: true,
        paperPreset: canvas.paperPreset,
        background: canvas.background,
        templateId: canvas.templateId,
      },
    },
  ];

  canvas.elements.forEach((raw, idx) => {
    const el = clampCanvasElement(raw);
    const cleanStyle: Record<string, string | number | boolean | null> = {
      canvasV2: true,
    };
    for (const [k, v] of Object.entries(el.style || {})) {
      if (v !== undefined) {
        cleanStyle[k] = v as string | number | boolean | null;
      }
    }

    rows.push({
      page_id: pageId,
      couple_id: coupleId,
      element_type: el.element_type,
      media_id:
        el.element_type === "photo" || el.element_type === "video"
          ? el.media_id || null
          : null,
      text_content: el.element_type === "text" ? el.text_content : null,
      position_x: round2(el.position_x),
      position_y: round2(el.position_y),
      width: Math.max(1, round2(el.width)),
      height: Math.max(1, round2(el.height)),
      rotation: round2(el.rotation),
      layer_order: typeof el.layer_order === "number" ? el.layer_order : idx + 1,
      style: cleanStyle,
    });
  });

  return rows;
}
