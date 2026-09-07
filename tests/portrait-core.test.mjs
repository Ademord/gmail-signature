import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import vm from 'node:vm';
import portrait from '../portrait-core.js';
import signature from '../signature-core.js';
import session from '../session-data.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url));
const photo = 'data:image/png;base64,' + read('sig/icon-web.png').toString('base64');
const values = patch => ({...signature.defaults, ...patch});

// The official fixture is an 8-bit RGB PNG. Decode its actual pixels with Node
// built-ins so this detector regression needs neither a browser nor npm packages.
function fixturePixels() {
  const png = read('tests/fixtures/astronaut.png');
  assert.equal(createHash('sha256').update(png).digest('hex'), '88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5');
  let width, height, bpp;
  const chunks = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      assert.equal(body[8], 8); assert.equal(body[9], 2); assert.equal(body[12], 0); bpp = 3;
    }
    if (type === 'IDAT') chunks.push(body);
    at += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(chunks)), stride = width * bpp;
  const rgb = Buffer.alloc(width * height * bpp);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= bpp ? rgb[i - bpp] : 0;
      const b = y ? rgb[i - stride] : 0, c = y && x >= bpp ? rgb[i - stride - bpp] : 0;
      rgb[i] = (inflated[y * (stride + 1) + x + 1] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
    }
  }
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.round(.299 * rgb[i * 3] + .587 * rgb[i * 3 + 1] + .114 * rgb[i * 3 + 2]);
  return {width, height, pixels};
}

async function runWorker(data, model = read('vendor/facefinder.bin')) {
  const messages = [], requests = [];
  const context = vm.createContext({AbortSignal, self: {postMessage: result => messages.push(result)},
    fetch: async (url, options) => {requests.push({url, options}); return {ok: true, arrayBuffer: async () => Uint8Array.from(model).buffer};}});
  context.importScripts = file => vm.runInContext(read(file).toString(), context, {filename: file});
  vm.runInContext(read('portrait-worker.js').toString(), context, {filename: 'portrait-worker.js'});
  await context.self.onmessage({data});
  return {result: JSON.parse(JSON.stringify(messages[0])), requests};
}

test('actual bundled model finds the known astronaut face and smart crop encloses it', async t => {
  const fixture = fixturePixels(), {result, requests} = await runWorker(fixture);
  assert.equal(result.error, undefined);
  const known = {x: 175, y: 60, width: 105, height: 115};
  const face = result.faces.find(face => {
    const cx = face.x + face.width / 2, cy = face.y + face.height / 2;
    return cx >= known.x && cx <= known.x + known.width && cy >= known.y && cy <= known.y + known.height;
  });
  assert.ok(face, 'Detector must find the real face, not just any false positive: ' + JSON.stringify(result));
  assert.ok(face.width >= 60 && face.width <= 150, JSON.stringify(face));
  const crop = portrait.crop(fixture.width, fixture.height, portrait.frame(fixture.width, fixture.height, face));
  assert.ok(crop.x <= known.x && crop.y <= known.y && crop.x + crop.size >= known.x + known.width && crop.y + crop.size >= known.y + known.height, JSON.stringify({face, crop}));
  assert.equal(requests.length, 1); assert.equal(requests[0].url, 'vendor/facefinder.bin');
  assert.equal(requests[0].options.credentials, 'omit');
  t.diagnostic(JSON.stringify({face, crop}));
});

test('actual detector finds two different-sized faces and presents the larger one first', async () => {
  const original = fixturePixels(), width = 640, height = 512, pixels = new Uint8Array(width * height).fill(255);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) pixels[y * width + x] = original.pixels[y * 512 + x];
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pixels[y * width + 384 + x] = original.pixels[y * 2 * 512 + x * 2];
  const {result} = await runWorker({width, height, pixels});
  const big = result.faces.find(f => f.x + f.width / 2 > 175 && f.x + f.width / 2 < 280 && f.y + f.height / 2 < 175);
  const small = result.faces.find(f => f.x + f.width / 2 > 465 && f.x + f.width / 2 < 530 && f.y + f.height / 2 < 95);
  assert.ok(big && small, JSON.stringify(result)); assert.ok(big.width > small.width * 1.5);
  for (let i = 1; i < result.faces.length; i++) assert.ok(result.faces[i - 1].width >= result.faces[i].width);
});

test('actual detector returns no face on a flat image and rejects malformed worker input and model', async () => {
  const flat = await runWorker({width: 128, height: 128, pixels: new Uint8Array(128 * 128).fill(127)});
  assert.deepEqual(flat.result.faces, []);
  for (const data of [{width: 641, height: 1, pixels: new Uint8Array(641)}, {width: 2, height: 2, pixels: new Uint8Array(3)}, {width: NaN, height: 2, pixels: new Uint8Array(4)}]) {
    const response = await runWorker(data); assert.match(response.result.error, /Invalid detection image/); assert.equal(response.requests.length, 0);
  }
  assert.match((await runWorker({width: 32, height: 32, pixels: new Uint8Array(1024)}, new Uint8Array(3))).result.error, /incomplete/);
});

test('crop geometry remains finite and within the source over numeric boundaries', () => {
  for (const [width, height] of [[1, 1], [1, 1800], [1800, 1], [512, 512], [1800, 1234]]) {
    for (const zoom of [-2, 0, 1, 1.01, 6, 8, NaN, Infinity]) for (const x of [-100, 0, 50, 100, 300, NaN, Infinity]) for (const y of [-100, 0, 50, 100, 300, NaN, Infinity]) {
      const c = portrait.crop(width, height, {zoom, x, y});
      assert.ok(Object.values(c).every(Number.isFinite));
      assert.ok(c.size > 0 && c.x >= 0 && c.y >= 0 && c.x + c.size <= width + 1e-9 && c.y + c.size <= height + 1e-9);
    }
    for (const face of [null, {x: 1, y: 1, width: NaN, height: 1}, {x: -2000, y: 4000, width: 999, height: 999}]) {
      const c = portrait.crop(width, height, portrait.frame(width, height, face));
      assert.ok(Object.values(c).every(Number.isFinite)); assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.size <= width + 1e-9 && c.y + c.size <= height + 1e-9);
    }
  }
  for (const dimensions of [[0, 1], [-1, 5], [Infinity, 10], [5, NaN]]) assert.throws(() => portrait.crop(...dimensions));
});

test('file intake rejects unsupported, empty, malformed and oversized input', async () => {
  for (const file of [null, {type: 'image/svg+xml', size: 9}, {type: 'image/gif', size: 9}, {type: 'image/png', size: 0}, {type: 'image/jpeg', size: Infinity}, {type: 'image/jpeg', size: portrait.MAX_FILE_BYTES + 1}]) assert.throws(() => portrait.checkFile(file));
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.doesNotThrow(() => portrait.checkFile({type, size: portrait.MAX_FILE_BYTES}));
  for (const scenario of ['malformed', 'huge']) {
    const revoked = [];
    const context = {module: {exports: {}}, setTimeout, clearTimeout,
      URL: {createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url)},
      Image: class {set src(value) {if (!value) return; queueMicrotask(() => {if (scenario === 'malformed') this.onerror(); else {this.naturalWidth = 10000; this.naturalHeight = 10000; this.onload();}});}}};
    vm.runInNewContext(read('portrait-core.js').toString(), context);
    await assert.rejects(context.module.exports.load({type: 'image/png', size: 10}), scenario === 'malformed' ? /could not be opened/ : /60 megapixels/);
    assert.deepEqual(revoked, ['blob:test']);
  }
});

test('local portrait session round trip and legacy migration preserve supported data', () => {
  const draft = values({portraitData: photo, portraitShape: 'rounded', portraitSize: 96, design: 'studio'});
  const restored = session.parse(session.serialize({draft, ui: {editorTab: 'photo'}}));
  assert.deepEqual(restored.draft, signature.normalize(draft)); assert.equal(restored.ui.editorTab, 'photo');
  const legacy = {...signature.defaults}; for (const key of ['design', 'pattern', 'portraitData', 'portraitUrl', 'portraitShape', 'portraitSize']) delete legacy[key];
  const migrated = session.parse(JSON.stringify(legacy));
  assert.equal(migrated.draft.design, 'original'); assert.equal(migrated.draft.portraitData, ''); assert.equal(migrated.draft.portraitSize, 64);
});

test('session validation rejects truncated or header-only inline images', () => {
  for (const portraitData of ['data:image/jpeg;base64,/9j/', 'data:image/png;base64,iVBORw0KGgo=', 'data:image/jpeg;base64,/9j/2Q==']) {
    assert.equal(typeof signature.validate(values({portraitData})).portraitData, 'string', portraitData);
    assert.throws(() => session.serialize({draft: values({portraitData})}));
  }
});

function controlsHarness(coreOverrides = {}) {
  const nodes = new Map(), images = [], writes = [];
  let draft = values({portraitData: photo}), api;
  const source = read('portrait-controls.js').toString();
  for (const match of source.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], {id: match[1], value: '', checked: false, hidden: false, dataset: {}, style: {}, events: {},
    addEventListener(type, fn) {this.events[type] = fn;}, replaceChildren() {}, removeAttribute(key) {delete this[key];}, setPointerCapture() {}});
  nodes.set('portrait-panel-content', {});
  nodes.get('portrait-editor').hidden = true;
  const get = id => {assert.ok(nodes.has(id), id); return nodes.get(id);};
  const context = {window: {SignatureCore: signature, PortraitCore: {load: async () => ({width: 512, height: 512}), detect: async () => [], frame: portrait.frame, crop: portrait.crop, draw() {}, encode: () => photo, ...coreOverrides}},
    document: {getElementById: get, createElement: () => ({})}, Blob, atob, Uint8Array, Image: class {constructor() {images.push(this);}}, setTimeout: () => 1, clearTimeout() {}};
  vm.runInNewContext(source, context, {filename: 'portrait-controls.js'});
  api = context.window.PortraitControls.attach({getDraft: () => ({...draft}), setPortrait: patch => {writes.push(patch); draft = {...draft, ...patch}; api?.sync();}});
  return {get, images, writes, api, draft: () => draft, restore: patch => {draft = values(patch); api.sync();}, emit: (id, type) => get(id).events[type]({})};
}

test('saved crop can be reopened after reload without recropping until Apply', async () => {
  let opened;
  const h = controlsHarness({load: async file => {opened=file; return {width:384,height:384};},detect:async()=>[{x:100,y:80,width:100,height:100}]});
  await h.emit('portrait-edit','click');
  assert.equal(opened.type,'image/png'); assert.ok(opened.size>100);
  assert.equal(h.get('portrait-editor').hidden,false); assert.equal(Number(h.get('portrait-zoom').value),1);
  assert.match(h.get('portrait-notice').textContent,/saved crop/); assert.equal(h.writes.length,0);
  await h.emit('portrait-apply','click'); assert.equal(h.draft().portraitData,photo); assert.equal(h.writes.length,1);
});

test('late hosted-photo response cannot overwrite a newer applied crop', async () => {
  const h = controlsHarness(); h.get('portrait-file').files = [{type: 'image/png', size: 100}];
  await h.emit('portrait-file', 'change');
  h.get('portrait-public-url').value = 'https://example.com/old.jpg';
  const pending = h.emit('portrait-use-url', 'click');
  await h.emit('portrait-apply', 'click');
  assert.equal(h.draft().portraitData, photo);
  h.images[0].naturalWidth = 100; h.images[0].naturalHeight = 100; h.images[0].onload(); await pending;
  assert.equal(h.draft().portraitData, photo); assert.equal(h.draft().portraitUrl, '');
});

test('late hosted-photo response cannot overwrite restored session state', async () => {
  const h = controlsHarness(); h.get('portrait-public-url').value = 'https://example.com/old.jpg';
  const pending = h.emit('portrait-use-url', 'click');
  h.restore({portraitUrl: 'https://example.com/restored.jpg'});
  h.images[0].naturalWidth = 100; h.images[0].naturalHeight = 100; h.images[0].onload(); await pending;
  assert.equal(h.draft().portraitUrl, 'https://example.com/restored.jpg');
});

test('changing portrait shape during file loading keeps the selected upload', async () => {
  let finish;
  const h = controlsHarness({load: () => new Promise(resolve => {finish = resolve;})});
  h.get('portrait-file').files = [{type: 'image/png', size: 100}];
  const pending = h.emit('portrait-file', 'change');
  h.get('portrait-shape-control').value = 'square'; await h.emit('portrait-shape-control', 'change');
  finish({width: 512, height: 512}); await pending;
  assert.equal(h.get('portrait-editor').hidden, false, 'Photo load must not be discarded by an independent shape change');
  assert.doesNotMatch(h.get('portrait-notice').textContent, /Opening/);
});

test('changing portrait size during detection preserves the smart crop result', async () => {
  let finish;
  const h = controlsHarness({detect: () => new Promise(resolve => {finish = resolve;})});
  h.get('portrait-file').files = [{type: 'image/png', size: 100}];
  const pending = h.emit('portrait-file', 'change'); await new Promise(setImmediate);
  h.get('portrait-size-control').value = '80'; await h.emit('portrait-size-control', 'change');
  finish([{x: 190, y: 70, width: 100, height: 100}]); await pending;
  assert.ok(Number(h.get('portrait-zoom').value) > 1, 'Smart face crop must still run');
  assert.match(h.get('portrait-notice').textContent, /Face framed/);
});

test('newer selected upload wins out-of-order image loading', async () => {
  const completions = {}, drawn = [];
  const h = controlsHarness({load: file => new Promise(resolve => {completions[file.name] = resolve;}), draw: source => drawn.push(source.name)});
  h.get('portrait-file').files = [{name: 'old', type: 'image/png', size: 100}]; const old = h.emit('portrait-file', 'change');
  h.get('portrait-file').files = [{name: 'new', type: 'image/png', size: 100}]; const next = h.emit('portrait-file', 'change');
  completions.new({name: 'new', width: 512, height: 512}); await next;
  completions.old({name: 'old', width: 512, height: 512}); await old;
  assert.ok(drawn.length > 0); assert.ok(drawn.every(name => name === 'new'));
});

test('hosted photo aspect mismatch is rejected and invalid crop apply never reports success', async () => {
  const h = controlsHarness(); h.get('portrait-public-url').value = 'https://example.com/wide.jpg';
  const pending = h.emit('portrait-use-url', 'click');
  h.images[0].naturalWidth = 200; h.images[0].naturalHeight = 100; h.images[0].onload(); await pending;
  assert.equal(h.writes.length, 0); assert.match(h.get('portrait-notice').textContent, /square/); assert.equal(h.get('portrait-notice').dataset.error, 'true');
  h.get('portrait-file').files = [{type: 'image/png', size: 100}]; await h.emit('portrait-file', 'change');
  h.restore({nameLine1: 'W'.repeat(36)}); await h.emit('portrait-apply', 'click');
  assert.equal(h.writes.length, 0); assert.equal(h.get('portrait-notice').dataset.error, 'true'); assert.doesNotMatch(h.get('portrait-notice').textContent, /Photo added/);
});
