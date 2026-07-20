import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src/config');
const distDir = path.resolve('dist/config');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const files = ['gym_intents.json', 'gym_bot_weights.json'];

files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[Build] Copied ${file} to dist/config/`);
  }
});
