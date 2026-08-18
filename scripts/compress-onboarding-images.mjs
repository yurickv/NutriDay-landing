// Одноразове стиснення картинок квізу: ресайз до ширини <= 960px (колонка
// квізу <= 480px, х2 на retina) + AVIF quality 50. Перезаписує файл лише
// якщо результат менший. Запуск: node scripts/compress-onboarding-images.mjs
import sharp from 'sharp';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'public/onboarding';
const THRESHOLD_BYTES = 60 * 1024;
const MAX_WIDTH = 960;

const files = (await readdir(DIR)).filter((f) => f.endsWith('.avif'));
let saved = 0;

for (const file of files) {
  const filePath = path.join(DIR, file);
  const before = (await stat(filePath)).size;
  if (before <= THRESHOLD_BYTES) {
    console.log(`skip  ${file} (${Math.round(before / 1024)}K)`);
    continue;
  }
  const out = await sharp(await readFile(filePath))
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .avif({ quality: 50 })
    .toBuffer();
  if (out.length >= before) {
    console.log(`keep  ${file}: recompressed not smaller`);
    continue;
  }
  await writeFile(filePath, out);
  saved += before - out.length;
  console.log(
    `write ${file}: ${Math.round(before / 1024)}K -> ${Math.round(out.length / 1024)}K`,
  );
}

console.log(`total saved: ${Math.round(saved / 1024)}K`);
