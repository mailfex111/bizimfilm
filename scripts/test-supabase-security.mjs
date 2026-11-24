/**
 * Miora Automated Security & Multi-Couple RLS Verification Suite (Section 24)
 *
 * Usage:
 *   node scripts/test-supabase-security.mjs
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   Optional (for full 3-couple / 6-user automated end-to-end test with cleanup):
 *   SUPABASE_SERVICE_ROLE_KEY (never committed, passed via local env only)
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
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const results = [];
function record(name, status, detail = "") {
  results.push({ name, status, detail });
  const icon = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "SKIP";
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
      (SERVICE_ROLE_KEY && content.includes(SERVICE_ROLE_KEY))
    ) {
      leaked = true;
      break;
    }
  }
  record(
    "Service Role Key absent from client JS bundle",
    leaked ? "FAIL" : "PASS",
    `Scanned ${files.length} built JS chunks`
  );
}

async function checkAnonymousAccessBlocked() {
  const anon = makeAnonClient();

  const { data: settingsRes } = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: PUBLISHABLE_KEY },
  }).then(async (r) => ({ status: r.status, data: await r.json() }));

  record(
    "Supabase Auth endpoint connectivity",
    settingsRes ? "PASS" : "FAIL",
    `email_auth=${settingsRes?.external?.email}, email_verification=${!settingsRes?.mailer_autoconfirm}`
  );

  // Check if core tables exist & block unauthenticated reads
  const { data: mediaData, error: mediaErr } = await anon
    .from("media")
    .select("id")
    .limit(5);

  if (
    mediaErr &&
    (mediaErr.code === "42P01" ||
      mediaErr.message?.includes("does not exist") ||
      mediaErr.message?.includes("Could not find the table"))
  ) {
    record(
      "Database schema applied on Supabase",
      "FAIL",
      "Tables do not exist yet — run supabase/MIGRATION_ALL_IN_ONE.sql in Supabase SQL Editor first."
    );
    return false;
  }

  record("Database schema applied on Supabase", "PASS", "public.media table reachable");

  const anonBlocked =
    Boolean(mediaErr) || (Array.isArray(mediaData) && mediaData.length === 0);
  record(
    "Signed-out anonymous access cannot read private media",
    anonBlocked ? "PASS" : "FAIL",
    mediaErr ? mediaErr.message : `Returned ${mediaData?.length ?? 0} rows`
  );
  return true;
}

async function runSixUserIsolationSuite() {
  if (!SERVICE_ROLE_KEY) {
    record(
      "6-user / 3-couple cross-couple RLS, Storage & Invite Race Suite",
      "NOT TESTED",
      "Requires SUPABASE_SERVICE_ROLE_KEY locally to provision & clean up 6 isolated test users."
    );
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const runId = Date.now().toString(36);
  const createdUserIds = [];
  const createdCoupleIds = [];

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
    const { error: sErr } = await client.auth.signInWithPassword({ email, password });
    if (sErr) throw new Error(`Sign in ${tag} failed: ${sErr.message}`);
    return { user: created.user, client };
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

    // 1. Create 3 separate couples
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
    if (eA || eB || eC) throw new Error("Failed creating test couples");
    createdCoupleIds.push(coupleA.id, coupleB.id, coupleC.id);

    // 2. Invite & Join for all 3 couples + 3rd user & reuse rejection
    const { data: invA } = await a1.client.rpc("create_couple_invite", { p_expires_hours: 1 });
    const codeA = invA[0].invite_code;
    const { error: joinA2Err } = await a2.client.rpc("accept_couple_invite", { p_token: codeA });
    record("Partner A2 accepts single-use invite", !joinA2Err ? "PASS" : "FAIL", joinA2Err?.message);

    // Reuse same invite by C2 must FAIL
    const { error: reuseErr } = await c2.client.rpc("accept_couple_invite", { p_token: codeA });
    record("Used invite cannot be reused / 3rd member blocked", Boolean(reuseErr) ? "PASS" : "FAIL", reuseErr?.message);

    const { data: invB } = await b1.client.rpc("create_couple_invite", { p_expires_hours: 1 });
    await b2.client.rpc("accept_couple_invite", { p_token: invB[0].invite_code });

    const { data: invC } = await c1.client.rpc("create_couple_invite", { p_expires_hours: 1 });
    await c2.client.rpc("accept_couple_invite", { p_token: invC[0].invite_code });

    // 3. Couple A uploads private photo & creates note + book page
    const dummyBytes = new Uint8Array([82, 73, 70, 70, 24, 0, 0, 0, 87, 69, 66, 80]);
    const pathA = `${coupleA.id}/sec-test-${runId}.webp`;
    const { data: resId } = await a1.client.rpc("reserve_storage_quota", { p_bytes: dummyBytes.length });
    const { error: upErr } = await a1.client.storage
      .from("couple-photos")
      .upload(pathA, dummyBytes, { contentType: "image/webp" });
    const { data: mediaA, error: finErr } = await a1.client.rpc("finalize_media_upload", {
      p_reservation_id: resId,
      p_media_type: "photo",
      p_storage_path: pathA,
      p_mime_type: "image/webp",
      p_file_size: dummyBytes.length,
      p_title: "Secret Photo A",
    });
    record("Couple A quota-reserved photo upload", !upErr && !finErr ? "PASS" : "FAIL", upErr?.message || finErr?.message);

    const { data: noteA } = await a1.client
      .from("notes")
      .insert({ couple_id: coupleA.id, created_by: a1.user.id, title: "Secret Note A", content: "Private" })
      .select("id")
      .single();

    // 4. Cross-Couple Isolation: Couple B tries to read/mutate Couple A's media, notes, and storage
    const { data: bReadsA } = await b1.client.from("media").select("id").eq("id", mediaA.id);
    record("Couple B cannot SELECT Couple A media", bReadsA?.length === 0 ? "PASS" : "FAIL");

    const { error: bDeletesA } = await b1.client.rpc("delete_media_and_reclaim_quota", { p_media_id: mediaA.id });
    record("Couple B cannot DELETE Couple A media", Boolean(bDeletesA) ? "PASS" : "FAIL");

    const { error: bForgesNote } = await b1.client
      .from("notes")
      .insert({ couple_id: coupleA.id, created_by: b1.user.id, title: "Forged", content: "Attack" });
    record("Couple B cannot INSERT forged couple_id into Couple A notes", Boolean(bForgesNote) ? "PASS" : "FAIL");

    const { data: bReadsNoteA } = await b1.client.from("notes").select("id").eq("id", noteA.id);
    record("Couple B cannot SELECT Couple A notes", bReadsNoteA?.length === 0 ? "PASS" : "FAIL");

    const { error: bStorageErr } = await b1.client.storage
      .from("couple-photos")
      .createSignedUrl(pathA, 60);
    record("Couple B cannot sign/download Couple A private storage object", Boolean(bStorageErr) ? "PASS" : "FAIL");

    // 5. Concurrent Quota Exceed Test (2x 300MB reservations simultaneously against 500MB quota)
    const [q1, q2] = await Promise.all([
      a1.client.rpc("reserve_storage_quota", { p_bytes: 300 * 1024 * 1024 }),
      a2.client.rpc("reserve_storage_quota", { p_bytes: 300 * 1024 * 1024 }),
    ]);
    const quotaRejected = Boolean(q1.error) !== Boolean(q2.error);
    record(
      "Concurrent uploads cannot bypass 500 MB couple quota",
      quotaRejected ? "PASS" : "FAIL",
      `q1=${q1.error ? "blocked" : "reserved"}, q2=${q2.error ? "blocked" : "reserved"}`
    );

    // Cleanup uploaded test storage file
    await admin.storage.from("couple-photos").remove([pathA]);
  } finally {
    // Cleanup temporary test couples & users
    for (const cid of createdCoupleIds) {
      await admin.from("couples").delete().eq("id", cid);
    }
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  }
}

async function main() {
  console.log("=== Miora Security & RLS Verification ===");
  await checkClientBundleForSecret();
  const schemaReady = await checkAnonymousAccessBlocked();
  if (schemaReady) {
    await runSixUserIsolationSuite();
  }
  const fails = results.filter((r) => r.status === "FAIL");
  console.log(`\nSummary: ${results.filter((r) => r.status === "PASS").length} PASS, ${fails.length} FAIL, ${results.filter((r) => r.status === "NOT TESTED").length} NOT TESTED`);
  if (fails.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
