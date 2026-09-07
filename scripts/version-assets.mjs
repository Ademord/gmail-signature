import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES } from './public-files.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function versionAssets(root = projectRoot, { check = false } = {}) {
  const hash = createHash('sha256');
  // Excluding HTML avoids hashing the version into itself. Normalize source line
  // endings so Windows checkouts and Linux CI produce the same release token.
  for (const name of PUBLIC_FILES.filter(name => !name.endsWith('.html')).sort()) {
    let bytes = await readFile(resolve(root, name));
    if (/\.(?:js|css)$/.test(name)) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    hash.update(name + '\0').update(bytes).update('\0');
  }
  const version = hash.digest('hex').slice(0, 16);
  const updates = [];
  for (const name of ['index.html', 'signature.html']) {
    const original = await readFile(resolve(root, name), 'utf8');
    const updated = original.replace(/\b(src|href)="([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g,
      (match, attribute, asset) => {
        if (!PUBLIC_FILES.includes(asset)) throw new Error('Unlisted editor asset: ' + asset);
        return `${attribute}="${asset}?v=${version}"`;
      });
    if (check && original !== updated) throw new Error('Stale editor asset versions. Run node scripts/version-assets.mjs and commit both HTML entry points.');
    updates.push([name, updated]);
  }
  if (!check) for (const [name, html] of updates) await writeFile(resolve(root, name), html);
  return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  console.log(`${check ? 'Checked' : 'Updated'} editor asset version ${await versionAssets(projectRoot, { check })}`);
}
