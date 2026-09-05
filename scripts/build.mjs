import { lstat, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, readPublicFile } from './public-files.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function buildSite(root = projectRoot) {
  const absoluteRoot = await realpath(root);
  const output = resolve(absoluteRoot, 'dist');
  // Validate the exact recursive-removal target before deleting stale output.
  if (dirname(output) !== absoluteRoot || output === absoluteRoot) {
    throw new Error('Build output must be the project dist directory.');
  }
  try {
    const stat = await lstat(output);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Refusing to replace non-directory or symbolic-link dist.');
    if (await realpath(output) !== output) throw new Error('Refusing to replace redirected dist.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Read and check the entire allowlist before replacing the previous build.
  const files = await Promise.all(PUBLIC_FILES.map(async name => [name, await readPublicFile(absoluteRoot, name)]));
  await rm(output, { recursive: true, force: true });
  for (const [name, contents] of files) {
    const destination = resolve(output, name);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
  return { output, count: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSite();
  console.log(`Built ${result.count} public files into ${result.output}`);
}
