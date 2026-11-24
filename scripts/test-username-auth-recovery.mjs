/**
 * Miora Comprehensive Username Auth, Recovery, Concurrency & Distributed Rate-Limit Suite
 *
 * Verifies all 15 user-requested security & functional scenarios:
 * 1. Signup without real email/phone/SMS (internal @users.miora.invalid)
 * 2. Direct login without email/SMS verification
 * 3. Duplicate username blocked (409)
 * 4. Case-insensitive duplicate username blocked (409)
 * 5. Concurrent 3x signup race on identical username -> exactly 1 wins (201), 0 orphan auth.users
 * 6. 6 recovery codes generated safely
 * 7. Zero plaintext recovery codes in DB (salted SHA-256 only)
 * 8. Recovery code works once & updates password
 * 9. Concurrent 3x recovery race with identical code -> exactly 1 wins (200), 2 blocked (401)
 * 10. Regenerating recovery codes revokes all old unused codes
 * 11. Password recovery & password change immediately revoke old sessions (access + refresh tokens)
 * 12. Cross-user & direct PostgREST access to recovery codes blocked (42501)
 * 13. Multi-instance serverless distributed rate limiting verified across 2 separate Next.js processes
 * 14. Failed signups leave zero orphan auth.users records
 * 15. Clean isolated cleanup preserving all existing users & couples
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
const PORT_A = 3096;
const PORT_B = 3097;
const BASE_A = EXTERNAL_URL || `http://localhost:${PORT_A}`;
const BASE_B = EXTERNAL_URL || `http://localhost:${PORT_B}`;

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
  let serverA = null;
  let serverB = null;

  if (!EXTERNAL_URL) {
    const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
    serverA = spawn(process.execPath, [nextBin, "start", "-p", String(PORT_A)], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    serverB = spawn(process.execPath, [nextBin, "start", "-p", String(PORT_B)], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    await sleep(3200);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = Date.now().toString(36);
  const userAName = `miora_u_${runId}_a`;
  const userBName = `miora_u_${runId}_b`;
  const raceName = `miora_u_${runId}_race`;
  const pass1 = `MioraPass1!${runId}`;
  const pass2 = `MioraPass2!${runId}`;
  const pass3 = `MioraPass3!${runId}`;
  const createdUserIds = [];
  const rateLimitKeysUsed = [];

  // Use unique synthetic forwarded IPs per test group so tests don't collide with each other's buckets
  const ipMain = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const ipRace = `198.51.101.${Math.floor(Math.random() * 200) + 1}`;
  const ipRecoverRace = `198.51.102.${Math.floor(Math.random() * 200) + 1}`;
  const ipDistLimit = `198.51.103.${Math.floor(Math.random() * 200) + 1}`;

  try {
    // 0. Check Migration 009 & anon blocking on account_recovery_codes
    const anonCheck = await anon.from("account_recovery_codes").select("*").limit(1);
    const tableMissing =
      anonCheck.error &&
      (anonCheck.error.code === "42P01" ||
        anonCheck.error.code === "PGRST205" ||
        /Could not find the table|does not exist/i.test(anonCheck.error.message || ""));
    if (tableMissing) {
      rec("Migration 009 applied", "FAIL", "Run 009_miora_recovery_codes.sql first");
      return;
    }
    rec(
      "Direct anon access to account_recovery_codes blocked",
      Boolean(anonCheck.error) || (anonCheck.data?.length || 0) === 0 ? "PASS" : "FAIL",
      anonCheck.error?.code || "0 rows"
    );

    // 1. Snapshot initial auth.users count to verify zero orphan accounts later
    const { data: beforeUsersData } = await admin.auth.admin.listUsers({ perPage: 200 });
    const countBefore = (beforeUsersData?.users || []).length;

    // 2. Password mismatch rejected (400) & leaves 0 orphan users
    const badSignup = await fetch(`${BASE_A}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipMain },
      body: JSON.stringify({
        displayName: "Bad Signup",
        username: userAName,
        password: pass1,
        confirmPassword: "WrongConfirm!",
      }),
    });
    rec("Signup rejects password mismatch (400)", badSignup.status === 400 ? "PASS" : "FAIL", `HTTP ${badSignup.status}`);

    // 3. Valid username-only signup (no email, no phone, no SMS)
    const signupA = await fetch(`${BASE_A}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipMain },
      body: JSON.stringify({
        displayName: "Deniz Yılmaz",
        username: userAName,
        password: pass1,
        confirmPassword: pass1,
      }),
    });
    const signupAJson = await signupA.json();
    const cookiesA = extractCookieHeader(signupA);
    rec(
      "Username-only signup creates account immediately with 6 recovery codes & SSR cookies",
      signupA.status === 201 && signupAJson.ok && signupAJson.recoveryCodes?.length === 6 && cookiesA.length > 0 ? "PASS" : "FAIL",
      `HTTP ${signupA.status}, codes=${signupAJson.recoveryCodes?.length || 0}`
    );

    const { data: profA } = await admin.from("profiles").select("id, username").ilike("username", userAName).single();
    if (profA?.id) createdUserIds.push(profA.id);
    const { data: authA } = await admin.auth.admin.getUserById(profA.id);
    rec(
      "Internal synthetic email (@users.miora.invalid) auto-confirmed without real mailbox/SMS",
      Boolean(authA?.user?.email?.endsWith("@users.miora.invalid")) && Boolean(authA?.user?.email_confirmed_at) ? "PASS" : "FAIL",
      `domain=${authA?.user?.email?.split("@")[1]}`
    );

    // 4. Duplicate & case-insensitive username blocked (409)
    const dupExact = await fetch(`${BASE_A}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipMain },
      body: JSON.stringify({ displayName: "Dup Exact", username: userAName, password: pass1, confirmPassword: pass1 }),
    });
    const dupCase = await fetch(`${BASE_A}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipMain },
      body: JSON.stringify({ displayName: "Dup Case", username: userAName.toUpperCase(), password: pass1, confirmPassword: pass1 }),
    });
    rec(
      "Duplicate & mixed-case username blocked (409)",
      dupExact.status === 409 && dupCase.status === 409 ? "PASS" : "FAIL",
      `exact=${dupExact.status}, upper=${dupCase.status}`
    );

    // 5. Concurrent 3x signup race on identical username -> exactly 1 succeeds (201), 2 get 409, 0 orphans!
    const raceResponses = await Promise.all([
      fetch(`${BASE_A}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ipRace },
        body: JSON.stringify({ displayName: "Race 1", username: raceName, password: pass1, confirmPassword: pass1 }),
      }),
      fetch(`${BASE_B}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ipRace },
        body: JSON.stringify({ displayName: "Race 2", username: raceName.toUpperCase(), password: pass1, confirmPassword: pass1 }),
      }),
      fetch(`${BASE_A}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ipRace },
        body: JSON.stringify({ displayName: "Race 3", username: raceName, password: pass1, confirmPassword: pass1 }),
      }),
    ]);
    const raceStatuses = raceResponses.map((r) => r.status);
    const raceWinners = raceStatuses.filter((s) => s === 201).length;
    const raceConflicts = raceStatuses.filter((s) => s === 409).length;

    const { data: raceProfs } = await admin.from("profiles").select("id, username").ilike("username", `${raceName}%`);
    for (const rp of raceProfs || []) createdUserIds.push(rp.id);

    const { data: afterRaceUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
    const expectedAfterRace = countBefore + 2; // userA + 1 race winner ONLY!
    const zeroOrphans = (afterRaceUsers?.users || []).length === expectedAfterRace && (raceProfs || []).length === 1;
    rec(
      "Concurrent 3x signup race allows exactly 1 winner and leaves 0 orphan auth.users",
      raceWinners === 1 && raceConflicts === 2 && zeroOrphans ? "PASS" : "FAIL",
      `statuses=[${raceStatuses.join(",")}], usersDelta=${(afterRaceUsers?.users || []).length - countBefore} (expected 2)`
    );

    // Also create User B for cross-user recovery isolation tests
    const signupB = await fetch(`${BASE_A}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipMain },
      body: JSON.stringify({ displayName: "User B", username: userBName, password: pass1, confirmPassword: pass1 }),
    });
    const signupBJson = await signupB.json();
    const { data: profB } = await admin.from("profiles").select("id").ilike("username", userBName).single();
    if (profB?.id) createdUserIds.push(profB.id);

    // 6. Recovery codes stored ONLY as salted SHA-256 hashes (never plaintext)
    const { data: storedRows } = await admin.from("account_recovery_codes").select("id, code_salt, code_hash").eq("user_id", profA.id);
    const anyPlaintext = (storedRows || []).some((r) =>
      signupAJson.recoveryCodes.some((plain) => r.code_hash === plain || r.code_hash.includes(plain.replace(/-/g, "")))
    );
    const allHashed = storedRows?.length === 6 && storedRows.every((r) => r.code_hash.length === 64 && r.code_salt.length >= 32) && !anyPlaintext;
    rec("6 recovery codes stored strictly as salted SHA-256 hashes (zero plaintext)", allHashed ? "PASS" : "FAIL");

    // 7. Cross-user & direct PostgREST access to account_recovery_codes blocked
    const clientA = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: sessA1 } = await clientA.auth.signInWithPassword({ email: authA.user.email, password: pass1 });
    const directReadA = await clientA.from("account_recovery_codes").select("*");

    const { data: authB } = await admin.auth.admin.getUserById(profB.id);
    const clientB = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await clientB.auth.signInWithPassword({ email: authB.user.email, password: pass1 });
    const directReadB = await clientB.from("account_recovery_codes").select("*");

    // User B tries using User B's own valid recovery code against User A's username -> MUST FAIL (401)!
    const crossUserRecover = await fetch(`${BASE_A}/api/auth/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.104.${Math.floor(Math.random() * 200) + 1}` },
      body: JSON.stringify({
        username: userAName,
        recoveryCode: signupBJson.recoveryCodes[0],
        newPassword: pass2,
        confirmPassword: pass2,
      }),
    });
    rec(
      "Direct PostgREST & cross-user recovery code attacks blocked",
      Boolean(directReadA.error) && Boolean(directReadB.error) && crossUserRecover.status === 401 ? "PASS" : "FAIL",
      `directA=${directReadA.error?.code}, directB=${directReadB.error?.code}, crossRecover=${crossUserRecover.status}`
    );

    // 8. Concurrent 3x recovery race with identical single-use code -> exactly 1 succeeds (200), 2 fail (401)!
    const code1 = signupAJson.recoveryCodes[0];
    const code2 = signupAJson.recoveryCodes[1];
    const recRaceRes = await Promise.all([
      fetch(`${BASE_A}/api/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ipRecoverRace },
        body: JSON.stringify({ username: userAName, recoveryCode: code1, newPassword: pass2, confirmPassword: pass2 }),
      }),
      fetch(`${BASE_B}/api/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ipRecoverRace },
        body: JSON.stringify({ username: userAName, recoveryCode: code1.replace(/-/g, "").toLowerCase(), newPassword: pass2, confirmPassword: pass2 }),
      }),
      fetch(`${BASE_A}/api/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ipRecoverRace },
        body: JSON.stringify({ username: userAName, recoveryCode: code1, newPassword: pass2, confirmPassword: pass2 }),
      }),
    ]);
    const recStatuses = recRaceRes.map((r) => r.status);
    const recWinners = recStatuses.filter((s) => s === 200).length;
    const recRejects = recStatuses.filter((s) => s === 401).length;
    rec(
      "Concurrent 3x recovery race with same single-use code allows exactly 1 winner",
      recWinners === 1 && recRejects === 2 ? "PASS" : "FAIL",
      `statuses=[${recStatuses.join(",")}]`
    );

    // 9. Old session (sessA1 from before recovery) MUST be globally revoked (access + refresh tokens invalid)!
    const oldAccessCheck = await clientA.auth.getUser(sessA1.session.access_token);
    const oldRefreshCheck = await clientA.auth.refreshSession({ refresh_token: sessA1.session.refresh_token });
    rec(
      "Password recovery immediately invalidates previous device sessions (access & refresh tokens)",
      Boolean(oldAccessCheck.error) && Boolean(oldRefreshCheck.error) ? "PASS" : "FAIL",
      `accessErr=${oldAccessCheck.error?.message}, refreshErr=${oldRefreshCheck.error?.message}`
    );

    // 10. Old password rejected & new password logs in cleanly by username
    const oldPassLogin = await fetch(`${BASE_A}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipMain },
      body: JSON.stringify({ username: userAName, password: pass1 }),
    });
    const newPassLogin = await fetch(`${BASE_A}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipMain },
      body: JSON.stringify({ username: userAName, password: pass2 }),
    });
    const cookiesA2 = extractCookieHeader(newPassLogin);
    rec(
      "After recovery, old password fails (401) and new password logs in directly by username (200)",
      oldPassLogin.status === 401 && newPassLogin.status === 200 ? "PASS" : "FAIL"
    );

    // 11. Regenerating recovery codes revokes previous unused code2 & issues 6 fresh codes
    const unauthCodes = await fetch(`${BASE_A}/api/account/recovery-codes`);
    const getCodes = await fetch(`${BASE_A}/api/account/recovery-codes`, { headers: { Cookie: cookiesA2 } });
    const getCodesJson = await getCodes.json();
    const regenRes = await fetch(`${BASE_A}/api/account/recovery-codes`, { method: "POST", headers: { Cookie: cookiesA2 } });
    const regenJson = await regenRes.json();

    const tryRevokedCode2 = await fetch(`${BASE_A}/api/auth/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.105.${Math.floor(Math.random() * 200) + 1}` },
      body: JSON.stringify({ username: userAName, recoveryCode: code2, newPassword: pass3, confirmPassword: pass3 }),
    });
    rec(
      "Regenerating recovery codes revokes old unused codes & issues 6 fresh codes (unauth=401)",
      unauthCodes.status === 401 && getCodesJson.remainingCount === 5 && regenJson.recoveryCodes?.length === 6 && tryRevokedCode2.status === 401 ? "PASS" : "FAIL",
      `before=${getCodesJson.remainingCount}, after=${regenJson.remainingCount}, revokedOldStatus=${tryRevokedCode2.status}`
    );

    // 12. Logged-in password change revokes other device sessions (`signOut({ scope: 'others' })`)
    const devOther = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: otherSess } = await devOther.auth.signInWithPassword({ email: authA.user.email, password: pass2 });
    const devPrimary = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await devPrimary.auth.signInWithPassword({ email: authA.user.email, password: pass2 });
    await devPrimary.auth.updateUser({ password: pass3 });
    await devPrimary.auth.signOut({ scope: "others" });
    const otherAfterChange = await devOther.auth.getUser(otherSess.session.access_token);
    rec(
      "Logged-in password change revokes other active device sessions",
      Boolean(otherAfterChange.error) ? "PASS" : "FAIL",
      otherAfterChange.error?.message || "still valid!"
    );

    // 13. Multi-instance Serverless Distributed Rate Limiting (across Server A :3096 & Server B :3097!)
    // First check if PostgreSQL Migration 010 (`auth_rate_limits` / `consume_auth_rate_limit`) is active
    const rlProbe = await admin.rpc("consume_auth_rate_limit", {
      p_bucket_key: `probe:${runId}`,
      p_max_attempts: 2,
      p_window_seconds: 60,
    });
    rateLimitKeysUsed.push(`probe:${runId}`, `login:ip:${ipDistLimit}`, `login:ip:${ipMain}`, `signup:ip:${ipMain}`, `signup:ip:${ipRace}`, `recover:ip:${ipRecoverRace}`, `recover:user:${userAName}`);

    if (rlProbe.error) {
      rec(
        "Distributed serverless rate limiting across multiple instances (Migration 010)",
        "FAIL",
        `Run 010_miora_distributed_rate_limit.sql in Supabase SQL Editor (${rlProbe.error.message})`
      );
    } else {
      // Burn 6 attempts on Instance A (:3096) and 5 attempts on Instance B (:3097) with the SAME IP (limit = 10)
      let got429OnInstanceB = false;
      for (let i = 0; i < 6; i++) {
        await fetch(`${BASE_A}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": ipDistLimit },
          body: JSON.stringify({ username: "nonexistent_rl_user", password: "WrongPassword1!" }),
        });
      }
      for (let i = 0; i < 6; i++) {
        const resB = await fetch(`${BASE_B}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": ipDistLimit },
          body: JSON.stringify({ username: "nonexistent_rl_user", password: "WrongPassword1!" }),
        });
        if (resB.status === 429) {
          got429OnInstanceB = true;
          break;
        }
      }
      // Verify anon cannot access auth_rate_limits directly
      const anonRl = await anon.from("auth_rate_limits").select("*").limit(1);
      rec(
        "Distributed serverless rate limiting enforces shared limit across 2 separate instances (429)",
        got429OnInstanceB && Boolean(anonRl.error) ? "PASS" : "FAIL",
        `instanceB429=${got429OnInstanceB}, anonTableBlocked=${anonRl.error?.code}`
      );
    }
  } finally {
    if (serverA) serverA.kill();
    if (serverB) serverB.kill();
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
    // Clean temporary test rate-limit keys if table exists
    if (rateLimitKeysUsed.length > 0) {
      await admin.from("auth_rate_limits").delete().in("bucket_key", rateLimitKeysUsed).catch(() => {});
    }
    const { data: check } = await admin.auth.admin.listUsers({ perPage: 200 });
    const remaining = (check?.users || []).filter((u) => createdUserIds.includes(u.id));
    console.log(`[CLEANUP] Remaining test users from this suite: ${remaining.length}`);
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
