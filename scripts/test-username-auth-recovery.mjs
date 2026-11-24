/**
 * Miora Username-First Auth & Single-Use Recovery Codes Security Suite
 *
 * Tests against a target URL (default: http://localhost:3097 or LIVE_URL env):
 * 1. Signup (displayName, username, password, confirmPassword) -> 201 + 6 codes + internal @users.miora.invalid
 * 2. Case-insensitive duplicate username blocked (409) & password mismatch blocked (400)
 * 3. Recovery codes stored ONLY as salted SHA-256 hashes (never plaintext)
 * 4. Unauthorized access: anon & authenticated owner CANNOT access public.account_recovery_codes directly (42501)
 * 5. Username + password login (200) & wrong password blocked (401)
 * 6. Forged recovery code blocked (401)
 * 7. Valid single-use recovery code resets password (200), blocks old password (401), enables new password (200)
 * 8. Reusing consumed recovery code blocked (401)
 * 9. Unauthenticated /api/account/recovery-codes blocked (401)
 * 10. Authenticated GET count & POST regeneration revokes old unused codes and generates 6 fresh codes
 * 11. Complete isolated cleanup (0 temporary test users remaining)
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const EXTERNAL_URL = (process.env.TARGET_URL || "").trim();
const PORT = 3097;
const BASE_URL = EXTERNAL_URL || `http://localhost:${PORT}`;

const results = [];
function rec(name, status, detail = "") {
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? " — " + detail : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractCookieHeader(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function run() {
  let server = null;
  if (!EXTERNAL_URL) {
    const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
    server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    await sleep(3000);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = Date.now().toString(36);
  const username = `usr_${runId}`;
  const pass1 = `MioraPass1!${runId}`;
  const pass2 = `MioraPass2!${runId}`;
  const createdUserIds = [];

  try {
    // 0. Check public.account_recovery_codes exists and blocks anon directly
    const anonCheck = await anon.from("account_recovery_codes").select("*").limit(1);
    const tableMissing =
      anonCheck.error &&
      (anonCheck.error.code === "42P01" ||
        anonCheck.error.code === "PGRST205" ||
        /Could not find the table|does not exist/i.test(anonCheck.error.message || ""));
    if (tableMissing) {
      rec("Migration 009 (account_recovery_codes) applied", "FAIL", "Run 009_miora_recovery_codes.sql in Supabase SQL Editor first");
      return;
    }
    rec(
      "Direct anon access to account_recovery_codes blocked",
      Boolean(anonCheck.error) || (anonCheck.data?.length || 0) === 0 ? "PASS" : "FAIL",
      anonCheck.error?.code || "0 rows"
    );

    // 1. Password mismatch rejected (400)
    const badSignup = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Test Kullanici",
        username,
        password: pass1,
        confirmPassword: "DifferentPassword!",
      }),
    });
    rec("Signup rejects mismatched password confirmation (400)", badSignup.status === 400 ? "PASS" : "FAIL", `HTTP ${badSignup.status}`);

    // 2. Valid username-only signup (no email, no phone, no SMS!)
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Deniz Yılmaz",
        username,
        password: pass1,
        confirmPassword: pass1,
      }),
    });
    const signupJson = await signupRes.json();
    const sessionCookies = extractCookieHeader(signupRes);
    rec(
      "Username-only signup succeeds immediately with 6 recovery codes & SSR cookies",
      signupRes.status === 201 && signupJson.ok && signupJson.recoveryCodes?.length === 6 && sessionCookies.length > 0 ? "PASS" : "FAIL",
      `HTTP ${signupRes.status}, codes=${signupJson.recoveryCodes?.length || 0}`
    );

    const { data: prof } = await admin.from("profiles").select("id, username, display_name").ilike("username", username).single();
    if (prof?.id) createdUserIds.push(prof.id);
    const { data: authUser } = await admin.auth.admin.getUserById(prof.id);
    rec(
      "Internal synthetic email (@users.miora.invalid) created & auto-confirmed",
      Boolean(authUser?.user?.email?.endsWith("@users.miora.invalid")) && Boolean(authUser?.user?.email_confirmed_at) ? "PASS" : "FAIL",
      `emailDomain=${authUser?.user?.email?.split("@")[1]}`
    );

    // 3. Duplicate username (case-insensitive) blocked with 409
    const dupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Another Person",
        username: username.toUpperCase(),
        password: pass1,
        confirmPassword: pass1,
      }),
    });
    rec("Duplicate username (case-insensitive) blocked at DB level (409)", dupRes.status === 409 ? "PASS" : "FAIL", `HTTP ${dupRes.status}`);

    // 4. Recovery codes stored ONLY as salted hashes (never plaintext!)
    const { data: storedRows } = await admin.from("account_recovery_codes").select("id, code_salt, code_hash, used_at").eq("user_id", prof.id);
    const anyPlaintext = (storedRows || []).some((r) =>
      signupJson.recoveryCodes.some((plain) => r.code_hash === plain || r.code_hash.includes(plain.replace(/-/g, "")))
    );
    const allSaltedSha256 =
      storedRows?.length === 6 &&
      storedRows.every((r) => r.code_hash.length === 64 && r.code_salt.length >= 32) &&
      !anyPlaintext;
    rec("Recovery codes stored strictly as salted SHA-256 hashes (zero plaintext)", allSaltedSha256 ? "PASS" : "FAIL");

    // 5. Authenticated owner CANNOT directly query account_recovery_codes via Supabase API
    const authedClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await authedClient.auth.signInWithPassword({ email: authUser.user.email, password: pass1 });
    const ownerDirectRead = await authedClient.from("account_recovery_codes").select("*");
    rec(
      "Authenticated user blocked from direct PostgREST access to account_recovery_codes",
      Boolean(ownerDirectRead.error) || (ownerDirectRead.data?.length || 0) === 0 ? "PASS" : "FAIL",
      ownerDirectRead.error?.code || "0 rows"
    );

    // 6. Username + password login works & wrong password rejected
    const wrongLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "WrongPassword999!" }),
    });
    const okLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: pass1 }),
    });
    rec("Username login rejects wrong password (401) & accepts valid password (200)", wrongLogin.status === 401 && okLogin.status === 200 ? "PASS" : "FAIL");

    // 7. Forged recovery code rejected (401)
    const forgeRecover = await fetch(`${BASE_URL}/api/auth/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        recoveryCode: "AAAA-BBBB-CCCC-DDDD",
        newPassword: pass2,
        confirmPassword: pass2,
      }),
    });
    rec("Forged recovery code rejected (401)", forgeRecover.status === 401 ? "PASS" : "FAIL", `HTTP ${forgeRecover.status}`);

    // 8. Valid single-use recovery code resets password (tested lowercase & no dashes)
    const code1 = signupJson.recoveryCodes[0];
    const code2 = signupJson.recoveryCodes[1];
    const okRecover = await fetch(`${BASE_URL}/api/auth/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        recoveryCode: code1.replace(/-/g, "").toLowerCase(),
        newPassword: pass2,
        confirmPassword: pass2,
      }),
    });
    const okRecoverJson = await okRecover.json();
    rec(
      "Valid single-use recovery code updates password & decrements remaining count",
      okRecover.status === 200 && okRecoverJson.ok && okRecoverJson.remainingCodes === 5 ? "PASS" : "FAIL",
      `HTTP ${okRecover.status}, remaining=${okRecoverJson.remainingCodes}`
    );

    // 9. Reusing the SAME recovery code rejected (401)
    const replayRecover = await fetch(`${BASE_URL}/api/auth/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        recoveryCode: code1,
        newPassword: pass1,
        confirmPassword: pass1,
      }),
    });
    rec("Consumed recovery code cannot be reused (401)", replayRecover.status === 401 ? "PASS" : "FAIL", `HTTP ${replayRecover.status}`);

    // 10. Old password rejected & new password logs in cleanly
    const oldPassLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: pass1 }),
    });
    const newPassLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: pass2 }),
    });
    const refreshedCookies = extractCookieHeader(newPassLogin);
    rec(
      "After recovery, old password fails (401) and new password logs in (200)",
      oldPassLogin.status === 401 && newPassLogin.status === 200 ? "PASS" : "FAIL"
    );

    // 11. Unauthenticated /api/account/recovery-codes rejected (401)
    const unauthCodesGet = await fetch(`${BASE_URL}/api/account/recovery-codes`);
    const unauthCodesPost = await fetch(`${BASE_URL}/api/account/recovery-codes`, { method: "POST" });
    rec(
      "Unauthenticated GET/POST /api/account/recovery-codes rejected (401)",
      unauthCodesGet.status === 401 && unauthCodesPost.status === 401 ? "PASS" : "FAIL"
    );

    // 12. Authenticated GET count & POST regenerate revokes old unused codes
    const authedGet = await fetch(`${BASE_URL}/api/account/recovery-codes`, {
      headers: { Cookie: refreshedCookies },
    });
    const authedGetJson = await authedGet.json();
    const authedPost = await fetch(`${BASE_URL}/api/account/recovery-codes`, {
      method: "POST",
      headers: { Cookie: refreshedCookies },
    });
    const authedPostJson = await authedPost.json();

    // Old unused code2 must now be revoked & rejected!
    const revokedCodeAttempt = await fetch(`${BASE_URL}/api/auth/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        recoveryCode: code2,
        newPassword: pass1,
        confirmPassword: pass1,
      }),
    });

    rec(
      "Regenerating recovery codes revokes previous unused codes & issues 6 fresh codes",
      authedGetJson.remainingCount === 5 &&
        authedPost.status === 200 &&
        authedPostJson.recoveryCodes?.length === 6 &&
        revokedCodeAttempt.status === 401
        ? "PASS"
        : "FAIL",
      `before=${authedGetJson.remainingCount}, after=${authedPostJson.remainingCount}, revokedOldStatus=${revokedCodeAttempt.status}`
    );
  } finally {
    if (server) server.kill();
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
    const { data: check } = await admin.auth.admin.listUsers({ perPage: 200 });
    const left = (check?.users || []).filter((u) => /^u_[0-9a-f]{24}@users\.miora\.invalid$/.test(u.email || "") && createdUserIds.includes(u.id));
    console.log(`[CLEANUP] Remaining test users from this suite: ${left.length}`);
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log(`\nUSERNAME AUTH & RECOVERY SUMMARY: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
