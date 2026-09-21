import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });

for (const file of ['index.html', 'styles.css', 'main.js']) {
  await cp(file, `dist/${file}`);
}

for (const file of [
  'gardening-hero-hat.png',
  'house-illustration.png',
  'ofcom-evidence.jpg',
  'octopus-evidence.jpg',
]) {
  await cp(`assets/${file}`, `dist/assets/${file}`);
}
