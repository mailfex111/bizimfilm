const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = 3098;
const URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
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

  try {
    console.log("Running Lighthouse on production build:", URL);
    const reportPath = path.join(__dirname, "..", "lighthouse-report.json");
    try {
      execSync(
        `npx --yes lighthouse ${URL} --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="${reportPath}" --chrome-flags="--headless=new --no-sandbox"`,
        {
          cwd: path.join(__dirname, ".."),
          stdio: "pipe",
          env: {
            ...process.env,
            CHROME_PATH: "C:/Program Files/Google/Chrome/Application/chrome.exe",
          },
        }
      );
    } catch {
      // Windows chrome-launcher temp folder cleanup may throw EPERM after JSON is already written
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const scores = {
      performance: Math.round((report.categories.performance?.score || 0) * 100),
      accessibility: Math.round((report.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round(
        (report.categories["best-practices"]?.score || 0) * 100
      ),
      seo: Math.round((report.categories.seo?.score || 0) * 100),
      fcp: report.audits["first-contentful-paint"]?.displayValue,
      lcp: report.audits["largest-contentful-paint"]?.displayValue,
      cls: report.audits["cumulative-layout-shift"]?.displayValue,
      tbt: report.audits["total-blocking-time"]?.displayValue,
    };

    console.log("LIGHTHOUSE PRODUCTION SCORES:", JSON.stringify(scores, null, 2));
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
