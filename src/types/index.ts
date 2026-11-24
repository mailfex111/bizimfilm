export type NavTab =
  | "ana-sayfa"
  | "ani-kitabi"
  | "fotograflar"
  | "videolar"
  | "muzik"
  | "ozel-gunler"
  | "notlar"
  | "biz";

export type MediaType = "photo" | "video" | "audio" | "book_asset";

export type BookLayoutType =
  | "single-photo"
  | "two-photos"
  | "photo-text"
  | "polaroid"
  | "full-text"
  | "video-note"
  | "minimal-collage";

export type SpecialDateCategory =
  | "met"
  | "dating"
  | "anniversary"
  | "birthday"
  | "wedding"
  | "custom";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Couple {
  id: string;
  couple_name: string;
  relationship_start_date: string | null;
  cover_image_path: string | null;
  default_track_media_id: string | null;
  realtime_channel_epoch?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoupleMember {
  id: string;
  couple_id: string;
  user_id: string;
  role: "owner" | "partner";
  joined_at: string;
  profile?: Profile | null;
}

export interface CoupleInvite {
  id: string;
  couple_id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MediaItem {
  id: string;
  couple_id: string;
  uploaded_by: string | null;
  media_type: MediaType;
  storage_path: string;
  thumbnail_path: string | null;
  original_filename: string | null;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  title: string | null;
  description: string | null;
  memory_date: string | null;
  dedup_hash?: string | null;
  created_at: string;
}

export interface MemoryBook {
  id: string;
  couple_id: string;
  title: string;
  description: string | null;
  cover_media_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryPageElement {
  id: string;
  page_id: string;
  couple_id: string;
  element_type: "photo" | "video" | "text" | "caption";
  media_id: string | null;
  text_content: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rotation: number;
  layer_order: number;
  style: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
}

export interface MemoryPage {
  id: string;
  book_id: string;
  couple_id: string;
  page_order: number;
  title: string;
  content: string;
  memory_date: string;
  layout_type: BookLayoutType;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  elements?: MemoryPageElement[];
}

export interface Playlist {
  id: string;
  couple_id: string;
  title: string;
  is_default: boolean;
  created_at: string;
}

export interface PlaylistTrack {
  id: string;
  playlist_id: string;
  couple_id: string;
  media_id: string;
  track_order: number;
  created_at: string;
  media?: MediaItem;
}

export interface SpecialDateItem {
  id: string;
  couple_id: string;
  category: SpecialDateCategory;
  title: string;
  description: string;
  event_date: string;
  repeat_yearly: boolean;
  created_by: string | null;
  created_at: string;
}

export interface NoteItem {
  id: string;
  couple_id: string;
  created_by: string | null;
  title: string;
  content: string;
  note_type: "note" | "letter";
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  couple_id: string | null;
  user_id: string;
  notification_type:
    | "invite_accepted"
    | "photo_added"
    | "video_added"
    | "audio_added"
    | "book_updated"
    | "note_added"
    | "system";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  autoplay_music: boolean;
  music_volume: number;
  theme: string;
  notification_preferences: {
    partner_uploads: boolean;
    book_updates: boolean;
    notes: boolean;
    invites: boolean;
  };
  last_open_book_id: string | null;
  last_open_page_order: number;
  updated_at: string;
}

export interface StorageBreakdown {
  photos_bytes: number;
  videos_bytes: number;
  audio_bytes: number;
  assets_bytes: number;
  total_used_bytes: number;
  quota_bytes: number;
}

export interface SearchResultItem {
  item_type: "photo" | "video" | "audio" | "book_page" | "note";
  item_id: string;
  title: string;
  subtitle: string;
  item_date: string;
}
