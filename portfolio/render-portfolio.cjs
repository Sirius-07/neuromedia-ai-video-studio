const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = __dirname;
const htmlPath = path.join(root, "neuromedia-portfolio.html");
const outputDir = path.join(root, "output");
const previewDir = path.join(root, "preview");
const pdfPath = path.join(outputDir, "NeuroMedia-AI-Product-Interaction-Portfolio.pdf");
const montagePath = path.join(previewDir, "montage.png");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: pdfPath,
    width: "1920px",
    height: "1080px",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
  });

  await page.emulateMedia({ media: "screen" });
  const slides = page.locator(".slide");
  const count = await slides.count();
  for (let i = 0; i < count; i += 1) {
    await slides.nth(i).screenshot({
      path: path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`),
    });
  }

  await page.setViewportSize({ width: 480, height: 270 * count });
  await page.addStyleTag({
    content: `
      body { width: 480px !important; background: #e2e8f0 !important; }
      .slide {
        width: 480px !important;
        height: 270px !important;
        transform: none !important;
        padding: 19.5px 24px 18px !important;
      }
      body { zoom: 0.25; }
    `,
  });

  await page.screenshot({ path: montagePath, fullPage: true });
  await browser.close();

  const report = {
    pdfPath,
    previewDir,
    montagePath,
    slides: count,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outputDir, "render-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

