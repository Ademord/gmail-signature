import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {decodePNG, encodePNG} from '../scripts/prepare-icons.mjs';

// Independent, manually filtered RGBA fixture covers all five PNG filters.
function fixture({colorType = 6, firstFilter = 0} = {}) {
  function chunk(type, payload) {
    const body = Buffer.concat([Buffer.from(type), payload]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(payload.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
  }
  const header = Buffer.from([0, 0, 0, 2, 0, 0, 0, 5, 8, colorType, 0, 0, 0]);
  const rows = Buffer.from([
    firstFilter, 28, 90, 140, 0, 10, 20, 30, 255,
    1, 38, 100, 150, 10, 238, 186, 146, 255,
    2, 10, 10, 10, 10, 10, 10, 10, 10,
    3, 34, 65, 90, 20, 252, 226, 206, 5,
    4, 10, 10, 10, 10, 248, 10, 10, 255
  ]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

test('PNG decoding reconstructs every filter and encoding preserves RGBA', () => {
  const image = decodePNG(fixture());
  assert.equal(image.width, 2); assert.equal(image.height, 5);
  assert.deepEqual(image.rgba, Buffer.from([
    28, 90, 140, 0, 10, 20, 30, 255,
    38, 100, 150, 10, 20, 30, 40, 9,
    48, 110, 160, 20, 30, 40, 50, 19,
    58, 120, 170, 30, 40, 50, 60, 29,
    68, 130, 180, 40, 50, 60, 70, 39
  ]));
  assert.deepEqual(decodePNG(encodePNG(image)), image);
});

test('PNG decoding rejects unsupported formats, filters, corruption, and truncation', () => {
  assert.throws(() => decodePNG(fixture({colorType: 2})), /RGBA/);
  assert.throws(() => decodePNG(fixture({firstFilter: 5})), /filter/);
  const corrupt = fixture(); corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => decodePNG(corrupt), /CRC/);
  assert.throws(() => decodePNG(fixture().subarray(0, -1)), /Truncated/);
});

for (const name of ['web', 'mail', 'phone', 'linkedin', 'pin']) {
  test(`dark ${name} icon preserves all source alpha and dimensions`, () => {
    const source = decodePNG(readFileSync(new URL(`../sig/icon-${name}.png`, import.meta.url)));
    const dark = decodePNG(readFileSync(new URL(`../sig/icon-${name}-dark.png`, import.meta.url)));
    assert.equal(dark.width, source.width); assert.equal(dark.height, source.height);
    let transparent = 0, antialiased = 0, visible = 0;
    for (let i = 0; i < source.rgba.length; i += 4) {
      assert.equal(dark.rgba[i], 0x1c); assert.equal(dark.rgba[i + 1], 0x1c); assert.equal(dark.rgba[i + 2], 0x1c);
      assert.equal(dark.rgba[i + 3], source.rgba[i + 3], `Alpha changed at pixel ${i / 4}.`);
      if (source.rgba[i + 3] === 0) transparent++;
      else { visible++; if (source.rgba[i + 3] < 255) antialiased++; }
    }
    assert(transparent > 0, 'Transparent background was lost.');
    assert(visible > 0, 'Icon has no visible strokes.');
    assert(antialiased > 0, 'Antialiased edges were lost.');
    assert.deepEqual(encodePNG(dark), readFileSync(new URL(`../sig/icon-${name}-dark.png`, import.meta.url)), 'Generation must be reproducible.');
  });
}
