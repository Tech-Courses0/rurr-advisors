// Generates every brand raster the site needs, from the single source emblem
// (src/logo-mark.png — the RURR Advisors tree, extracted from the master logo).
//   • favicon.svg            crisp vector wrapper around the emblem (browser tabs)
//   • favicon.png  (32)      PNG fallback
//   • apple-touch-icon (180) iOS home-screen (full-bleed; iOS rounds it)
//   • og-image.svg / .png    1200×630 social card in the navy + green palette
// Run with: npm run gen:assets
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = (p) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

// brand tokens (mirror of the CSS :root palette)
const NAVY = "#0f2150";
const NAVY2 = "#16285f";
const GREEN = "#5cc483";
const LIGHT = "#b7c2dd";

const emblem = readFileSync(src("logo-mark.png"));        // 256px, tree on white
const emblem2x = readFileSync(src("logo-mark@2x.png"));   // 512px master
const emblem64 = emblem.toString("base64");

/* ---- favicon.svg : emblem on a white rounded tile (matches the PNG) -------- */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="RURR Advisors">
  <rect x="1" y="1" width="62" height="62" rx="14" fill="#ffffff" stroke="${NAVY}" stroke-opacity="0.12"/>
  <image x="5" y="5" width="54" height="54" href="data:image/png;base64,${emblem64}"/>
</svg>`;
writeFileSync(src("favicon.svg"), faviconSvg);

/* ---- favicon.png / apple-touch : emblem composited on a white square -------- */
async function tile(size, out, pad) {
  const inner = Math.round(size * (1 - pad * 2));
  const em = await sharp(emblem2x)
    .resize(inner, inner, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: em, left: Math.round(size * pad), top: Math.round(size * pad) }])
    .png()
    .toFile(out);
}
await tile(32, src("favicon.png"), 0.06);
await tile(180, src("apple-touch-icon.png"), 0.12);

/* ---- og-image : navy card, white logo coin, wordmark ----------------------- */
function ogSvg(embed) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="84%" cy="-6%" r="90%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.20"/>
      <stop offset="55%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="-5%" cy="110%" r="70%">
      <stop offset="0%" stop-color="#1d63b8" stop-opacity="0.30"/>
      <stop offset="60%" stop-color="#1d63b8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${NAVY}"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="96" y="175" width="280" height="280" rx="32" fill="#ffffff"/>
  ${embed ? `<image x="112" y="191" width="248" height="248" href="data:image/png;base64,${emblem64}"/>` : ""}
  <text x="432" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="94" fill="#ffffff">RURR Advisors</text>
  <text x="436" y="360" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="30" fill="${LIGHT}">Cultivating trust, creating wealth.</text>
  <rect x="436" y="440" width="44" height="3" fill="${GREEN}"/>
  <text x="494" y="450" font-family="Consolas, 'Courier New', monospace" font-size="21" fill="${GREEN}" letter-spacing="3">SEBI REGISTERED INVESTMENT ADVISER</text>
</svg>`;
}
// keep an editable, faithful source (emblem embedded)
writeFileSync(src("og-image.svg"), ogSvg(true));
// build the PNG by compositing the real emblem onto the rasterised card (robust)
const ogRaster = await sharp(Buffer.from(ogSvg(false))).resize(1200, 630).png().toBuffer();
const coin = await sharp(emblem).resize(248, 248, { fit: "contain", background: "#ffffff" }).png().toBuffer();
await sharp(ogRaster).composite([{ input: coin, left: 112, top: 191 }]).png().toFile(src("og-image.png"));

console.log("Generated favicon.svg, favicon.png, apple-touch-icon.png, og-image.svg, og-image.png");
