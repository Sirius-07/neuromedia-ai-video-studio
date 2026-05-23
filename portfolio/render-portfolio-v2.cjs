const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = __dirname;
const htmlPath = path.join(root, "neuromedia-portfolio-v2.html");
const outputDir = path.join(root, "output-v2");
const previewDir = path.join(root, "preview-v2");
const pdfPath = path.join(outputDir, "Neuromedia-Portfolio-V2.pdf");
const montagePath = path.join(previewDir, "montage-v2.png");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 2,
  });

  await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: pdfPath,
    width: "1440px",
    height: "810px",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
  });

  await page.emulateMedia({ media: "screen" });
  const slides = page.locator(".slide");
  const count = await slides.count();

  for (let i = 0; i < count; i += 1) {
    await slides.nth(i).screenshot({
      path: path.join(previewDir, `${String(i + 1).padStart(2, "0")}_Neuromedia_V2.png`),
    });
  }

  await page.setViewportSize({ width: 360, height: 203 * count });
  await page.addStyleTag({
    content: `
      body { width: 360px !important; background: #ddd8ce !important; }
      .slide {
        width: 360px !important;
        height: 202.5px !important;
        padding: 10.5px 13.5px !important;
      }
      body { zoom: 0.25; }
    `,
  });

  await page.screenshot({ path: montagePath, fullPage: true });
  await browser.close();

  const report = {
    htmlPath,
    pdfPath,
    previewDir,
    montagePath,
    slides: count,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(outputDir, "render-report-v2.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
