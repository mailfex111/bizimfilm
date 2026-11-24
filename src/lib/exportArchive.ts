"use client";

import { createClient } from "@/lib/supabase/client";
import { bucketForMediaType, getSignedUrl } from "@/lib/storage";
import { type MediaItem } from "@/types";

/**
 * Exports all couple records from Supabase along with fresh temporary signed download URLs
 * so couples always retain full portability of their memories and media.
 */
export async function exportCoupleDataArchive(coupleId: string): Promise<void> {
  const supabase = createClient();

  const [
    coupleRes,
    booksRes,
    pagesRes,
    elementsRes,
    mediaRes,
    playlistsRes,
    tracksRes,
    datesRes,
    notesRes,
    usageRes,
  ] = await Promise.all([
    supabase
      .from("couples")
      .select("id, couple_name, relationship_start_date, created_at")
      .eq("id", coupleId)
      .single(),
    supabase
      .from("memory_books")
      .select("id, title, description, cover_media_id, created_at, updated_at")
      .eq("couple_id", coupleId),
    supabase
      .from("memory_pages")
      .select("id, book_id, page_order, title, content, memory_date, layout_type, version, created_at, updated_at")
      .eq("couple_id", coupleId)
      .order("page_order", { ascending: true }),
    supabase
      .from("memory_page_elements")
      .select("id, page_id, element_type, media_id, text_content, position_x, position_y, width, height, rotation, layer_order, style")
      .eq("couple_id", coupleId),
    supabase
      .from("media")
      .select("id, media_type, storage_path, thumbnail_path, original_filename, mime_type, file_size, width, height, duration, title, description, memory_date, created_at")
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("playlists")
      .select("id, title, is_default, created_at")
      .eq("couple_id", coupleId),
    supabase
      .from("playlist_tracks")
      .select("id, playlist_id, media_id, track_order, created_at")
      .eq("couple_id", coupleId),
    supabase
      .from("special_dates")
      .select("id, category, title, description, event_date, repeat_yearly, created_at")
      .eq("couple_id", coupleId),
    supabase
      .from("notes")
      .select("id, title, content, note_type, created_at, updated_at")
      .eq("couple_id", coupleId),
    supabase.rpc("get_couple_storage_breakdown"),
  ]);

  const mediaRows = (mediaRes.data || []) as MediaItem[];
  const mediaWithDownloadLinks = await Promise.all(
    mediaRows.map(async (item) => {
      const signedUrl = await getSignedUrl(
        bucketForMediaType(item.media_type),
        item.storage_path
      );
      return {
        ...item,
        temporary_download_url_15m: signedUrl,
      };
    })
  );

  const archive = {
    schemaVersion: 2,
    platform: "Miora",
    exportedAt: new Date().toISOString(),
    notice:
      "Medya dosyalarının geçici indirme bağlantıları güvenlik nedeniyle 15 dakika geçerlidir.",
    couple: coupleRes.data || null,
    storage: Array.isArray(usageRes.data) ? usageRes.data[0] : null,
    memory_books: booksRes.data || [],
    memory_pages: pagesRes.data || [],
    memory_page_elements: elementsRes.data || [],
    media: mediaWithDownloadLinks,
    playlists: playlistsRes.data || [],
    playlist_tracks: tracksRes.data || [],
    special_dates: datesRes.data || [],
    notes: notesRes.data || [],
  };

  const blob = new Blob([JSON.stringify(archive, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `miora-arsiv-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
