// Génère les icônes PWA de TaskSync à partir d'un SVG source (via sharp)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/icons", import.meta.url));
mkdirSync(OUT, { recursive: true });

const gradient = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#0d9488"/>
    </linearGradient>
  </defs>`;

const check = (scale, cx, cy) => {
  // coche centrée, mise à l'échelle autour du centre (cx, cy)
  const s = (x, y) => `${cx + (x - 256) * scale} ${cy + (y - 256) * scale}`;
  return `<path d="M ${s(140, 262)} L ${s(226, 348)} L ${s(376, 176)}" stroke="#ffffff" stroke-width="${42 * scale}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
};

// Icône standard : carré arrondi + coche
const iconSvg = (size, rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${gradient}
  <rect width="512" height="512" rx="${rounded ? 118 : 0}" fill="url(#g)"/>
  ${check(1, 256, 262)}
</svg>`;

// Icône maskable : plein cadre, coche réduite dans la zone sûre (80%)
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${gradient}
  <rect width="512" height="512" fill="url(#g)"/>
  ${check(0.62, 256, 256)}
</svg>`;

writeFileSync("/tmp/icon-src.svg", iconSvg(512, true));
writeFileSync("/tmp/icon-maskable-src.svg", maskableSvg);

await sharp("/tmp/icon-src.svg").resize(512, 512).png().toFile(`${OUT}/icon-512.png`);
await sharp("/tmp/icon-src.svg").resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
await sharp("/tmp/icon-src.svg").resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
await sharp("/tmp/icon-maskable-src.svg").resize(512, 512).png().toFile(`${OUT}/maskable-512.png`);
await sharp("/tmp/icon-src.svg").resize(32, 32).png().toFile(`${OUT}/favicon-32.png`);

console.log("Icônes générées dans", OUT);
