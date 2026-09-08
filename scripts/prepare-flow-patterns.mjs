import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {decodePNG, encodePNG} from './prepare-icons.mjs';

// Original compositions for the whole signature surface. Wide and tall are
// separately drawn; neither scales, tiles, or crops the original artwork rails.
// Coordinates below are CSS pixels at the largest supported card size. Sample
// at 4x and resolve to 2x with premultiplied alpha so cut edges keep their ink.
export const flowPatternNames = Object.freeze(['cutpaper', 'colorfield', 'chromatic', 'counterform', 'overprint', 'gesture']);
export const flowOrientations = Object.freeze(['wide', 'tall']);
const dimensions = Object.freeze({wide: [860, 320], tall: [420, 660]});
const NATIVE = 2, SAMPLE = 2, SCALE = NATIVE * SAMPLE;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function canvas(width, height) {
  const w = width * SCALE, h = height * SCALE;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const color = ink => {
    const hex = ink.slice(1);
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1);
  };
  function pixel(x, y, rgb, opacity) {
    const offset = (y * w + x) * 4, previous = pixels[offset + 3] / 255;
    const combined = opacity + previous * (1 - opacity);
    for (let channel = 0; channel < 3; channel++) pixels[offset + channel] =
      (rgb[channel] * opacity + pixels[offset + channel] * previous * (1 - opacity)) / combined;
    pixels[offset + 3] = combined * 255;
  }
  function poly(points, ink) {
    const rgb = color(ink), opacity = rgb[3];
    const y0 = clamp(Math.ceil(Math.min(...points.map(p => p[1])) * SCALE - .5), 0, h);
    const y1 = clamp(Math.ceil(Math.max(...points.map(p => p[1])) * SCALE - .5), 0, h);
    // Scanline spans make large Bézier silhouettes inexpensive and deterministic.
    for (let y = y0; y < y1; y++) {
      const at = (y + .5) / SCALE, crossings = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [x1, a] = points[j], [x2, b] = points[i];
        if ((a > at) !== (b > at)) crossings.push(x1 + (at - a) * (x2 - x1) / (b - a));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i < crossings.length; i += 2) {
        const start = clamp(Math.ceil(crossings[i] * SCALE - .5), 0, w);
        const end = clamp(Math.ceil(crossings[i + 1] * SCALE - .5), 0, w);
        for (let x = start; x < end; x++) pixel(x, y, rgb, opacity);
      }
    }
  }
  function shape(start, segments, ink) {
    const points = [start];
    let previous = start;
    for (const [x1, y1, x2, y2, x3, y3] of segments) {
      for (let step = 1; step <= 64; step++) {
        const t = step / 64, u = 1 - t;
        points.push([u ** 3 * previous[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
          u ** 3 * previous[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3]);
      }
      previous = [x3, y3];
    }
    poly(points, ink);
  }
  function field(cx, cy, rx, ry, rotation, ink, feather, phase) {
    const angle = rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle), rgb = color(ink);
    const bx = Math.abs(rx * cos) + Math.abs(ry * sin), by = Math.abs(rx * sin) + Math.abs(ry * cos);
    const left = clamp(Math.floor((cx - bx * 1.1) * SCALE), 0, w), right = clamp(Math.ceil((cx + bx * 1.1) * SCALE), 0, w);
    const top = clamp(Math.floor((cy - by * 1.1) * SCALE), 0, h), bottom = clamp(Math.ceil((cy + by * 1.1) * SCALE), 0, h);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const dx = (x + .5) / SCALE - cx, dy = (y + .5) / SCALE - cy;
      const u = (dx * cos + dy * sin) / rx, v = (-dx * sin + dy * cos) / ry;
      const theta = Math.atan2(v, u), edge = 1 + .038 * Math.sin(theta * 3 + phase) + .023 * Math.cos(theta * 7 - phase);
      const distance = Math.sqrt(u * u + v * v) / edge;
      if (distance >= 1) continue;
      const weight = clamp((1 - distance) / feather, 0, 1);
      // The fully pigmented center is essential: these are ink masses, not a
      // pale decorative wash. Only their irregular boundaries are feathered.
      pixel(x, y, rgb, rgb[3] * weight * weight * (3 - 2 * weight));
    }
  }
  function finish() {
    const outW = width * NATIVE, outH = height * NATIVE, rgba = Buffer.alloc(outW * outH * 4);
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
      const sum = [0, 0, 0, 0], target = (y * outW + x) * 4;
      for (let sy = 0; sy < SAMPLE; sy++) for (let sx = 0; sx < SAMPLE; sx++) {
        const source = ((y * SAMPLE + sy) * w + x * SAMPLE + sx) * 4, alpha = pixels[source + 3];
        for (let channel = 0; channel < 3; channel++) sum[channel] += pixels[source + channel] * alpha;
        sum[3] += alpha;
      }
      if (sum[3]) for (let channel = 0; channel < 3; channel++) rgba[target + channel] = Math.round(sum[channel] / sum[3]);
      rgba[target + 3] = Math.round(sum[3] / (SAMPLE * SAMPLE));
    }
    return {width: outW, height: outH, rgba};
  }
  return {poly, shape, field, finish};
}

const painters = {
  cutpaper: {
    wide(c) {
      c.shape([-32, 240], [[91, 188, 158, 134, 278, 135], [409, 135, 419, 209, 537, 165], [669, 116, 665, 26, 771, -30],
        [800, -38, 852, -24, 879, -12], [760, 59, 761, 146, 614, 207], [481, 263, 411, 191, 287, 195], [174, 200, 81, 291, -18, 305]], '#2348C7');
      c.poly([[579, -18], [900, 36], [831, 114], [653, 63], [617, 105], [549, 66]], '#E6B83D');
      c.shape([154, 334], [[220, 264, 309, 227, 390, 252], [445, 269, 476, 236, 512, 248], [544, 270, 503, 291, 459, 308],
        [380, 338, 331, 283, 278, 297], [237, 308, 221, 330, 208, 347]], '#E3634A');
      c.poly([[35, 20], [74, 10], [67, 50], [26, 61]], '#E3634A');
    },
    tall(c) {
      c.shape([-20, 32], [[130, 5, 293, 93, 330, 188], [365, 278, 223, 281, 205, 350], [187, 419, 346, 459, 409, 537],
        [450, 588, 451, 640, 443, 690], [402, 690, 370, 678, 357, 663], [395, 545, 203, 519, 151, 440],
        [73, 323, 227, 277, 261, 224], [313, 143, 134, 88, -21, 117]], '#2348C7');
      c.poly([[302, -21], [440, 18], [410, 116], [353, 91], [295, 158], [252, 126]], '#E6B83D');
      c.shape([-10, 418], [[42, 385, 119, 435, 110, 486], [106, 518, 59, 524, 87, 561], [113, 597, 161, 619, 169, 672],
        [129, 677, 104, 671, 75, 652], [39, 599, -13, 589, -21, 535]], '#E3634A');
      c.poly([[309, 363], [363, 342], [347, 392], [293, 410]], '#E6B83D');
    }
  },
  colorfield: {
    wide(c) {
      c.field(274, 286, 340, 99, -13, '#477B9F', .15, .7);
      c.field(624, 28, 297, 100, 12, '#C18572', .19, 2.1);
      c.field(573, 245, 197, 105, -28, '#735568', .16, 1.2);
      c.field(365, 248, 109, 49, -4, '#BA877650', .43, 2.7);
    },
    tall(c) {
      c.field(311, 172, 126, 198, -27, '#C18572', .19, 2.1);
      c.field(79, 446, 150, 230, 24, '#477B9F', .15, .7);
      c.field(299, 567, 133, 163, 19, '#735568', .16, 1.2);
      c.field(186, 472, 57, 127, -22, '#BA877650', .43, 2.7);
    }
  },
  chromatic: {
    wide(c) {
      c.poly([[-20, 265.25], [158, 265.25], [158, 220], [300, 220], [300, 164.25], [438, 164.25], [438, 224], [338, 224], [338, 281], [221, 281], [221, 333], [-20, 333]], '#244DD7');
      c.poly([[376, 98], [498, 98], [498, 32], [650, 32], [650, -20], [735, -20], [735, 93], [560, 93], [560, 160], [376, 160]], '#DD5946');
      c.poly([[517, 193], [658, 193], [658, 137], [784, 137], [784, 93], [879, 93], [879, 152], [821, 152], [821, 215], [720, 215], [720, 259], [517, 259]], '#E3AE30');
      c.poly([[696, 287], [806, 287], [806, 249], [881, 249], [881, 340], [696, 340]], '#244DD7');
      c.poly([[33, -10], [69, -10], [69, 45], [119, 45], [119, 77], [33, 77]], '#DD5946');
    },
    tall(c) {
      c.poly([[258, -20], [348, -20], [348, 123], [413, 123], [413, 200], [331, 200], [331, 92], [258, 92]], '#DD5946');
      c.poly([[-18, 210.25], [66, 210.25], [66, 276], [152, 276], [152, 341.25], [235, 341.25], [235, 419], [152, 419], [152, 365], [73, 365], [73, 319], [-18, 319]], '#244DD7');
      c.poly([[242, 269], [307, 269], [307, 339], [395, 339], [395, 470], [326, 470], [326, 405], [242, 405]], '#E3AE30');
      c.poly([[-16, 474], [90, 474], [90, 533], [175, 533], [175, 607], [249, 607], [249, 680], [130, 680], [130, 595], [32, 595], [32, 542], [-16, 542]], '#DD5946');
      c.poly([[335, 527], [395, 527], [395, 603], [443, 603], [443, 680], [335, 680]], '#244DD7');
      c.poly([[83, 335], [108, 335], [108, 364], [83, 364]], '#F0E7CE');
    }
  },
  counterform: {
    wide(c) {
      c.shape([-26, 260], [[141, 340, 231, 163, 333, 155], [474, 144, 459, 22, 596, 26], [717, 30, 682, 231, 909, 258],
        [919, 286, 909, 316, 887, 337], [663, 296, 637, 126, 580, 103], [493, 67, 467, 219, 340, 219],
        [211, 219, 154, 355, -17, 313]], '#EEE5CE');
      c.shape([-25, 222], [[104, 300, 208, 136, 309, 116], [439, 91, 446, -35, 579, -14], [719, 8, 649, 159, 876, 202],
        [888, 222, 886, 245, 879, 263], [642, 217, 638, 59, 564, 49], [485, 38, 461, 180, 327, 177],
        [210, 174, 135, 347, -21, 275]], '#1D2021');
      c.poly([[591, 248], [668, 228], [650, 252], [574, 276]], '#D4DE46');
    },
    tall(c) {
      c.shape([38, -26], [[140, 39, 358, 88, 352, 218], [347, 329, 125, 327, 149, 448], [173, 546, 355, 565, 427, 643],
        [420, 672, 391, 690, 350, 695], [267, 606, 91, 574, 83, 456], [70, 286, 297, 287, 285, 209],
        [266, 113, 93, 128, -10, 5]], '#EEE5CE');
      c.shape([107, -27], [[193, 27, 398, 64, 394, 207], [390, 328, 169, 338, 200, 435], [232, 530, 382, 539, 450, 611],
        [458, 645, 442, 666, 424, 675], [366, 584, 139, 550, 136, 438], [132, 298, 334, 277, 333, 207],
        [332, 115, 168, 119, 48, 6]], '#1D2021');
      c.poly([[39, 346], [118, 320], [106, 347], [28, 373]], '#D4DE46');
    }
  },
  overprint: {
    wide(c) {
      c.poly([[90, 243], [562, 76], [640, 271], [200, 373]], '#DC4E37E6');
      c.poly([[476, -54], [783, 31], [672, 313], [385, 221]], '#244EB8DB');
      c.poly([[451, 117], [562, 76], [628, 241], [385, 221]], '#513960');
      c.poly([[90, 243], [99, 240], [209, 370], [200, 373]], '#DC4E37');
      c.poly([[783, 31], [776, 29], [664, 310], [672, 313]], '#244EB8');
      c.poly([[140, 245], [558, 95], [561, 101], [143, 251]], '#F3B09270');
      c.poly([[23, 33], [105, 17], [113, 51], [32, 70]], '#DC4E37E6');
    },
    tall(c) {
      c.poly([[-49, 213], [245, 111], [354, 423], [47, 528]], '#DC4E37E6');
      c.poly([[239, 257], [456, 348], [307, 690], [96, 598]], '#244EB8DB');
      c.poly([[239, 257], [311, 286], [354, 423], [153, 492]], '#513960');
      c.poly([[-49, 213], [-42, 210], [54, 525], [47, 528]], '#DC4E37');
      c.poly([[456, 348], [449, 346], [300, 687], [307, 690]], '#244EB8');
      c.poly([[3, 221], [239, 139], [241, 145], [5, 227]], '#F3B09270');
      c.poly([[288, 5], [390, 29], [377, 71], [278, 47]], '#244EB8DB');
    }
  },
  gesture: {
    wide(c) {
      c.shape([-30, 299], [[142, 252, 213, 163, 347, 160], [489, 162, 589, 273, 733, 168], [788, 130, 835, 78, 898, 46],
        [854, 117, 820, 172, 758, 217], [605, 328, 490, 224, 349, 206], [208, 190, 117, 323, -16, 337]], '#A8A093');
      c.shape([-26, 249], [[111, 236, 207, 90, 342, 96], [467, 98, 496, 219, 632, 174], [730, 142, 779, 71, 883, 15],
        [862, 46, 853, 61, 836, 78], [744, 158, 710, 202, 647, 224], [501, 274, 448, 151, 338, 144],
        [222, 137, 148, 278, -12, 293]], '#21262A');
      c.poly([[311, 100], [344, 92], [379, 106], [365, 116], [331, 109]], '#21262A');
      c.poly([[637, 291], [746, 258], [739, 269], [632, 303]], '#C94836');
    },
    tall(c) {
      c.shape([414, -30], [[359, 91, 181, 130, 201, 263], [210, 335, 263, 354, 222, 432], [176, 518, 86, 537, -28, 651],
        [50, 525, 122, 493, 155, 415], [185, 346, 128, 316, 139, 239], [153, 125, 300, 67, 377, -34]], '#A8A093');
      c.shape([361, -24], [[362, -14, 386, -17, 395, -12], [329, 113, 133, 145, 153, 260], [167, 327, 212, 358, 174, 432],
        [130, 520, 68, 546, -29, 620], [28, 547, 108, 470, 119, 415], [132, 358, 71, 325, 88, 246],
        [113, 124, 284, 70, 361, -24]], '#21262A');
      c.poly([[85, 242], [97, 237], [116, 264], [100, 279], [82, 257]], '#21262A');
      c.poly([[275, 541], [360, 516], [348, 532], [268, 558]], '#C94836');
    }
  }
};

export function renderFlowPattern(name, orientation = 'wide') {
  if (!Object.hasOwn(painters, name)) throw new Error(`Unknown flow pattern: ${name}`);
  if (!Object.hasOwn(dimensions, orientation)) throw new Error(`Unknown flow orientation: ${orientation}`);
  const surface = canvas(...dimensions[orientation]);
  painters[name][orientation](surface);
  return surface.finish();
}

export function prepareFlowPatterns(directory = new URL('../sig/', import.meta.url)) {
  mkdirSync(directory, {recursive: true});
  return flowPatternNames.flatMap(name => flowOrientations.map(orientation => {
    const image = renderFlowPattern(name, orientation), filename = `pattern-${name}-${orientation}.png`, bytes = encodePNG(image);
    writeFileSync(new URL(filename, directory), bytes);
    return {name, orientation, filename, width: image.width, height: image.height, bytes: bytes.length};
  }));
}

// These checks measure the new promise: real ink across the whole canvas,
// visible central seams, clear negative space and deterministic unique files.
// --check is read-only. It catches a missing, stale, tiled or empty asset.
export function inspectFlowPatterns(directory = new URL('../sig/', import.meta.url)) {
  const identities = new Set();
  return flowPatternNames.flatMap(name => flowOrientations.map(orientation => {
    const filename = `pattern-${name}-${orientation}.png`, bytes = readFileSync(new URL(filename, directory));
    const {width, height, rgba} = decodePNG(bytes), [cssW, cssH] = dimensions[orientation];
    if (width !== cssW * NATIVE || height !== cssH * NATIVE) throw new Error(`${filename}: wrong native dimensions.`);
    let visible = 0, opaque = 0, partial = 0, center = 0;
    const bands = Array(4).fill(0), horizontal = orientation === 'wide';
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        visible++;
        bands[Math.min(3, Math.floor((horizontal ? x / width : y / height) * 4))]++;
        if (horizontal ? Math.abs(x - width / 2) < width * .04 : Math.abs(y - height / 2) < height * .04) center++;
      }
      if (alpha === 255) opaque++;
      if (alpha > 0 && alpha < 255) partial++;
    }
    const area = width * height, coverage = visible / area;
    if (coverage < .16 || coverage > .78 || opaque < area * .045 || partial < 200) throw new Error(`${filename}: missing strong ink, negative space, or antialiasing.`);
    if (bands.some(count => count < area * .016) || center < area * .01) throw new Error(`${filename}: artwork does not flow across the canvas.`);
    const identity = bytes.toString('base64');
    if (identities.has(identity)) throw new Error(`${filename}: duplicate artwork.`);
    identities.add(identity);
    if (!bytes.equals(encodePNG(renderFlowPattern(name, orientation)))) throw new Error(`${filename}: stale generated artwork; run node scripts/prepare-flow-patterns.mjs.`);
    return {name, orientation, width, height, bytes: bytes.length, coverage: Number(coverage.toFixed(4)), opaque, partial};
  }));
}

export function prepareFlowProof(target = new URL('../.private/flow-artwork-proof.png', import.meta.url)) {
  mkdirSync(new URL('./', target), {recursive: true});
  const width = 1196, height = 1124, rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([229, 227, 220, 255], i);
  const backgrounds = [[245, 240, 230], [239, 233, 225], [240, 231, 206], [238, 229, 206], [244, 232, 221], [243, 239, 232]];
  function draw(source, ox, oy, dw, dh, bg) {
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const sx = Math.min(source.width - 1, Math.floor((x + .5) * source.width / dw));
      const sy = Math.min(source.height - 1, Math.floor((y + .5) * source.height / dh));
      const at = (sy * source.width + sx) * 4, dest = ((oy + y) * width + ox + x) * 4, alpha = source.rgba[at + 3] / 255;
      for (let channel = 0; channel < 3; channel++) rgba[dest + channel] = Math.round(source.rgba[at + channel] * alpha + bg[channel] * (1 - alpha));
      rgba[dest + 3] = 255;
    }
  }
  for (let index = 0; index < flowPatternNames.length; index++) {
    const name = flowPatternNames[index], column = index % 2, row = Math.floor(index / 2), x = 20 + column * 588, y = 20 + row * 366;
    draw(renderFlowPattern(name, 'wide'), x, y, 568, 178, backgrounds[index]);
    draw(renderFlowPattern(name, 'tall'), x, y + 192, 101, 158, backgrounds[index]);
    // A second wide view against dark ink verifies that transparent intervals
    // remain actual negative space rather than an opaque paper rectangle.
    draw(renderFlowPattern(name, 'wide'), x + 114, y + 192, 454, 158, [34, 37, 40]);
  }
  writeFileSync(target, encodePNG({width, height, rgba}));
  return target;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const check = process.argv.includes('--check');
  for (const file of check ? inspectFlowPatterns() : prepareFlowPatterns()) console.log(JSON.stringify(file));
  if (process.argv.includes('--proof') && !check) console.log(prepareFlowProof().href);
}
