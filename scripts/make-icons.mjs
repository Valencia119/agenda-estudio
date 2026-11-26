// Genera los íconos PNG de la app a partir de public/favicon.svg
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));
await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
await mkdir(new URL('../desktop/build/', import.meta.url), { recursive: true });

const out = (p) => fileURLToPath(new URL(p, import.meta.url));

for (const size of [180, 192, 512]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(`../public/icons/icon-${size}.png`));
}

// Versión "maskable" (con margen de seguridad para Android/Windows)
const inner = await sharp(svg, { density: 300 }).resize(380, 380).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2b2522' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('../public/icons/icon-maskable-512.png'));

// Ícono para el instalador de Windows (electron-builder lo convierte a .ico)
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(out('../desktop/build/icon.png'));
// Ícono pequeño para la bandeja del sistema
await sharp(svg, { density: 300 }).resize(32, 32).png().toFile(out('../desktop/build/tray.png'));

console.log('Íconos generados');
