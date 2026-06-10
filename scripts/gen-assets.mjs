// Rasterises the brand SVGs into the PNGs that browsers and social-card
// crawlers need (most do not render SVG for og:image / apple-touch-icon).
// Run with: npm run gen:assets
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = (p) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

const favicon = readFileSync(src("favicon.svg"));
const og = readFileSync(src("og-image.svg"));

await sharp(favicon).resize(32, 32).png().toFile(src("favicon.png"));
await sharp(favicon).resize(180, 180).png().toFile(src("apple-touch-icon.png"));
await sharp(og).resize(1200, 630).png().toFile(src("og-image.png"));

console.log("Generated favicon.png, apple-touch-icon.png, og-image.png");
