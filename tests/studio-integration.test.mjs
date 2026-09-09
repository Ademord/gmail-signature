// Independent release/data checks. These run Node code and an HTTP server;
// they do not prove browser clipboard permission, native saving, or Gmail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import signature from '../signature-core.js';
import session from '../session-data.js';
import { PUBLIC_FILES, requestedPublicFile } from '../scripts/public-files.mjs';
import { buildSite } from '../scripts/build.mjs';
import { createPublicServer } from '../scripts/serve.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(join(project, name));
const designs = ['original', 'orbit', 'studio', 'contour', 'prism', 'editorial', 'signal'];
// Deliberately fixed independently of core.defaults: removing an old supported
// field from the implementation must not remove it from this migration test.
const legacyDraft = {
  nameLine1: 'Zoë', nameLine2: 'Arden', title: 'Designer', subtitle: 'ART & CODE',
  website: 'https://example.com/work', websiteLabel: 'Selected work', email: 'zoe@example.com',
  phone: '+41 22 123 45 67', linkedin: 'https://www.linkedin.com/in/example/',
  location: 'Geneva, Switzerland', tags: 'DESIGN · SYSTEMS', width: 420, height: 320,
  layout: 'stacked', accent: '#456789', frontBackground: '#faf0e1', backBackground: '#202828',
  websiteIcon: 'mail', emailIcon: 'web', phoneIcon: 'none', linkedinIcon: 'linkedin',
  locationIcon: 'pin', imageBase: 'https://example.com/signature-assets'
};
const savedTheme = {
  id: 'theme-legacy', name: 'Slate (imported)', importedFromName: 'Slate',
  frontBackground: '#f0f0e0', backBackground: '#101b2c', accent: '#657483'
};
const oldUI = {
  editorTab: 'colors', previewView: 'email', imageScale: 6, imageBackground: 'white',
  selectedThemeId: 'theme-legacy', themeName: 'Crème'
};
const envelope = draft => ({
  format: 'signature-editor-session', version: 1, exportedAt: '2026-09-05T12:00:00.000Z',
  draft, themes: [savedTheme], ui: oldUI
});

test('a pre-studio 23-field session preserves every old field, theme provenance, and UI setting', () => {
  assert.equal(Object.keys(legacyDraft).length, 23);
  const restored = session.parse(JSON.stringify(envelope(legacyDraft)));
  for (const [key, value] of Object.entries(legacyDraft)) assert.equal(restored.draft[key], value, key);
  assert.deepEqual(restored.themes, [savedTheme]);
  assert.deepEqual(restored.ui, oldUI);
  assert.deepEqual(Object.fromEntries(['design', 'pattern', 'portraitData', 'portraitUrl', 'portraitShape', 'portraitSize'].map(key => [key, restored.draft[key]])), {
    design: 'original', pattern: 'auto', portraitData: '', portraitUrl: '', portraitShape: 'circle', portraitSize: 64
  });
  assert.deepEqual(Object.fromEntries(['artworkPlacement','artworkScale','artworkPositionX','artworkPositionY'].map(key=>[key,restored.draft[key]])), {
    artworkPlacement:'auto',artworkScale:100,artworkPositionX:50,artworkPositionY:50
  });
  assert.deepEqual(Object.fromEntries(['motifScale','motifPositionX','motifPositionY'].map(key=>[key,restored.draft[key]])), {
    motifScale:100,motifPositionX:50,motifPositionY:0
  });
  const again = session.parse(session.serialize(restored));
  assert.deepEqual(again, restored);
  assert.match(signature.render(again.draft), /href="mailto:zoe@example.com"/);
  assert.match(signature.render(again.draft), /signature-assets\/icon-mail\.png/);
  assert.doesNotMatch(signature.render(again.draft), /icon-phone\.png/);
});

test('every named design round-trips photo bytes, independent pattern, legacy details, and selected theme', async () => {
  const photo = 'data:image/png;base64,' + (await read('sig/icon-web.png')).toString('base64');
  for (const design of designs) {
    const draft = { ...legacyDraft, design, pattern: 'contour', customLayout:'', customPattern:'',
      artworkPlacement:'auto',artworkScale:100,artworkPositionX:50,artworkPositionY:50,motifScale:73,motifPositionX:18,motifPositionY:86,portraitData: photo,
      portraitUrl: 'https://example.com/cropped-photo.png?v=2', portraitShape: 'rounded', portraitSize: 96 };
    const input = { draft, themes: [savedTheme], ui: { ...oldUI, editorTab: 'photo' } };
    const text = session.serialize(input), restored = session.parse(text);
    assert.deepEqual(restored, input, design);
    assert.equal(Buffer.byteLength(text) < 1024 * 1024, true);
    assert.ok(signature.render(restored.draft, { preview: true }).includes(photo), design);
    const email = signature.render(restored.draft);
    assert.match(email, /src="https:\/\/example.com\/cropped-photo\.png\?v=2"/);
    assert.doesNotMatch(email, /data:image/);
    assert.match(email, /pattern-contour\.png/);
    const merged = session.mergeThemes([savedTheme], restored.themes, restored.ui.selectedThemeId);
    assert.equal(merged.added, 0); assert.equal(merged.selectedThemeId, savedTheme.id);
    assert.deepEqual(merged.themes, [savedTheme]);
  }
});

test('restored data-only photos remain exportable backups and fail email HTML explicitly for every named design', async () => {
  const photo = 'data:image/png;base64,' + (await read('sig/icon-web.png')).toString('base64');
  for (const design of designs) {
    const draft = { ...legacyDraft, design, pattern: 'none', portraitData: photo,
      portraitUrl: '', portraitShape: 'square', portraitSize: 40 };
    const restored = session.parse(session.serialize({ draft }));
    assert.equal(restored.draft.portraitData, photo);
    assert.throws(() => signature.render(restored.draft), error =>
      /public HTTPS URL/.test(error.message) && typeof error.errors?.portraitUrl === 'string', design);
    assert.ok(signature.render(restored.draft, { allowPortraitData: true }).includes(photo), design);
    assert.match(signature.plainText(restored.draft), /Zoë Arden/);
    assert.doesNotMatch(signature.plainText(restored.draft), /base64|data:image/);
  }
});

// Independent expected delivery roster: an accidentally removed model, license,
// entry point, or pattern must fail even if the implementation allowlist shrinks.
const expectedPublicFiles = [
  'index.html', 'signature.html', 'app.js', 'editor.css', 'signature-core.js',
  'editor-history.js', 'signature-image.js', 'session-data.js', 'session-controls.js',
  'signature-only.html', 'portrait-core.js', 'portrait-controls.js', 'portrait-worker.js', 'portrait.css',
  'design-collections.js', 'ai-extension-core.js', 'ai-extension-controls.js', 'ai-extension.css',
  'library-controls.js', 'library.css',
  'artwork-core.js', 'artwork-controls.js', 'artwork.css',
  'vendor/pico.js', 'vendor/facefinder.bin', 'vendor/PICO-LICENSE.txt',
  'sig/dots.png', 'sig/icon-mail.png', 'sig/icon-phone.png', 'sig/icon-linkedin.png',
  'sig/icon-pin.png', 'sig/icon-web.png', 'sig/icon-mail-dark.png', 'sig/icon-phone-dark.png',
  'sig/icon-linkedin-dark.png', 'sig/icon-pin-dark.png', 'sig/icon-web-dark.png',
  'sig/pattern-orbit.png', 'sig/pattern-studio.png', 'sig/pattern-contour.png',
  'sig/pattern-prism.png', 'sig/pattern-editorial.png', 'sig/pattern-signal.png',
  'sig/pattern-galaxy.png', 'sig/pattern-starlight.png', 'sig/pattern-moonlight.png', 'sig/pattern-frost.png',
  'sig/pattern-neural.png', 'sig/pattern-latent.png', 'sig/pattern-tokenweave.png', 'sig/pattern-resonance.png',
  'sig/pattern-cutpaper.png', 'sig/pattern-colorfield.png', 'sig/pattern-chromatic.png',
  'sig/pattern-counterform.png', 'sig/pattern-overprint.png', 'sig/pattern-gesture.png',
  'sig/pattern-cutpaper-wide.png', 'sig/pattern-cutpaper-tall.png',
  'sig/pattern-colorfield-wide.png', 'sig/pattern-colorfield-tall.png',
  'sig/pattern-chromatic-wide.png', 'sig/pattern-chromatic-tall.png',
  'sig/pattern-counterform-wide.png', 'sig/pattern-counterform-tall.png',
  'sig/pattern-overprint-wide.png', 'sig/pattern-overprint-tall.png',
  'sig/pattern-gesture-wide.png', 'sig/pattern-gesture-tall.png'
];

async function sourceFixture(t) {
  const scratch = join(project, '.test-tmp');
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'studio-release-'));
  t.after(async () => {
    const actualRoot = await realpath(root), actualScratch = await realpath(scratch);
    assert.equal(dirname(actualRoot), actualScratch, 'cleanup remains inside the test workspace');
    await rm(actualRoot, { recursive: true, force: true });
  });
  for (const name of expectedPublicFiles) {
    const target = join(root, name); await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await read(name));
  }
  for (const name of ['.private/portrait.png', 'tests/fixtures/astronaut.png', 'docs/private-review.md', '.git/config']) {
    const target = join(root, name); await mkdir(dirname(target), { recursive: true });
    await writeFile(target, 'PRIVATE_RELEASE_FIXTURE_SENTINEL');
  }
  return root;
}

test('actual public build retains the complete reviewed runtime and excludes test photos, private files, and docs', async t => {
  assert.equal(expectedPublicFiles.length, 69);
  assert.deepEqual([...PUBLIC_FILES].sort(), [...expectedPublicFiles].sort());
  const root = await sourceFixture(t), { output } = await buildSite(root), files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else files.push(relative(output, target).replaceAll('\\', '/'));
    }
  }
  await walk(output);
  assert.deepEqual(files.sort(), [...expectedPublicFiles].sort());
  for (const name of files) assert.deepEqual(await readFile(join(output, name)), await read(name), name);
  const html = await readFile(join(output, 'index.html'), 'utf8');
  assert.equal(html, await readFile(join(output, 'signature.html'), 'utf8'));
  for (const [, source] of html.matchAll(/(?:src|href)="((?:\.\/)?[^"#?:]+\.(?:js|css))(?:\?[^"#]*)?"/g)) {
    assert.ok(files.includes(source.replace(/^\.\//, '')), source + ' is in the downloadable site');
  }
  const model = await readFile(join(output, 'vendor/facefinder.bin'));
  assert.equal(model.length, 239632);
  assert.equal(createHash('sha256').update(model).digest('hex'), 'd8014993e7298c7b1865d1f8b855d6dbf4ec5c808bf879e2091ab6837abf90cd');
  const runtime = await readFile(join(output, 'vendor/pico.js'));
  assert.equal(createHash('sha256').update(runtime).digest('hex'), '785b981cc79e5fa3f7557dc3fa7773629d7529994d7627de41b77d8687649309');
  const license = await readFile(join(output, 'vendor/PICO-LICENSE.txt'), 'utf8');
  assert.match(license, /Copyright \(c\) 2013 Nenad Markus/);
  assert.match(license, /The above copyright notice and this permission notice shall be included/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});

test('real server exposes local model and license while denying fixture and review routes', async t => {
  const server = createPublicServer(project);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const [name, mime] of [['vendor/facefinder.bin', 'application/octet-stream'], ['vendor/pico.js', 'text/javascript'], ['vendor/PICO-LICENSE.txt', 'text/plain'], ['portrait-worker.js', 'text/javascript']]) {
    const response = await fetch(base + '/' + name);
    assert.equal(response.status, 200, name);
    assert.ok(response.headers.get('content-type').startsWith(mime), name);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await read(name), name);
  }
  for (const path of ['/tests/fixtures/astronaut.png', '/docs/design-artwork.png', '/docs/reviews/release-2026-09-07.md', '/.private/session.json', '/tests/../index.html', '/tests/%2e%2e/index.html']) {
    assert.equal(requestedPublicFile(path), null, path);
    // fetch normalizes dot paths before sending; route rejection is checked
    // directly above and encoded traversal is covered by raw HTTP release tests.
    if (path.includes('..') || path.includes('%2e')) continue;
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});
