/**
 * Generates PWA icons from public/icons/icon.svg using sharp.
 * Run: node scripts/generate-icons.mjs
 *
 * sharp is bundled with Next.js as an optional peer dep. If missing:
 *   npm install sharp --save-dev
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const svgPath = join(root, "public", "icons", "icon.svg");
const svgBuffer = readFileSync(svgPath);

const sizes = [192, 512];

for (const size of sizes) {
  // Regular icon
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(root, "public", "icons", `icon-${size}.png`));
  console.log(`icon-${size}.png`);

  // Maskable icon (10% safe-zone padding — content at 80% center)
  const padding = Math.round(size * 0.1);
  const inner = size - padding * 2;
  const resized = await sharp(svgBuffer).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0f172a
    },
  })
    .composite([{ input: resized, top: padding, left: padding }])
    .png()
    .toFile(join(root, "public", "icons", `icon-maskable-${size}.png`));
  console.log(`icon-maskable-${size}.png`);
}

// Apple touch icon (180x180)
await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile(join(root, "public", "icons", "apple-touch-icon.png"));
console.log("apple-touch-icon.png");

console.log("Done.");
