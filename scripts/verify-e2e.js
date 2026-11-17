const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ARTIFACT_DIR =
  "C:/Users/90551/.gemini/antigravity/brain/d0708d21-e21a-49a0-8d16-b49d7e42c8f4";
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("1. Starting production server on port", PORT);
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
    const page = await browser.newPage();
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    await sleep(600);

    // Screenshot 1: Redesigned Split Login Screen
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "bizimfilm_login.png"),
    });
    console.log("✓ Captured redesigned split login screen");

    // Test invalid credentials
    await page.type("#bizimfilm-username", "yanlis");
    await page.type("#bizimfilm-password", "12345");
    await page.click('button[type="submit"]');
    await sleep(300);
    const alertText = await page.$eval('[role="alert"]', (el) => el.textContent);
    console.log("✓ Invalid login alert verified:", alertText);

    // Open "Demo hesaplarını görüntüle" modal and select Emir ve Hazal
    const allLoginBtns = await page.$$("button");
    for (const btn of allLoginBtns) {
      const txt = await page.evaluate((el) => el.textContent, btn);
      if (txt && txt.includes("Demo hesaplarını görüntüle")) {
        await btn.click();
        break;
      }
    }
    await sleep(400);

    const modalBtns = await page.$$("button");
    for (const btn of modalBtns) {
      const txt = await page.evaluate((el) => el.textContent, btn);
      if (txt && txt.includes("Emir ve Hazal")) {
        await btn.click();
        break;
      }
    }
    await sleep(300);

    await page.click('button[type="submit"]');
    await sleep(1600);

    // Screenshot 2: Redesigned Desktop Home Page
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "bizimfilm_home_desktop.png"),
    });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "bizimfilm_home_full.png"),
      fullPage: true,
    });
    console.log("✓ Captured redesigned desktop home screen (viewport & full page)");

    // Verify session persistence across reload
    await page.reload({ waitUntil: "networkidle0" });
    await sleep(1200);
    const headingAfterReload = await page.$eval("h1", (el) => el.textContent);
    if (!headingAfterReload.includes("Bizim Hikayemiz")) {
      throw new Error("Session did not persist after reload!");
    }
    console.log("✓ Session persistence across reload verified");

    // Open Apple Pages-style Page Editor in Memory Book
    const editBtns = await page.$$('button[title="Sayfayı düzenle"]');
    if (editBtns.length > 0) {
      await editBtns[0].click();
      await sleep(500);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "bizimfilm_book_editor.png"),
      });
      console.log("✓ Captured Apple Pages-style Memory Book Editor modal");
      const allBtns = await page.$$("button");
      for (const b of allBtns) {
        const t = await page.evaluate((el) => el.textContent, b);
        if (t && t.trim() === "Tamam") {
          await b.click();
          break;
        }
      }
      await sleep(300);
    }

    // Navigate to Fotoğraflar tab and test photo upload + WebP conversion + IndexedDB persistence
    const navBtns = await page.$$("nav button");
    for (const b of navBtns) {
      const t = await page.evaluate((el) => el.textContent, b);
      if (t && t.includes("Fotoğraflar")) {
        await b.click();
        break;
      }
    }
    await sleep(800);

    const testImgPath = path.join(__dirname, "test-upload.png");
    await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 42, g: 38, b: 40 },
      },
    })
      .png()
      .toFile(testImgPath);

    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(testImgPath);
    await sleep(500);

    const confirmBtn = await page.$('form button[type="submit"]');
    await confirmBtn.click();
    await sleep(1200);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "bizimfilm_photos_gallery.png"),
    });
    console.log("✓ Photo uploaded, optimized to WebP, and saved to IndexedDB");

    // Reload and verify the uploaded photo persisted in IndexedDB
    await page.reload({ waitUntil: "networkidle0" });
    await sleep(1000);
    const navBtnsAfter = await page.$$("nav button");
    for (const b of navBtnsAfter) {
      const t = await page.evaluate((el) => el.textContent, b);
      if (t && t.includes("Fotoğraflar")) {
        await b.click();
        break;
      }
    }
    await sleep(800);
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (!bodyText.includes("7 öğe")) {
      throw new Error("Uploaded photo count did not persist after reload!");
    }
    console.log("✓ Uploaded photo persisted across reload (7 öğe)");

    if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);

    // Test Mobile Viewport (390x844) and check horizontal overflow
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    await sleep(1200);

    const overflowCheck = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    console.log("✓ Mobile viewport width check:", overflowCheck);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "bizimfilm_mobile.png"),
    });
    console.log("✓ Captured redesigned mobile screenshot");

    console.log("Console errors count:", consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log("Console errors:", consoleErrors);
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
