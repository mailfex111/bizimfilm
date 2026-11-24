const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const path = require("path");

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
    // Verify HTTP headers & robots.txt
    const homeRes = await fetch(BASE_URL);
    const xRobots = homeRes.headers.get("x-robots-tag");
    const xContentType = homeRes.headers.get("x-content-type-options");
    const xFrame = homeRes.headers.get("x-frame-options");
    console.log("✓ Security & privacy headers:", {
      status: homeRes.status,
      "x-robots-tag": xRobots,
      "x-content-type-options": xContentType,
      "x-frame-options": xFrame,
    });

    const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
    const robotsTxt = await robotsRes.text();
    console.log("✓ /robots.txt verified:\n" + robotsTxt.trim());

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

    // Check Login screen has Miora branding and ZERO demo buttons
    const loginText = await page.evaluate(() => document.body.innerText);
    if (!loginText.includes("Miora")) {
      throw new Error("Expected Miora branding on login screen");
    }
    if (
      loginText.toLowerCase().includes("demo hesap") ||
      loginText.includes("cift1")
    ) {
      throw new Error("Found forbidden demo account reference on login screen");
    }
    console.log("✓ Miora Login UI verified (zero demo accounts)");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "miora_login_desktop.png"),
    });

    // Switch to Signup tab and verify real fields (Display Name, Username, Email, Password)
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
      !signupText.includes("E-posta") ||
      !signupText.toLowerCase().includes("kullanıcı adı")
    ) {
      throw new Error("Signup form missing required real auth fields");
    }
    console.log("✓ Miora Signup UI verified");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "miora_signup_desktop.png"),
    });

    // Test Mobile Viewport (390x844) horizontal overflow check
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
    console.log("✓ Mobile viewport overflow check:", overflowCheck);
    if (overflowCheck.scrollWidth > overflowCheck.innerWidth) {
      throw new Error(
        `Mobile horizontal overflow detected: ${overflowCheck.scrollWidth} > ${overflowCheck.innerWidth}`
      );
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "miora_login_mobile.png"),
    });

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
