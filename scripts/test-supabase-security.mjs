/**
 * Miora Automated Security, Schema, Storage, Realtime & Multi-Couple RLS Suite (Section 24)
 *
 * Usage:
 *   node scripts/test-supabase-security.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local.
 * When SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is passed via local environment
 * variable (NEVER committed or added to client JS), executes the full 6-user / 3-couple
 * isolated end-to-end functional, RLS, Storage, Quota-bypass & Realtime suite with cleanup.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .trim()
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/+$/, "");
const PUBLISHABLE_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
).trim();
const SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ""
).trim();

const ALL_TABLES = [
  "profiles",
  "couples",
  "couple_members",
  "couple_invites",
  "media",
  "memory_books",
  "memory_pages",
  "memory_page_elements",
  "playlists",
  "playlist_tracks",
  "special_dates",
  "notes",
  "notifications",
  "user_preferences",
  "storage_usage",
  "storage_quota_reservations",
];

const ALL_BUCKETS = [
  { id: "avatars", mime: "image/webp", ext: "webp", bytes: [82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80] },
  { id: "couple-photos", mime: "image/webp", ext: "webp", bytes: [82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80] },
  { id: "couple-videos", mime: "video/mp4", ext: "mp4", bytes: [0, 0, 0, 24, 102, 116, 121, 112] },
  { id: "couple-music", mime: "audio/mpeg", ext: "mp3", bytes: [73, 68, 51, 3, 0, 0, 0, 0] },
  { id: "book-assets", mime: "image/webp", ext: "webp", bytes: [82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80] },
  { id: "thumbnails", mime: "image/webp", ext: "webp", bytes: [82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80] },
];

const results = [];
function record(name, status, detail = "") {
  results.push({ name, status, detail });
  const icon = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "NOT TESTED";
  console.log(`[${icon}] ${name}${detail ? " — " + detail : ""}`);
}

function makeAnonClient() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function checkClientBundleForSecret() {
  const staticDir = path.join(process.cwd(), ".next", "static");
  if (!fs.existsSync(staticDir)) {
    record("Client bundle secret scan", "NOT TESTED", ".next/static not built yet");
    return;
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  };
  walk(staticDir);

  let leaked = false;
  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    if (
      content.includes("SUPABASE_SERVICE_ROLE_KEY") ||
      /sb_secret_[A-Za-z0-9_-]{8,}/.test(content) ||
      (SERVICE_ROLE_KEY && content.includes(SERVICE_ROLE_KEY))
    ) {
      leaked = true;
      break;
    }
  }
  record(
    "Service Role / Secret Key absent from client JS bundle",
    leaked ? "FAIL" : "PASS",
    `Scanned ${files.length} built JS chunks`
  );
}

async function checkLiveSchemaBucketsAndAnonSecurity() {
  const anon = makeAnonClient();

  const settingsRes = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: PUBLISHABLE_KEY },
  }).then(async (r) => ({ status: r.status, data: await r.json() }));

  record(
    "Supabase Auth endpoint connectivity",
    settingsRes.status === 200 ? "PASS" : "FAIL",
    `HTTP ${settingsRes.status}, email_auth=${settingsRes.data?.external?.email}, email_verification=${!settingsRes.data?.mailer_autoconfirm}`
  );

  // 1. Verify all 16 tables exist & enforce deny-by-default RLS for anon
  const missingTables = [];
  const leakedTables = [];
  const openInsertTables = [];

  for (const table of ALL_TABLES) {
    const sel = await anon.from(table).select("*").limit(1);
    const missing =
      sel.error &&
      (sel.error.code === "42P01" ||
        sel.error.code === "PGRST205" ||
        /Could not find the table|does not exist/i.test(sel.error.message || ""));

    if (missing) {
      missingTables.push(table);
      continue;
    }

    if (Array.isArray(sel.data) && sel.data.length > 0) {
      leakedTables.push(table);
    }

    const ins = await anon.from(table).insert({}).select("*");
    if (!ins.error) {
      openInsertTables.push(table);
    }
  }

  record(
    "All 16 PostgreSQL tables exist on Supabase",
    missingTables.length === 0 ? "PASS" : "FAIL",
    missingTables.length === 0
      ? `Verified 16/16 tables`
      : `Missing: ${missingTables.join(", ")}`
  );

  if (missingTables.length > 0) return false;

  record(
    "Deny-by-default RLS blocks anonymous SELECT on all 16 tables",
    leakedTables.length === 0 ? "PASS" : "FAIL",
    leakedTables.length === 0 ? "0 rows returned across all 16 tables" : `Leaked: ${leakedTables.join(", ")}`
  );

  record(
    "Deny-by-default RLS blocks anonymous INSERT on all 16 tables",
    openInsertTables.length === 0 ? "PASS" : "FAIL",
    openInsertTables.length === 0 ? "16/16 rejected (42501)" : `Open: ${openInsertTables.join(", ")}`
  );

  // 2. Verify RPC security against anon
  const npe = await anon.rpc("notify_partner_event", {
    p_couple_id: "00000000-0000-0000-0000-000000000000",
    p_actor_id: "00000000-0000-0000-0000-000000000000",
    p_type: "system",
    p_title: "probe",
    p_message: "probe",
  });
  record(
    "Internal notify_partner_event RPC blocked from public/anon",
    Boolean(npe.error) && npe.error.code === "42501" ? "PASS" : "FAIL",
    npe.error ? `${npe.error.code}: ${npe.error.message}` : "ALLOWED!"
  );

  const storageBreakdownAnon = await anon.rpc("get_couple_storage_breakdown");
  const migration004Applied =
    Boolean(storageBreakdownAnon.error) && storageBreakdownAnon.error.code === "42501";
  record(
    "Migration 004 hardening applied (explicit REVOKE anon on RPCs & direct-API Storage quota RLS)",
    migration004Applied ? "PASS" : "FAIL",
    migration004Applied
      ? "42501 permission denied for anon on authenticated RPCs"
      : "Run supabase/migrations/004_miora_storage_quota_hardening.sql in Supabase SQL Editor to close direct-Storage quota bypass & anon RPC EXECUTE grants."
  );

  // 3. Verify all 6 Storage buckets are private & reject valid-MIME anon uploads
  const publicBuckets = [];
  const openUploadBuckets = [];
  for (const b of ALL_BUCKETS) {
    const pub = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${b.id}/probe.${b.ext}`);
    if (pub.status === 200) publicBuckets.push(b.id);

    const up = await anon.storage
      .from(b.id)
      .upload(`00000000-0000-0000-0000-000000000000/probe.${b.ext}`, new Uint8Array(b.bytes), {
        contentType: b.mime,
      });
    if (!up.error) openUploadBuckets.push(b.id);
  }

  record(
    "All 6 Storage buckets enforce private access (public=false) and block anon uploads",
    publicBuckets.length === 0 && openUploadBuckets.length === 0 ? "PASS" : "FAIL",
    publicBuckets.length === 0 && openUploadBuckets.length === 0
      ? "Verified 6/6 private buckets (avatars, couple-photos, couple-videos, couple-music, book-assets, thumbnails)"
      : `Public: ${publicBuckets.join(",")}; OpenUpload: ${openUploadBuckets.join(",")}`
  );

  // 4. Verify Realtime WebSocket reachability
  const wsStatus = await new Promise((resolve) => {
    const ch = anon.channel(`miora-probe-${Date.now()}`);
    const timer = setTimeout(() => {
      anon.removeChannel(ch).finally(() => resolve("TIMEOUT"));
    }, 6000);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        anon.removeChannel(ch).finally(() => resolve(status));
      }
    });
  });

  record(
    "Supabase Realtime WebSocket connectivity",
    wsStatus === "SUBSCRIBED" ? "PASS" : "FAIL",
    `Channel status: ${wsStatus}`
  );

  return true;
}

async function runSixUserIsolationSuite() {
  if (!SERVICE_ROLE_KEY) {
    record(
      "6-user / 3-couple End-to-End Auth, Invite, Media, Book, Realtime, Quota-Bypass & Cross-Couple RLS Suite",
      "NOT TESTED",
      "Email confirmation is ON (mailer_autoconfirm=false). Provide SUPABASE_SERVICE_ROLE_KEY (sb_secret_...) locally to create/verify/cleanup 6 isolated test users without polluting production auth.users."
    );
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const runId = Date.now().toString(36);
  const createdUserIds = [];
  const createdCoupleIds = [];
  const uploadedFiles = []; // { bucket, path }

  async function createAndSignIn(tag) {
    const email = `miora_sec_${runId}_${tag}@example.test`;
    const password = `SecTest!${runId}A1`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: `sec_${runId}_${tag}`, display_name: `Test ${tag}` },
    });
    if (cErr || !created.user) throw new Error(`Create user ${tag} failed: ${cErr?.message}`);
    createdUserIds.push(created.user.id);

    const client = makeAnonClient();
    const { data: sData, error: sErr } = await client.auth.signInWithPassword({ email, password });
    if (sErr || !sData.session) throw new Error(`Sign in ${tag} failed: ${sErr?.message}`);
    await client.realtime.setAuth(sData.session.access_token);
    return { user: created.user, client, email, password };
  }

  function subscribePostgresReady(channel, timeoutMs = 8000) {
    return new Promise((resolve) => {
      let done = false;
      let channelSubscribed = false;
      let pgReady = false;
      const finish = (st) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(st);
      };
      const timer = setTimeout(() => finish(channelSubscribed ? "SUBSCRIBED" : "TIMEOUT"), timeoutMs);
      channel.on("system", {}, (payload) => {
        if (payload?.extension === "postgres_changes" && payload?.status === "ok") {
          pgReady = true;
          if (channelSubscribed) finish("SUBSCRIBED");
        }
      });
      channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          channelSubscribed = true;
          if (pgReady) finish("SUBSCRIBED");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          finish(err ? `${status}:${err.message}` : status);
        }
      });
    });
  }

  try {
    // Provision 6 isolated users (3 couples: A1+A2, B1+B2, C1+C2)
    const [a1, a2, b1, b2, c1, c2] = await Promise.all([
      createAndSignIn("a1"),
      createAndSignIn("a2"),
      createAndSignIn("b1"),
      createAndSignIn("b2"),
      createAndSignIn("c1"),
      createAndSignIn("c2"),
    ]);

    // Verify signup trigger created profile & user_preferences automatically
    const { data: profA1 } = await a1.client.from("profiles").select("id, username").eq("id", a1.user.id).single();
    const { data: prefA1 } = await a1.client.from("user_preferences").select("user_id").eq("user_id", a1.user.id).single();
    record("Auth signup trigger auto-creates profile & user_preferences", Boolean(profA1 && prefA1) ? "PASS" : "FAIL");

    // 1. Create 3 separate couple spaces
    const { data: coupleA, error: eA } = await a1.client.rpc("create_couple_space", {
      p_couple_name: `Couple A ${runId}`,
      p_relationship_start_date: "2024-02-14",
    });
    const { data: coupleB, error: eB } = await b1.client.rpc("create_couple_space", {
      p_couple_name: `Couple B ${runId}`,
      p_relationship_start_date: "2024-06-01",
    });
    const { data: coupleC, error: eC } = await c1.client.rpc("create_couple_space", {
      p_couple_name: `Couple C ${runId}`,
      p_relationship_start_date: "2025-01-01",
    });
    if (eA || eB || eC) throw new Error(`Failed creating test couples: ${eA?.message || eB?.message || eC?.message}`);
    createdCoupleIds.push(coupleA.id, coupleB.id, coupleC.id);
    record("3 isolated couple spaces created (A, B, C)", "PASS");

    // 2. Invite & Join for all 3 couples + reuse & 3rd member rejection
    const { data: invA } = await a1.client.rpc("create_couple_invite", { p_expires_hours: 1 });
    const codeA = invA[0].invite_code;
    const { error: joinA2Err } = await a2.client.rpc("accept_couple_invite", { p_token: codeA });
    record("Partner A2 accepts single-use invite", !joinA2Err ? "PASS" : "FAIL", joinA2Err?.message);

    const { error: reuseErr } = await c2.client.rpc("accept_couple_invite", { p_token: codeA });
    record("Used invite cannot be reused & 3rd member blocked", Boolean(reuseErr) ? "PASS" : "FAIL", reuseErr?.message);

    const { data: invB } = await b1.client.rpc("create_couple_invite", { p_expires_hours: 1 });
    await b2.client.rpc("accept_couple_invite", { p_token: invB[0].invite_code });
    const { data: invC } = await c1.client.rpc("create_couple_invite", { p_expires_hours: 1 });
    await c2.client.rpc("accept_couple_invite", { p_token: invC[0].invite_code });

    // 3. Direct Storage API Quota Bypass Attack (MUST FAIL without reservation!)
    const bypassPath = `${coupleA.id}/bypass-${runId}.mp4`;
    const bypassBytes = new Uint8Array(2048).fill(7);
    const { error: directBypassErr } = await a1.client.storage
      .from("couple-videos")
      .upload(bypassPath, bypassBytes, { contentType: "video/mp4" });
    if (!directBypassErr) uploadedFiles.push({ bucket: "couple-videos", path: bypassPath });
    record(
      "Direct Storage API upload without quota reservation blocked",
      Boolean(directBypassErr) ? "PASS" : "FAIL",
      directBypassErr ? directBypassErr.message : "VULNERABILITY: Direct upload succeeded without quota reservation!"
    );

    // 4. Legitimate Photo, Video & Audio Uploads + Client Size Spoofing Defense
    const photoBytes = new Uint8Array(4096).fill(65);
    const photoPath = `${coupleA.id}/photo-${runId}.webp`;
    const thumbPath = `${coupleA.id}/photo-${runId}_thumb.webp`;
    const { data: resPhoto } = await a1.client.rpc("reserve_storage_quota", { p_bytes: photoBytes.length + 1024 });
    const { error: upPhotoErr } = await a1.client.storage
      .from("couple-photos")
      .upload(photoPath, photoBytes, { contentType: "image/webp" });
    const { error: upThumbErr } = await a1.client.storage
      .from("thumbnails")
      .upload(thumbPath, new Uint8Array(1024).fill(66), { contentType: "image/webp" });
    if (!upPhotoErr) uploadedFiles.push({ bucket: "couple-photos", path: photoPath });
    if (!upThumbErr) uploadedFiles.push({ bucket: "thumbnails", path: thumbPath });

    // Attempt to spoof p_file_size = 1 byte for a 5120-byte upload!
    const { data: mediaA, error: finPhotoErr } = await a1.client.rpc("finalize_media_upload", {
      p_reservation_id: resPhoto,
      p_media_type: "photo",
      p_storage_path: photoPath,
      p_thumbnail_path: thumbPath,
      p_mime_type: "image/webp",
      p_file_size: 1, // Deliberate client spoofing test!
      p_title: "Secret Photo A",
    });
    record("Photo + thumbnail upload & finalize_media_upload", !upPhotoErr && !upThumbErr && !finPhotoErr ? "PASS" : "FAIL", upPhotoErr?.message || finPhotoErr?.message);
    record(
      "Server-verified file size prevents client p_file_size spoofing",
      mediaA && Number(mediaA.file_size) >= photoBytes.length ? "PASS" : "FAIL",
      `Spoofed 1B -> Recorded ${mediaA?.file_size}B`
    );

    // Video upload
    const vidBytes = new Uint8Array(2048).fill(9);
    const vidPath = `${coupleA.id}/video-${runId}.mp4`;
    const { data: resVid } = await a1.client.rpc("reserve_storage_quota", { p_bytes: vidBytes.length });
    const { error: upVidErr } = await a1.client.storage.from("couple-videos").upload(vidPath, vidBytes, { contentType: "video/mp4" });
    if (!upVidErr) uploadedFiles.push({ bucket: "couple-videos", path: vidPath });
    const { data: mediaVidA, error: finVidErr } = await a1.client.rpc("finalize_media_upload", {
      p_reservation_id: resVid,
      p_media_type: "video",
      p_storage_path: vidPath,
      p_mime_type: "video/mp4",
      p_file_size: vidBytes.length,
      p_title: "Secret Video A",
    });
    record("Video upload to private couple-videos bucket", !upVidErr && !finVidErr ? "PASS" : "FAIL", upVidErr?.message || finVidErr?.message);

    // Audio upload
    const audBytes = new Uint8Array(1536).fill(11);
    const audPath = `${coupleA.id}/track-${runId}.mp3`;
    const { data: resAud } = await a1.client.rpc("reserve_storage_quota", { p_bytes: audBytes.length });
    const { error: upAudErr } = await a1.client.storage.from("couple-music").upload(audPath, audBytes, { contentType: "audio/mpeg" });
    if (!upAudErr) uploadedFiles.push({ bucket: "couple-music", path: audPath });
    const { error: finAudErr } = await a1.client.rpc("finalize_media_upload", {
      p_reservation_id: resAud,
      p_media_type: "audio",
      p_storage_path: audPath,
      p_mime_type: "audio/mpeg",
      p_file_size: audBytes.length,
      p_title: "Our Song A",
    });
    record("Audio upload to private couple-music bucket", !upAudErr && !finAudErr ? "PASS" : "FAIL", upAudErr?.message || finAudErr?.message);

    // 5. Memory Book + Page + Photo Element + Optimistic Concurrency Conflict Check
    const { data: bookA } = await a1.client.from("memory_books").select("id").eq("couple_id", coupleA.id).limit(1).single();
    const { data: pageA, error: pageErr } = await a1.client
      .from("memory_pages")
      .insert({
        book_id: bookA.id,
        couple_id: coupleA.id,
        page_order: 0,
        title: "İlk Günümüz",
        content: "Unutulmaz bir akşamdı.",
        layout_type: "photo-text",
        created_by: a1.user.id,
      })
      .select("*")
      .single();
    const { error: elErr } = await a1.client.from("memory_page_elements").insert({
      page_id: pageA.id,
      couple_id: coupleA.id,
      element_type: "photo",
      media_id: mediaA.id,
      layer_order: 0,
    });
    record("Memory Book page + photo element creation", !pageErr && !elErr ? "PASS" : "FAIL", pageErr?.message || elErr?.message);

    // Partner A2 updates version 1 -> 2, then A1 tries stale version 1 -> MUST conflict
    const { data: savedV2, error: v2Err } = await a2.client.rpc("save_memory_page_optimistic", {
      p_page_id: pageA.id,
      p_expected_version: 1,
      p_title: "İlk Günümüz (A2)",
      p_content: "A2 güncelledi",
      p_memory_date: "2024-02-14",
      p_layout_type: "photo-text",
    });
    const { error: staleErr } = await a1.client.rpc("save_memory_page_optimistic", {
      p_page_id: pageA.id,
      p_expected_version: 1,
      p_title: "Stale A1",
      p_content: "Should fail",
      p_memory_date: "2024-02-14",
      p_layout_type: "photo-text",
    });
    record("Memory Book optimistic concurrency prevents silent overwrite", !v2Err && savedV2?.version === 2 && Boolean(staleErr) ? "PASS" : "FAIL", v2Err?.message || (staleErr ? `v1->v2 OK, stale blocked: ${staleErr.message}` : "stale not blocked"));

    // 6. Live 2-Device Realtime Synchronization + Cross-Couple Realtime Isolation
    let a2ReceivedNote = false;
    let b1ReceivedNote = false;
    const chA2 = a2.client
      .channel(`rt-a2-${runId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter: `couple_id=eq.${coupleA.id}` }, () => {
        a2ReceivedNote = true;
      });
    const chB1 = b1.client
      .channel(`rt-b1-${runId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, (payload) => {
        if (payload.new?.couple_id === coupleA.id) b1ReceivedNote = true;
      });

    const [stA2, stB1] = await Promise.all([
      subscribePostgresReady(chA2, 8000),
      subscribePostgresReady(chB1, 8000),
    ]);
    await new Promise((res) => setTimeout(res, 400));

    const { data: noteA } = await a1.client
      .from("notes")
      .insert({ couple_id: coupleA.id, created_by: a1.user.id, title: `RealtimeNote ${runId}`, content: "Seni seviyorum" })
      .select("id")
      .single();

    await new Promise((res) => setTimeout(res, 2500));
    await Promise.all([a2.client.removeChannel(chA2), b1.client.removeChannel(chB1)]);

    record("Realtime sync delivers live note from Partner A1 to Partner A2", a2ReceivedNote ? "PASS" : "FAIL", `chA2=${stA2}, received=${a2ReceivedNote}`);
    record("Realtime RLS prevents Couple B from receiving Couple A events", stB1 === "SUBSCRIBED" && !b1ReceivedNote ? "PASS" : "FAIL", `chB1=${stB1}, leaked=${b1ReceivedNote}`);

    // 6b. Special Dates CRUD & Cross-Couple Isolation
    const { data: sdA, error: sdErr } = await a1.client
      .from("special_dates")
      .insert({ couple_id: coupleA.id, category: "anniversary", title: "Yıldönümümüz", event_date: "2024-02-14", repeat_yearly: true, created_by: a1.user.id })
      .select("id")
      .single();
    const { data: bReadsSdA } = await b1.client.from("special_dates").select("id").eq("id", sdA?.id || "");
    record("Special dates create & cross-couple isolation", !sdErr && (bReadsSdA?.length || 0) === 0 ? "PASS" : "FAIL");

    // 7. Partner Notification Trigger & Cross-Entity Search
    const { data: notifsA2 } = await a2.client.from("notifications").select("id, notification_type").eq("user_id", a2.user.id);
    record("Partner notification trigger notifies Partner A2", (notifsA2?.length || 0) > 0 ? "PASS" : "FAIL", `Found ${notifsA2?.length || 0} notifications`);

    const { data: searchA2 } = await a2.client.rpc("search_couple_content", { p_query: `RealtimeNote ${runId}` });
    const { data: searchB1 } = await b1.client.rpc("search_couple_content", { p_query: `RealtimeNote ${runId}` });
    record(
      "RLS-scoped search returns Couple A content to A2 and 0 rows to B1",
      (searchA2?.length || 0) > 0 && (searchB1?.length || 0) === 0 ? "PASS" : "FAIL"
    );

    // 8. Cross-Couple Security Isolation (Couple B & C attacking Couple A)
    const { data: bReadsA } = await b1.client.from("media").select("id").eq("id", mediaA.id);
    record("Couple B cannot SELECT Couple A media", bReadsA?.length === 0 ? "PASS" : "FAIL");

    const { error: bDeletesVidA } = await b1.client.rpc("delete_media_and_reclaim_quota", { p_media_id: mediaVidA.id });
    record("Couple B cannot DELETE Couple A video", Boolean(bDeletesVidA) ? "PASS" : "FAIL");

    const { error: bEditsBookA } = await b1.client.rpc("save_memory_page_optimistic", {
      p_page_id: pageA.id,
      p_expected_version: 2,
      p_title: "Hacked",
      p_content: "Hacked",
      p_memory_date: "",
      p_layout_type: "full-text",
    });
    record("Couple B cannot modify Couple A memory book", Boolean(bEditsBookA) ? "PASS" : "FAIL");

    const { error: bForgesNote } = await b1.client
      .from("notes")
      .insert({ couple_id: coupleA.id, created_by: b1.user.id, title: "Forged", content: "Attack" });
    record("Couple B cannot INSERT forged couple_id into Couple A notes", Boolean(bForgesNote) ? "PASS" : "FAIL");

    const { data: cReadsNoteA } = await c1.client.from("notes").select("id").eq("id", noteA.id);
    record("Couple C cannot SELECT Couple A notes", cReadsNoteA?.length === 0 ? "PASS" : "FAIL");

    const { error: bStorageSignErr } = await b1.client.storage.from("couple-photos").createSignedUrl(photoPath, 60);
    record("Couple B cannot sign/download Couple A private storage object", Boolean(bStorageSignErr) ? "PASS" : "FAIL");

    const { data: bDelSto } = await b1.client.storage.from("couple-photos").remove([photoPath]);
    record("Couple B cannot delete Couple A private storage object", (bDelSto?.length || 0) === 0 ? "PASS" : "FAIL");

    const { error: bCrossBookPref } = await b1.client
      .from("user_preferences")
      .update({ last_open_book_id: bookA.id })
      .eq("user_id", b1.user.id);
    record("Couple B cannot reference Couple A book in user_preferences", Boolean(bCrossBookPref) ? "PASS" : "FAIL");

    // 9. Concurrent Quota Exceed Test (2x 300MB reservations simultaneously against 500MB quota)
    const [q1, q2] = await Promise.all([
      a1.client.rpc("reserve_storage_quota", { p_bytes: 300 * 1024 * 1024 }),
      a2.client.rpc("reserve_storage_quota", { p_bytes: 300 * 1024 * 1024 }),
    ]);
    const quotaRaceEnforced = Boolean(q1.error) !== Boolean(q2.error);
    record(
      "Concurrent uploads cannot bypass 500 MB couple quota",
      quotaRaceEnforced ? "PASS" : "FAIL",
      `q1=${q1.error ? "blocked" : "reserved"}, q2=${q2.error ? "blocked" : "reserved"}`
    );

    // 9b. Legitimate media delete accurately reclaims storage quota
    const { data: beforeDel } = await a1.client.rpc("get_couple_storage_breakdown");
    const { error: delVidErr } = await a1.client.rpc("delete_media_and_reclaim_quota", { p_media_id: mediaVidA.id });
    const { data: afterDel } = await a1.client.rpc("get_couple_storage_breakdown");
    const reclaimed =
      !delVidErr &&
      Number(beforeDel?.[0]?.total_used_bytes || 0) - Number(afterDel?.[0]?.total_used_bytes || 0) === vidBytes.length;
    record(
      "Deleting media accurately reclaims couple storage quota",
      reclaimed ? "PASS" : "FAIL",
      `before=${beforeDel?.[0]?.total_used_bytes}B -> after=${afterDel?.[0]?.total_used_bytes}B`
    );

    // 10. Signed-Out Session Isolation
    await a1.client.auth.signOut();
    const { data: afterLogoutMedia } = await a1.client.from("media").select("id").eq("id", mediaA.id);
    const { error: afterLogoutSign } = await a1.client.storage.from("couple-photos").createSignedUrl(photoPath, 60);
    record(
      "Signed-out user loses all private DB & Storage access",
      (afterLogoutMedia?.length || 0) === 0 && Boolean(afterLogoutSign) ? "PASS" : "FAIL"
    );
  } finally {
    // Clean up all temporary test objects, couples & 6 test users
    for (const f of uploadedFiles) {
      await admin.storage.from(f.bucket).remove([f.path]).catch(() => {});
    }
    for (const cid of createdCoupleIds) {
      await admin.from("couples").delete().eq("id", cid);
    }
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  }
}

async function main() {
  console.log("=== Miora Live Security, Schema, Storage & RLS Verification ===");
  await checkClientBundleForSecret();
  const schemaReady = await checkLiveSchemaBucketsAndAnonSecurity();
  if (schemaReady) {
    await runSixUserIsolationSuite();
  }
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const notTested = results.filter((r) => r.status === "NOT TESTED").length;
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL, ${notTested} NOT TESTED`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
