import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const corePath = process.env.SIGNATURE_CORE_PATH || fileURLToPath(new URL('../signature-core.js', import.meta.url));
const sandbox = { URL, TextEncoder, TextDecoder, module: { exports: {} }, console };
vm.runInNewContext(await readFile(corePath, 'utf8'), sandbox, { filename: 'signature-core.js' });
const core = sandbox.SignatureCore || sandbox.module.exports;
const defaults = typeof core.defaults === 'function' ? core.defaults() : core.defaults;
const values = overrides => ({ ...defaults, ...overrides });
const normalize = overrides => core.normalize(values(overrides));

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}

test('the browser API exposes valid generic example values', () => {
  for (const name of ['normalize', 'validate', 'render', 'plainText']) assert.equal(typeof core[name], 'function', name);
  assert.ok(defaults && typeof defaults === 'object');
  assert.match(`${defaults.nameLine1} ${defaults.nameLine2}`, /Avery\s+Morgan/);
  assert.deepEqual(Object.keys(core.validate(core.normalize(defaults))), []);
  assert.ok(core.plainText(defaults).includes('Avery'));
});

test('normalization returns an independent value object and bounded numeric dimensions', () => {
  const input = values({ width: '340', height: '230', nameLine1: '  Avery  ' });
  const before = JSON.stringify(input);
  const result = core.normalize(input);
  assert.equal(JSON.stringify(input), before, 'normalization must not mutate caller values');
  assert.notEqual(result, input);
  assert.equal(result.width, 340);
  assert.equal(result.height, 230);
  assert.equal(result.nameLine1, 'Avery');
  assert.equal(normalize({ width: 1, height: 1 }).width, 280);
  assert.equal(normalize({ width: 9999, height: 9999 }).width, 420);
  assert.equal(normalize({ width: 1, height: 1 }).height, 180);
  assert.equal(normalize({ width: 9999, height: 9999 }).height, 320);
});

test('validation returns understandable errors for unsafe links', () => {
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,bad', 'file:///private/profile', 'https://user:secret@example.com']) {
    const errors = core.validate(normalize({ website: unsafe }));
    assert.equal(typeof errors, 'object');
    assert.equal(typeof errors.website, 'string', unsafe);
    assert.ok(errors.website.length > 0);
  }
  const errors = core.validate(normalize({ email: 'avery@example.com\r\nBcc:other@example.com', accent: 'red;position:fixed' }));
  assert.equal(typeof errors.email, 'string');
  assert.equal(typeof errors.accent, 'string');
});

test('unsafe values cannot be exported through HTML or plain text', () => {
  const unsafe = normalize({ website: 'javascript:alert(1)' });
  for (const method of ['render', 'plainText']) {
    assert.throws(() => core[method](unsafe), error => {
      assert.equal(error.name, 'TypeError');
      assert.equal(typeof error.errors.website, 'string');
      return true;
    });
  }
});

test('user text remains text in exported HTML', () => {
  const safeText = normalize({ nameLine1: '<b>Avery</b>', nameLine2: 'Morgan & Co', subtitle: '"Design" <script>bad()</script>' });
  const html = core.render(safeText);
  assert.doesNotMatch(html, /<script\b|<b>Avery<\/b>/i);
  assert.match(html, /&lt;b&gt;Avery&lt;\/b&gt;/);
  assert.match(html, /Morgan &amp; Co/);
  assert.match(core.plainText(safeText), /Morgan & Co/);
});

test('Unicode names and text survive normalization, rendering, and JSON round trips', () => {
  const input = normalize({ nameLine1: 'Avery', nameLine2: 'Mörgán', subtitle: 'Crée des idées · 東京' });
  const restored = core.normalize(JSON.parse(JSON.stringify(input)));
  assert.equal(restored.nameLine2, 'Mörgán');
  assert.equal(restored.subtitle, input.subtitle);
  assert.match(core.render(restored), /Mörgán/);
  assert.match(core.plainText(restored), /東京/);
});

test('a portfolio can replace email and optional rows disappear cleanly', () => {
  const portfolio = normalize({ email: '', phone: '', linkedin: '', location: '', website: 'https://example.com', websiteLabel: 'example.com', tags: '', subtitle: '' });
  assert.deepEqual(Object.keys(core.validate(portfolio)), []);
  const html = core.render(portfolio);
  const plain = core.plainText(portfolio);
  assert.match(html, /href="https:\/\/example\.com\/?"/);
  assert.doesNotMatch(html, /mailto:|tel:|icon-mail\.png|icon-phone\.png|icon-linkedin\.png|icon-pin\.png/);
  assert.match(plain, /example\.com/);
  assert.doesNotMatch(plain, /undefined|null/);
});

test('both card layouts export explicit dimensions and remain below the size budget', () => {
  for (const layout of ['paired', 'stacked']) {
    const html = core.render(normalize({ width: 340, height: 230, layout }));
    const table = attributes(html.match(/<table\b[^>]*>/i)?.[0] || '');
    assert.equal(Number(table.width), layout === 'paired' ? 700 : 340, `${layout} outer width`);
    assert.equal(Number(table.height), layout === 'paired' ? 230 : 480, `${layout} outer height`);
    const tables = [...html.matchAll(/<table\b[^>]*>/gi)].map(match => attributes(match[0]));
    assert.ok(tables.filter(table => table.width === '340' && table.height === '230').length >= 2, 'both panels declare width and height');
    assert.ok(html.length < 10000, `${layout}: ${html.length} characters`);
    for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
      const attrs = attributes(tag);
      assert.ok(Number(attrs.width) > 0 && Number(attrs.height) > 0, 'each image declares width and height');
    }
    assert.doesNotMatch(html, /<script\b|<style\b|<svg\b|\bclass=|\bposition\s*:|\bdisplay\s*:\s*(?:flex|grid)|data:image/i);
  }
});

test('asset URLs are safely configurable while local preview can use bundled assets', () => {
  const input = normalize({ imageBase: 'https://example.com/signature-assets' });
  const html = core.render(input);
  assert.match(html, /src="https:\/\/example\.com\/signature-assets\/dots\.png"/);
  assert.match(core.render(input, { assetBase: './sig' }), /src="\.\/sig\/dots\.png"/);
  assert.throws(() => core.render(input, { assetBase: 'javascript:alert(1)' }));
});

test('contact rows use the bundled PNGs and older drafts inherit matching icons', () => {
  const older = { ...defaults, email: 'hello@example.com', height: 260 };
  for (const key of Object.keys(older).filter(key => key.endsWith('Icon'))) delete older[key];
  const html = core.render(older);
  for (const icon of ['web', 'mail', 'phone', 'linkedin', 'pin']) {
    assert.match(html, new RegExp('/icon-' + icon + '\\.png" width="14" height="14"'));
  }
  assert.doesNotMatch(html, />(?:WEB|AT|TEL|IN|LOC)<\/td>/);
  const roleStyle = html.match(/<td style="([^"]*)">Software Engineer<\/td>/)?.[1];
  assert.match(roleStyle, /font-family:'IBM Plex Mono'/);
  assert.match(roleStyle, /font-weight:400;color:#c8362a;letter-spacing:0.73px/);
});

test('icon selection changes artwork without changing contacts and rejects arbitrary paths', () => {
  const changed = values({ websiteIcon: 'mail', phoneIcon: 'none' });
  const html = core.render(changed);
  assert.match(html, /icon-mail\.png/);
  assert.doesNotMatch(html, /icon-web\.png|icon-phone\.png/);
  assert.match(html, /href="tel:/);
  assert.equal(core.plainText(changed), core.plainText(defaults));
  for (const icon of ['../private', 'https://example.com/track.png', 'toString', '__proto__', 'unknown']) {
    assert.equal(typeof core.validate(values({ websiteIcon: icon })).websiteIcon, 'string');
    assert.throws(() => core.render(values({ websiteIcon: icon })));
  }
  const light = core.render(values({ backBackground: '#ffffff' }));
  const iconTags = [...light.matchAll(/<img\b[^>]*icon-[^>]*>/g)];
  assert.equal(iconTags.length, 4);
  for (const [tag] of iconTags) {
    assert.match(tag, /-dark\.png/);
    assert.doesNotMatch(tag, /background-color/);
  }
});

test('automatic transparent icon variants retain at least 3:1 contrast over the RGB cube', () => {
  function light(hex) {
    const rgb = hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  }
  for (let r=0;r<=255;r+=17) for (let g=0;g<=255;g+=17) for (let b=0;b<=255;b+=17) {
    const background = '#' + [r,g,b].map(c=>c.toString(16).padStart(2,'0')).join('');
    const file = core.iconFile('phone',background), ink = file.includes('-dark') ? '#1c1c1c' : '#f3f0ea';
    const ratio = (Math.max(light(background),light(ink))+.05)/(Math.min(light(background),light(ink))+.05);
    assert.ok(ratio>=3,background+' '+ink);
  }
  assert.equal(core.iconFile('web','#F3F0EA'),'icon-web-dark.png');
  assert.equal(core.iconFile('web','#1c1c1c'),'icon-web.png');
  assert.equal(core.iconFile('none','#ffffff'),'');
});

test('wide names cannot silently overflow and errors identify the edited field', () => {
  for (const field of ['nameLine1', 'nameLine2']) {
    const input = values({ [field]: 'm'.repeat(14) });
    assert.equal(typeof core.validate(input)[field], 'string');
    assert.throws(() => core.render(input));
  }
});

test('malformed email domains and oversized local parts are rejected', () => {
  for (const email of ['hello@-example.com', 'hello@example-.com', 'hello@.example.com', 'hello@example..com', 'a'.repeat(65) + '@example.com']) {
    assert.equal(typeof core.validate(values({ email, height: 260 })).email, 'string', email);
  }
  assert.deepEqual(Object.keys(core.validate(values({ email: 'hello+test@sub.example.com', height: 260 }))), []);
});

test('preview asset overrides cannot use network paths or parent traversal', () => {
  for (const assetBase of ['//localhost', '//example.com', '../sig', './a/../sig', './%2e%2e/sig']) {
    assert.throws(() => core.render(defaults, { assetBase }), assetBase);
  }
});

test('invalid raw dimensions are errors instead of silently clamped exports', () => {
  for (const width of ['', 100, 999, 321.5, null]) {
    assert.equal(typeof core.validate(values({ width })).width, 'string');
    assert.throws(() => core.render(values({ width })));
  }
  for (const height of ['', 100, 999, 208.5, null]) assert.equal(typeof core.validate(values({ height })).height, 'string');
});

test('older drafts inherit original card backgrounds and custom backgrounds reach the export', () => {
  const older = { ...defaults };
  delete older.frontBackground; delete older.backBackground;
  assert.equal(core.normalize(older).frontBackground, '#f3f0ea');
  assert.equal(core.normalize(older).backBackground, '#1c1c1c');
  const html = core.render(values({ frontBackground: '#102030', backBackground: '#ddecff' }));
  assert.match(html, /background-color:#102030/);
  assert.match(html, /background-color:#ddecff/);
  for (const key of ['frontBackground', 'backBackground', 'accent']) {
    for (const invalid of ['#xyzxyz', '#123', 'red;position:fixed']) {
      assert.equal(typeof core.validate(values({ [key]: invalid }))[key], 'string');
      assert.throws(() => core.render(values({ [key]: invalid })));
    }
  }
});

test('exported text keeps readable contrast on light, dark, and midtone backgrounds', () => {
  function light(hex) {
    const rgb = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  }
  function ratio(a, b) { return (Math.max(light(a), light(b)) + .05) / (Math.min(light(a), light(b)) + .05); }
  for (const background of ['#000000', '#ffffff', '#777777', '#172333', '#f3f0ea', '#00ffff', '#ff0000', '#9f55a5', '#99aa11']) {
    const html = core.render(values({ frontBackground: background, backBackground: background, accent: background }));
    const textColors = [...html.matchAll(/<td\b[^>]*style="([^"]*)"[^>]*>(Avery<br>Morgan|Software Engineer|AI &amp; AUTOMATION|Zurich, Switzerland|SOFTWARE · DATA · AI)<\/td>/g)].map(match => match[1].match(/(?:^|;)color:(#[a-f0-9]{6})/i)?.[1]);
    assert.equal(textColors.length, 5, 'All five representative text styles are checked.');
    for (const color of textColors) assert.ok(color && ratio(background, color) >= 4.5, `${background} / ${color}`);
    assert.ok(html.length < 10000);
  }
});
