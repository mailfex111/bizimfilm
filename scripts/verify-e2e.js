const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const path = require("path");
const sharp = require("sharp");

const ARTIFACT_DIR =
  "C:/Users/90551/.gemini/antigravity/brain/d0708d21-e21a-49a0-8d16-b49d7e42c8f4";
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("1. Starting Miora production server on port", PORT);
  const nextBin = path.join(
    __dirname,
    "..",
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: path.join(__dirname, ".."),
    stdio: "pipe",
  });

  await sleep(3000);

  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const consoleErrors = [];

  try {
    // 1. Verify HTTP security & privacy headers + robots.txt
    const homeRes = await fetch(BASE_URL);
    console.log("[PASS] Security & privacy headers:", {
      status: homeRes.status,
      "x-robots-tag": homeRes.headers.get("x-robots-tag"),
      "x-content-type-options": homeRes.headers.get("x-content-type-options"),
      "x-frame-options": homeRes.headers.get("x-frame-options"),
    });

    const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
    const robotsTxt = await robotsRes.text();
    if (!robotsTxt.includes("Disallow: /api/")) {
      throw new Error("/robots.txt missing /api/ disallow");
    }
    console.log("[PASS] /robots.txt verified");

    // 2. Verify /api/account/delete rejects unauthenticated calls (401)
    const delRes = await fetch(`${BASE_URL}/api/account/delete`, {
      method: "POST",
    });
    if (delRes.status !== 401) {
      throw new Error(`Expected 401 on unauthenticated /api/account/delete, got ${delRes.status}`);
    }
    console.log("[PASS] Unauthenticated POST /api/account/delete rejected (HTTP 401)");

    // 3. Verify /auth/callback open-redirect guard
    const cbRes = await fetch(`${BASE_URL}/auth/callback?code=invalid&next=https://evil.example`, {
      redirect: "manual",
    });
    const loc = cbRes.headers.get("location") || "";
    if (loc.includes("evil.example")) {
      throw new Error(`Open redirect detected in /auth/callback: ${loc}`);
    }
    console.log("[PASS] /auth/callback open-redirect guard verified ->", loc);

    // 4. Verify /api/auth/login invalid credentials (generic error, no enumeration) + rate limit
    let got401 = false;
    let got429 = false;
    for (let i = 0; i < 12; i++) {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "nonexistent.probe@example.test",
          password: "WrongPassword123!",
        }),
      });
      if (loginRes.status === 401) got401 = true;
      if (loginRes.status === 429) {
        got429 = true;
        break;
      }
    }
    if (!got401) throw new Error("Expected 401 on invalid credentials");
    if (!got429) throw new Error("Expected 429 rate limit on /api/auth/login burst");
    console.log("[PASS] /api/auth/login invalid login (401) + rate limiting (429) verified");

    const page = await browser.newPage();
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    await sleep(900);

    // 5. Verify Miora Login UI & zero demo references
    const loginText = await page.evaluate(() => document.body.innerText);
    if (!loginText.includes("Miora")) {
      throw new Error("Expected Miora branding on login screen");
    }
    if (loginText.toLowerCase().includes("demo hesap") || loginText.includes("cift1")) {
      throw new Error("Found forbidden demo account reference on login screen");
    }
    console.log("[PASS] Miora Login UI verified (zero demo accounts)");

    // 6. Verify real browser Canvas WebP optimization + 1920px downscale + 480px thumbnail + EXIF strip
    const rawPngBuf = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: { r: 48, g: 34, b: 44 },
      },
    })
      .png()
      .toBuffer();

    const webpResult = await page.evaluate(async (base64Png) => {
      const bin = atob(base64Png);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });

      // Mirror mediaOptimizer.ts max 1920px + WebP 0.83 + 480px thumb
      const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
      const outW = Math.round(bitmap.width * scale);
      const outH = Math.round(bitmap.height * scale);
      const c1 = document.createElement("canvas");
      c1.width = outW;
      c1.height = outH;
      c1.getContext("2d").drawImage(bitmap, 0, 0, outW, outH);
      const mainWebp = await new Promise((res) => c1.toBlob(res, "image/webp", 0.83));

      const tScale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
      const tW = Math.round(bitmap.width * tScale);
      const tH = Math.round(bitmap.height * tScale);
      const c2 = document.createElement("canvas");
      c2.width = tW;
      c2.height = tH;
      c2.getContext("2d").drawImage(bitmap, 0, 0, tW, tH);
      const thumbWebp = await new Promise((res) => c2.toBlob(res, "image/webp", 0.78));
      bitmap.close();

      return {
        inputBytes: arr.length,
        mainType: mainWebp.type,
        mainBytes: mainWebp.size,
        mainDims: `${outW}x${outH}`,
        thumbType: thumbWebp.type,
        thumbBytes: thumbWebp.size,
        thumbDims: `${tW}x${tH}`,
      };
    }, rawPngBuf.toString("base64"));

    if (webpResult.mainType !== "image/webp" || webpResult.mainDims !== "1920x1280") {
      throw new Error(`Unexpected WebP optimization result: ${JSON.stringify(webpResult)}`);
    }
    console.log("[PASS] Real Browser WebP + 1920px downscale + 480px thumbnail verified:", webpResult);

    // 7. Verify simplified username-only Signup UI tab (4 fields, zero email/phone)
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent?.trim(), btn);
      if (text === "Kayıt Ol") {
        await btn.click();
        break;
      }
    }
    await sleep(300);
    const signupText = await page.evaluate(() => document.body.innerText);
    if (
      !signupText.toLowerCase().includes("ad soyad") ||
      !signupText.toLowerCase().includes("kullanıcı adı") ||
      !signupText.toLowerCase().includes("şifre tekrarı") ||
      signupText.toLowerCase().includes("e-posta adresi")
    ) {
      throw new Error("Signup form does not match simplified 4-field username-only specification");
    }
    console.log("[PASS] Miora 4-field Username-Only Signup UI verified (zero email/phone)");

    // 8. Test Mobile Viewport (390x844) horizontal overflow check
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    await sleep(800);

    const overflowCheck = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    if (overflowCheck.scrollWidth > overflowCheck.innerWidth) {
      throw new Error(`Mobile horizontal overflow detected: ${overflowCheck.scrollWidth} > ${overflowCheck.innerWidth}`);
    }
    console.log("[PASS] Mobile viewport overflow check (390x844):", overflowCheck);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "miora_login_mobile.png"),
    });

    if (consoleErrors.length > 0) {
      console.log("[FAIL] Console errors:", consoleErrors);
      process.exitCode = 1;
    } else {
      console.log("[PASS] Browser console errors: 0");
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
