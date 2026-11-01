// Palette-quantize the generated Android splash PNGs (~8 MB → ~2 MB) to keep the APK small.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const root = 'android/app/src/main/res';
for (const d of fs.readdirSync(root)) {
  const f = path.join(root, d, 'splash.png'); if (!fs.existsSync(f)) continue;
  fs.writeFileSync(f, await sharp(f).png({ palette: true, quality: 100, colours: 256, dither: 1.0, effort: 10, compressionLevel: 9 }).toBuffer());
}
console.log('splash PNGs compressed');
