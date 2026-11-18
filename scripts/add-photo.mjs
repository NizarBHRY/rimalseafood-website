// Turn an original photo into the web copies the site uses.
//
//   node scripts/add-photo.mjs <original> <name> [<original> <name> ...]
//
// Writes public/photos/<name>-480.webp, -800, -1200 and -1600 (never larger
// than the original). Then use <name> wherever a photo id goes: in
// site/menu-data.js `photo:` fields or the component photo constants.
// photoUrl() / rimalPhotoUrl() pick the right size.
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WIDTHS = [480, 800, 1200, 1600];
const out = join(process.cwd(), 'public', 'photos');
const args = process.argv.slice(2);
if (!args.length || args.length % 2) {
  console.error('Usage: node scripts/add-photo.mjs <original> <name> [<original> <name> ...]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

for (let i = 0; i < args.length; i += 2) {
  const [src, name] = [args[i], args[i + 1]];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) throw new Error(`Name must be lowercase-with-dashes: ${name}`);
  const sizes = [];
  for (const w of WIDTHS) {
    const file = join(out, `${name}-${w}.webp`);
    await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(file);
    sizes.push(`${w}:${Math.round(statSync(file).size / 1024)}KB`);
  }
  console.log(name.padEnd(28), sizes.join('  '));
}
