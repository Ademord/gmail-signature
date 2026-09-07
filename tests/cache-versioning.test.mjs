import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { PUBLIC_FILES } from '../scripts/public-files.mjs';
import { versionAssets } from '../scripts/version-assets.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(join(project, name));
// This fixed editor contract does not shrink if the generator or HTML omits an asset.
const expectedEditorAssets = [
  'editor.css', 'portrait.css', 'ai-extension.css', 'library.css',
  'portrait-core.js', 'signature-core.js', 'editor-history.js', 'signature-image.js',
  'session-data.js', 'session-controls.js', 'portrait-controls.js', 'design-collections.js',
  'ai-extension-core.js', 'ai-extension-controls.js', 'library-controls.js', 'app.js',
];

function inspectEditor(html) {
  const urls = [...html.matchAll(/\b(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^"#]*)?)"/g)].map(match => match[1]);
  assert.equal(urls.length, 16, 'every required script and stylesheet stays linked');
  assert.deepEqual(urls.map(url => url.split('?')[0]).sort(), [...expectedEditorAssets].sort());
  const versions = urls.map(url => {
    assert.match(url, /^[^?]+\?v=[a-f0-9]{16}$/, url + ' must have the content version');
    return url.split('?v=')[1];
  });
  assert.equal(new Set(versions).size, 1, 'the editor loads one coherent runtime generation');
  return versions[0];
}

async function fixture(t) {
  const scratch = join(project, '.test-tmp');
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'cache-versioning-'));
  t.after(async () => {
    const actualRoot = await realpath(root), actualScratch = await realpath(scratch);
    assert.equal(dirname(actualRoot), actualScratch, 'cleanup stays in test scratch');
    await rm(actualRoot, { recursive: true, force: true });
  });
  for (const name of [...PUBLIC_FILES, 'scripts/public-files.mjs', 'scripts/version-assets.mjs']) {
    const target = join(root, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await read(name));
  }
  return root;
}

test('both committed editors version the independently required sixteen runtime links', async () => {
  const index = (await read('index.html')).toString(), alternate = (await read('signature.html')).toString();
  assert.equal(index, alternate);
  const version = inspectEditor(index);
  assert.equal(await versionAssets(project, { check: true }), version);
  // A missing app link must fail this independent contract, even if versioning
  // the remaining links would appear internally consistent.
  const missingApp = index.replace(/<script src="app\.js[^\"]*"[^>]*><\/script>/, '');
  assert.throws(() => inspectEditor(missingApp), /every required script/);
});

test('the real CLI rejects a changed source before rewriting HTML and regeneration repairs both editors', async t => {
  const root = await fixture(t);
  const before = await versionAssets(root);
  const oldIndex = await readFile(join(root, 'index.html')), oldAlternate = await readFile(join(root, 'signature.html'));
  await writeFile(join(root, 'app.js'), Buffer.concat([await readFile(join(root, 'app.js')), Buffer.from('\n// independent stale-source mutation\n')]));
  const command = spawnSync(process.execPath, ['scripts/version-assets.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(command.status, 1, command.stdout + command.stderr);
  assert.match(command.stderr, /Stale editor asset versions/);
  assert.deepEqual(await readFile(join(root, 'index.html')), oldIndex);
  assert.deepEqual(await readFile(join(root, 'signature.html')), oldAlternate);
  const after = await versionAssets(root);
  assert.notEqual(after, before, 'changed runtime cannot reuse the old browser-cache key');
  assert.equal(inspectEditor(await readFile(join(root, 'index.html'), 'utf8')), after);
  assert.equal(await readFile(join(root, 'index.html'), 'utf8'), await readFile(join(root, 'signature.html'), 'utf8'));
  assert.equal(spawnSync(process.execPath, ['scripts/version-assets.mjs', '--check'], { cwd: root, encoding: 'utf8' }).status, 0);
});

test('content versions are stable across Windows CRLF and Linux LF checkouts', async t => {
  const root = await fixture(t);
  for (const name of PUBLIC_FILES.filter(name => /\.(?:js|css)$/.test(name))) {
    const text = (await read(name)).toString().replace(/\r\n/g, '\n');
    await writeFile(join(root, name), text.replace(/\n/g, '\r\n'));
  }
  const windowsVersion = await versionAssets(root);
  for (const name of PUBLIC_FILES.filter(name => /\.(?:js|css)$/.test(name))) {
    const text = (await readFile(join(root, name))).toString().replace(/\r\n/g, '\n');
    await writeFile(join(root, name), text);
  }
  assert.equal(await versionAssets(root, { check: true }), windowsVersion);
});

test('detector dependencies and image bytes also invalidate the editor runtime generation', async t => {
  const root = await fixture(t);
  let previous = await versionAssets(root);
  for (const name of ['portrait-worker.js', 'vendor/pico.js', 'vendor/facefinder.bin', 'sig/pattern-frost.png']) {
    const changed = await readFile(join(root, name));
    changed[changed.length - 1] ^= 1;
    await writeFile(join(root, name), changed);
    await assert.rejects(versionAssets(root, { check: true }), /Stale editor asset versions/, name);
    const next = await versionAssets(root);
    assert.notEqual(next, previous, name + ' must invalidate cached dependencies');
    previous = next;
  }
});

test('photo detection retains the script version after currentScript clears and forwards it to the worker', async () => {
  for (const query of ['?v=0123456789abcdef', '']) {
    const requests = [];
    const document = {
      currentScript: { src: 'https://example.test/studio/portrait-core.js' + query },
      createElement: () => ({ width: 1, height: 1, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8Array([0, 0, 0, 255]) }) }) }),
    };
    class Worker {
      constructor(url) { requests.push(url); }
      terminate() {}
      postMessage() { queueMicrotask(() => this.onmessage({ data: { faces: [] } })); }
    }
    const context = vm.createContext({ module: { exports: {} }, document, Worker, URL, setTimeout, clearTimeout });
    vm.runInContext((await read('portrait-core.js')).toString(), context);
    document.currentScript = null;
    const faces = await context.module.exports.detect({ width: 1, height: 1 });
    assert.equal(faces.length, 0);
    assert.deepEqual(requests, ['portrait-worker.js' + query]);
  }
});

test('the actual worker forwards its release query to Pico and the model with local-only fetch policy', async () => {
  for (const query of ['?v=0123456789abcdef', '']) {
    const imports = [], requests = [], messages = [];
    const self = { location: { search: query }, postMessage: value => messages.push(value) };
    const context = vm.createContext({
      self, AbortSignal,
      importScripts: url => imports.push(url),
      fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, arrayBuffer: async () => new ArrayBuffer(239632) }; },
      pico: { unpack_cascade: () => ({}), run_cascade: () => [], cluster_detections: () => [] },
    });
    vm.runInContext((await read('portrait-worker.js')).toString(), context);
    await self.onmessage({ data: { width: 32, height: 32, pixels: new Uint8Array(1024) } });
    assert.deepEqual(imports, ['vendor/pico.js' + query]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'vendor/facefinder.bin' + query);
    assert.equal(requests[0].options.credentials, 'omit');
    assert.equal(messages[0].error, undefined);
    assert.equal(messages[0].faces.length, 0);
  }
});
