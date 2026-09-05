import {readFileSync, writeFileSync} from 'node:fs';
import {deflateSync, inflateSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Build-time PNG conversion. Only non-interlaced, eight-bit RGBA PNGs are
// supported; other image formats fail explicitly instead of losing alpha.
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const names = ['web', 'mail', 'phone', 'linkedin', 'pin'];
const crcTable = Uint32Array.from({length: 256}, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length);
  output.write(type, 4, 4, 'ascii');
  data.copy(output, 8);
  output.writeUInt32BE(crc32(output.subarray(4, -4)), output.length - 4);
  return output;
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const a = Math.abs(estimate - left), b = Math.abs(estimate - up), c = Math.abs(estimate - upperLeft);
  return a <= b && a <= c ? left : b <= c ? up : upperLeft;
}

export function decodePNG(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) throw new Error('Invalid PNG signature.');
  let offset = 8, width = 0, height = 0, ended = false, idatEnded = false;
  const compressed = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk.');
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    if (end > bytes.length) throw new Error('Truncated PNG chunk data.');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, end - 4);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) {
      throw new Error('Invalid PNG chunk or CRC: ' + type);
    }
    if (offset === 8 && type !== 'IHDR') throw new Error('PNG must start with IHDR.');
    if (type === 'IHDR') {
      if (width || offset !== 8 || length !== 13) throw new Error('Invalid PNG IHDR.');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (!width || !height || width > 4096 || height > 4096) throw new Error('Unsupported PNG dimensions.');
      if (data[8] !== 8 || data[9] !== 6 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new Error('Only non-interlaced, eight-bit RGBA PNGs are supported.');
      }
    } else if (type === 'IDAT') {
      if (idatEnded) throw new Error('PNG IDAT chunks must be consecutive.');
      compressed.push(data);
    } else if (type === 'IEND') {
      if (length || !compressed.length || end !== bytes.length) throw new Error('Invalid PNG IEND.');
      ended = true;
    } else {
      if (/^[A-Z]/.test(type) || ['tRNS', 'acTL', 'fcTL', 'fdAT'].includes(type)) {
        throw new Error('Unsupported PNG chunk: ' + type);
      }
      if (compressed.length) idatEnded = true;
    }
    offset = end;
  }
  if (!ended) throw new Error('PNG is missing IEND.');
  const stride = width * 4, expected = (stride + 1) * height;
  const filtered = inflateSync(Buffer.concat(compressed), {maxOutputLength: expected});
  if (filtered.length !== expected) throw new Error('Unexpected PNG pixel-data length.');
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1), filter = filtered[start];
    if (filter > 4) throw new Error('Unsupported PNG row filter: ' + filter);
    for (let x = 0; x < stride; x++) {
      const position = y * stride + x;
      const left = x >= 4 ? rgba[position - 4] : 0;
      const up = y ? rgba[position - stride] : 0;
      const upperLeft = x >= 4 && y ? rgba[position - stride - 4] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up :
        filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      rgba[position] = (filtered[start + 1 + x] + predictor) & 255;
    }
  }
  return {width, height, rgba};
}

export function encodePNG({width, height, rgba}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
    width > 4096 || height > 4096 || !Buffer.isBuffer(rgba) || rgba.length !== width * height * 4) {
    throw new Error('Invalid RGBA dimensions or pixel data.');
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  const stride = width * 4, filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(filtered, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

export function prepareIcons(directory = new URL('../sig/', import.meta.url)) {
  const files = [];
  for (const name of names) {
    const source = new URL(`icon-${name}.png`, directory);
    const target = new URL(`icon-${name}-dark.png`, directory);
    const image = decodePNG(readFileSync(source));
    // Changing RGB even on invisible pixels gives a uniform color plane.
    // Alpha, including every antialiased edge, remains byte-for-byte identical.
    for (let i = 0; i < image.rgba.length; i += 4) image.rgba.fill(0x1c, i, i + 3);
    writeFileSync(target, encodePNG(image));
    files.push({name: `icon-${name}-dark.png`, width: image.width, height: image.height});
  }
  return files;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  for (const file of prepareIcons()) console.log(`Prepared ${file.name} (${file.width}×${file.height}; alpha preserved).`);
}
