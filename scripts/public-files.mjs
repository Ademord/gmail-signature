import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

// This is the entire publishable site. Never replace this with a recursive
// project-directory copy or generic static middleware.
export const PUBLIC_FILES = Object.freeze([
  'index.html',
  'signature.html',
  'app.js',
  'editor.css',
  'signature-core.js',
  'editor-history.js',
  'signature-image.js',
  'session-data.js',
  'session-controls.js',
  'signature-only.html',
  'portrait-core.js',
  'portrait-controls.js',
  'portrait-worker.js',
  'portrait.css',
  'design-collections.js',
  'ai-extension-core.js',
  'ai-extension-controls.js',
  'ai-extension.css',
  'library-controls.js',
  'library.css',
  'artwork-core.js',
  'artwork-controls.js',
  'artwork.css',
  'sig/pattern-cutpaper-wide.png',
  'sig/pattern-cutpaper-tall.png',
  'sig/pattern-colorfield-wide.png',
  'sig/pattern-colorfield-tall.png',
  'sig/pattern-chromatic-wide.png',
  'sig/pattern-chromatic-tall.png',
  'sig/pattern-counterform-wide.png',
  'sig/pattern-counterform-tall.png',
  'sig/pattern-overprint-wide.png',
  'sig/pattern-overprint-tall.png',
  'sig/pattern-gesture-wide.png',
  'sig/pattern-gesture-tall.png',
  'vendor/pico.js',
  'vendor/facefinder.bin',
  'vendor/PICO-LICENSE.txt',
  'sig/dots.png',
  'sig/pattern-cutpaper.png',
  'sig/pattern-colorfield.png',
  'sig/pattern-chromatic.png',
  'sig/pattern-counterform.png',
  'sig/pattern-overprint.png',
  'sig/pattern-gesture.png',
  'sig/pattern-neural.png',
  'sig/pattern-latent.png',
  'sig/pattern-tokenweave.png',
  'sig/pattern-resonance.png',
  'sig/pattern-galaxy.png',
  'sig/pattern-starlight.png',
  'sig/pattern-moonlight.png',
  'sig/pattern-frost.png',
  'sig/icon-mail.png',
  'sig/icon-phone.png',
  'sig/icon-linkedin.png',
  'sig/icon-pin.png',
  'sig/icon-web.png',
  'sig/icon-mail-dark.png',
  'sig/icon-phone-dark.png',
  'sig/icon-linkedin-dark.png',
  'sig/icon-pin-dark.png',
  'sig/icon-web-dark.png',
  'sig/pattern-orbit.png',
  'sig/pattern-studio.png',
  'sig/pattern-contour.png',
  'sig/pattern-prism.png',
  'sig/pattern-editorial.png',
  'sig/pattern-signal.png',
]);

const allowed = new Set(PUBLIC_FILES);

export async function readPublicFile(projectRoot, name) {
  if (!allowed.has(name)) throw new Error('File is not public.');
  const root = await realpath(projectRoot);
  const requested = resolve(root, name);
  const actual = await realpath(requested);
  const normalized = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalized(actual) !== normalized(requested)) {
    throw new Error('Public files must not use symbolic links.');
  }
  const pathWithinRoot = relative(root, actual);
  if (pathWithinRoot.startsWith(`..${sep}`) || pathWithinRoot === '..') {
    throw new Error('File is outside the project.');
  }
  const stat = await lstat(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected a regular public file.');
  return readFile(actual);
}

export function requestedPublicFile(rawUrl) {
  let pathname;
  try { pathname = decodeURIComponent((rawUrl || '/').split('?')[0]); }
  catch { return null; }
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0')) return null;
  if (pathname.split('/').some(part => part === '.' || part === '..')) return null;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  return allowed.has(name) ? name : null;
}
