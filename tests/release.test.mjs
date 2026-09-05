import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';
import { PUBLIC_FILES, requestedPublicFile } from '../scripts/public-files.mjs';
import { createPublicServer } from '../scripts/serve.mjs';
import { buildSite } from '../scripts/build.mjs';

const scratchRoot = fileURLToPath(new URL('../.test-tmp/', import.meta.url));

async function fixture(t) {
  await mkdir(scratchRoot, { recursive: true });
  const root = await mkdtemp(join(scratchRoot, 'release-'));
  t.after(async () => {
    const actualScratch = await realpath(scratchRoot);
    const actualRoot = await realpath(root);
    assert.equal(dirname(actualRoot), actualScratch, 'cleanup stays within test scratch directory');
    await rm(actualRoot, { recursive: true, force: true });
  });
  for (const name of PUBLIC_FILES) {
    const target = join(root, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `public:${name}`);
  }
  for (const name of ['.git/config', '.private/profile.json', 'README.md', 'PROGRESS.md', 'personal.local.json', 'sig/private.json', 'sig/extra.png']) {
    const target = join(root, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, 'PRIVATE_FIXTURE_SENTINEL');
  }
  return root;
}

function get(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('public routes reject private paths and encoded traversal', () => {
  assert.equal(requestedPublicFile('/'), 'index.html');
  assert.equal(requestedPublicFile('/app.js?v=1'), 'app.js');
  for (const path of [
    '/.git/config', '/.private/profile.json', '/README.md', '/PROGRESS.md',
    '/personal.local.json', '/sig/private.json', '/sig/extra.png',
    '/../index.html', '/%2e%2e/index.html', '/sig/../app.js',
    '/sig%5c..%5capp.js', '/%00app.js', '/%zz', '//index.html',
  ]) assert.equal(requestedPublicFile(path), null, path);
});

test('server serves the demo and PNGs but cannot expose repository or private files', async t => {
  const root = await fixture(t);
  const server = createPublicServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const port = server.address().port;
  const page = await get(port, '/');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.equal(page.body, 'public:index.html');
  assert.equal((await get(port, '/app.js?cache=123')).body, 'public:app.js');
  assert.equal((await get(port, '/sig/dots.png')).headers['content-type'], 'image/png');
  const head = await get(port, '/index.html', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal((await get(port, '/', 'POST')).status, 405);
  for (const path of ['/.git/config', '/.private/profile.json', '/README.md', '/PROGRESS.md', '/personal.local.json', '/sig/extra.png', '/sig/', '/%2e%2e/index.html']) {
    const result = await get(port, path);
    assert.equal(result.status, 404, path);
    assert.doesNotMatch(result.body, /PRIVATE_FIXTURE_SENTINEL/);
  }
});

test('build contains exactly the public files and removes stale output', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist', 'old-private-file.json'), 'PRIVATE_FIXTURE_SENTINEL');
  const result = await buildSite(root);
  assert.equal(result.count, PUBLIC_FILES.length);
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else files.push(relative(result.output, absolute).replaceAll('\\', '/'));
    }
  }
  await walk(result.output);
  assert.deepEqual(files.sort(), [...PUBLIC_FILES].sort());
  for (const name of files) assert.equal(await readFile(join(result.output, name), 'utf8'), `public:${name}`);
});

test('missing public source fails before replacing a previous build', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist', 'existing.html'), 'previous good build');
  await rm(join(root, 'app.js'));
  await assert.rejects(buildSite(root));
  assert.equal(await readFile(join(root, 'dist', 'existing.html'), 'utf8'), 'previous good build');
});

test('symlinked public files cannot escape the allowlist', async t => {
  const root = await fixture(t);
  await rm(join(root, 'app.js'));
  try { await symlink(join(root, '.private', 'profile.json'), join(root, 'app.js')); }
  catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') { t.skip('This account cannot create symlinks; covered on Linux CI.'); return; }
    throw error;
  }
  await assert.rejects(buildSite(root), /symbolic links/);
  const server = createPublicServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const result = await get(server.address().port, '/app.js');
  assert.equal(result.status, 404);
  assert.doesNotMatch(result.body, /PRIVATE_FIXTURE_SENTINEL/);
});
