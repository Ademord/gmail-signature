import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {decodePNG, encodePNG} from './prepare-icons.mjs';

// Editable geometric artwork, generated without a canvas or external package.
// Coordinates are CSS pixels. Rasterize at 8×, then downsample in premultiplied
// alpha to the 4× native asset size; transparent edges retain their real ink.
const WIDTH = 76, HEIGHT = 182, NATIVE = 4, SAMPLE = 2, SCALE = NATIVE * SAMPLE;
export const patternNames = Object.freeze(['orbit', 'studio', 'contour', 'prism', 'editorial', 'signal', 'galaxy', 'starlight', 'moonlight', 'frost', 'cutpaper', 'colorfield', 'chromatic', 'counterform', 'overprint', 'gesture', 'neural', 'latent', 'tokenweave', 'resonance']);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rad = degrees => degrees * Math.PI / 180;

function canvas(width = WIDTH, height = HEIGHT, scale = SCALE) {
  const w = width * scale, h = height * scale, pixels = new Uint8ClampedArray(w * h * 4);
  function paint(bounds, ink, inside) {
    const hex = ink.slice(1), rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    const x0 = clamp(Math.floor(bounds[0] * scale), 0, w), y0 = clamp(Math.floor(bounds[1] * scale), 0, h);
    const x1 = clamp(Math.ceil(bounds[2] * scale), 0, w), y1 = clamp(Math.ceil(bounds[3] * scale), 0, h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const sample = inside((x + 0.5) / scale, (y + 0.5) / scale);
      if (!sample) continue;
      const opacity = typeof sample === 'number' ? alpha * clamp(sample, 0, 1) : alpha;
      const offset = (y * w + x) * 4, previous = pixels[offset + 3] / 255, combined = opacity + previous * (1 - opacity);
      for (let c = 0; c < 3; c++) pixels[offset + c] = (rgb[c] * opacity + pixels[offset + c] * previous * (1 - opacity)) / combined;
      pixels[offset + 3] = combined * 255;
    }
  }
  function rect(x, y, width, height, ink) { paint([x, y, x + width, y + height], ink, () => true); }
  function circle(x, y, radius, ink) { paint([x - radius, y - radius, x + radius, y + radius], ink, (a, b) => (a - x) ** 2 + (b - y) ** 2 <= radius ** 2); }
  function line(x1, y1, x2, y2, thickness, ink) {
    const r = thickness / 2, dx = x2 - x1, dy = y2 - y1, length2 = dx * dx + dy * dy;
    paint([Math.min(x1, x2) - r, Math.min(y1, y2) - r, Math.max(x1, x2) + r, Math.max(y1, y2) + r], ink, (x, y) => {
      const t = length2 ? clamp(((x - x1) * dx + (y - y1) * dy) / length2, 0, 1) : 0;
      return (x - x1 - dx * t) ** 2 + (y - y1 - dy * t) ** 2 <= r * r;
    });
  }
  function poly(points, ink) {
    paint([Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))], ink, (x, y) => {
      let hit = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    });
  }
  function path(points, thickness, ink, closed = false) {
    for (let i = 1; i < points.length; i++) line(...points[i - 1], ...points[i], thickness, ink);
    if (closed) line(...points.at(-1), ...points[0], thickness, ink);
  }
  function arc(x, y, rx, ry, start, end, rotation, thickness, ink) {
    const angle = rad(rotation), cos = Math.cos(angle), sin = Math.sin(angle), points = [];
    for (let degree = start; degree <= end; degree += 1) {
      const a = Math.cos(rad(degree)) * rx, b = Math.sin(rad(degree)) * ry;
      points.push([x + a * cos - b * sin, y + a * sin + b * cos]);
    }
    path(points, thickness, ink);
  }
  // Cubic contours keep broad cut edges and brush silhouettes editable. Each
  // six-number segment contains two control points and its endpoint.
  function shape(start, segments, ink) {
    const points = [start];
    let previous = start;
    for (const [x1, y1, x2, y2, x3, y3] of segments) {
      for (let i = 1; i <= 32; i++) {
        const t = i / 32, u = 1 - t;
        points.push([u ** 3 * previous[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
          u ** 3 * previous[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3]);
      }
      previous = [x3, y3];
    }
    poly(points, ink);
  }
  // An irregular pigment field: solid heart, softened edge, slight broad
  // variation in the boundary. No random state or canvas rendering dependency.
  function field(x, y, rx, ry, rotation, ink, softness = .36, phase = 0) {
    const angle = rad(rotation), cos = Math.cos(angle), sin = Math.sin(angle);
    const bx = Math.abs(rx * cos) + Math.abs(ry * sin), by = Math.abs(rx * sin) + Math.abs(ry * cos);
    paint([x - bx * 1.1, y - by * 1.1, x + bx * 1.1, y + by * 1.1], ink, (a, b) => {
      const u = ((a - x) * cos + (b - y) * sin) / rx, v = (-(a - x) * sin + (b - y) * cos) / ry;
      const theta = Math.atan2(v, u), edge = 1 + .05 * Math.sin(theta * 3 + phase) + .025 * Math.cos(theta * 7 - phase);
      const distance = Math.sqrt(u * u + v * v) / edge;
      if (distance >= 1) return 0;
      const feather = clamp((1 - distance) / softness, 0, 1);
      return feather * feather * (3 - 2 * feather);
    });
  }
  function finish() {
    const outW = width * NATIVE, outH = height * NATIVE, rgba = Buffer.alloc(outW * outH * 4);
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
      const sum = [0, 0, 0, 0], offset = (y * outW + x) * 4;
      for (let sy = 0; sy < SAMPLE; sy++) for (let sx = 0; sx < SAMPLE; sx++) {
        const source = ((y * SAMPLE + sy) * w + x * SAMPLE + sx) * 4, a = pixels[source + 3];
        for (let c = 0; c < 3; c++) sum[c] += pixels[source + c] * a;
        sum[3] += a;
      }
      if (sum[3]) for (let c = 0; c < 3; c++) rgba[offset + c] = Math.round(sum[c] / sum[3]);
      rgba[offset + 3] = Math.round(sum[3] / (SAMPLE * SAMPLE));
    }
    return {width: outW, height: outH, rgba};
  }
  return {rect, circle, line, poly, path, arc, shape, field, finish};
}

const painters = {
  // AI-inspired studies use distinct visual structures: a branching graph,
  // nested regions, interlaced sequences, and a continuous signal field.
  // Inks are fixed; negative space and broad relationships survive reduction.
  neural(c) {
    const blue = '#486AAF', coral = '#CA654E', pale = '#E8C88D';
    const curve = (start, a, b, end, width, ink) => {
      const points = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64, u = 1 - t;
        points.push([u ** 3 * start[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t ** 3 * end[0],
          u ** 3 * start[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t ** 3 * end[1]]);
      }
      c.path(points, width, ink);
    };
    curve([39, 176], [22, 120], [53, 77], [29, 12], 3.8, blue);
    curve([37, 132], [35, 105], [6, 105], [12, 78], 3, blue);
    curve([40, 91], [54, 77], [65, 77], [62, 49], 3, blue);
    curve([36, 53], [27, 36], [9, 49], [8, 25], 2.2, blue);
    curve([39, 139], [61, 134], [71, 117], [66, 102], 2.3, coral);
    curve([12, 78], [5, 58], [40, 44], [62, 49], 1.4, '#91A5BC');
    curve([8, 25], [20, 10], [59, 13], [62, 49], 1.4, '#91A5BC');
    curve([12, 78], [17, 132], [73, 71], [66, 102], 1.4, '#91A5BC');
    for (const [x, y, r, ink] of [[29, 12, 7, blue], [8, 25, 4.5, coral], [62, 49, 7.5, pale], [12, 78, 6, coral], [40, 91, 6.5, blue], [66, 102, 4.5, pale], [39, 139, 6.5, coral], [39, 176, 4.8, blue]]) {
      c.circle(x, y, r, ink);
      if (r > 6) c.circle(x, y, r * .35, '#F2E7CA');
    }
  },
  latent(c) {
    const inks = ['#6CACB6', '#47799D', '#575C91', '#A46D92', '#D58B78', '#EBC78C'];
    for (let level = 0; level < inks.length; level++) {
      const points = [], rx = 34 - level * 4.7, ry = 80 - level * 11.7;
      for (let step = 0; step <= 180; step++) {
        const a = step * Math.PI * 2 / 180;
        const bend = 1 + .12 * Math.sin(a * 3 + .5) + .07 * Math.cos(a * 2 - level * .18);
        points.push([39 + Math.cos(a) * rx * bend + Math.sin(a * 2) * (8 - level * .7) + level * .45,
          90 + Math.sin(a) * ry * bend - level * 3.1]);
      }
      c.poly(points, inks[level]);
    }
    // Two displaced contours reveal the field's skew rather than outlining it
    // with a mechanical target or adding unrelated particles.
    const edge = [];
    for (let i = 0; i <= 76; i++) {
      const y = 17 + i * 1.95;
      edge.push([22 + 11 * Math.sin(y / 30) + 5 * Math.cos(y / 17), y]);
    }
    c.path(edge, 1.35, '#EFE0AE');
  },
  tokenweave(c) {
    const warp = ['#39798A', '#557BB6', '#8975A5'];
    const weft = ['#CC654D', '#D6A75A', '#CC654D', '#DB9160', '#D6A75A'];
    const centerX = (lane, y) => 14 + lane * 23 + 4.5 * Math.sin(y / 30 + lane * .35);
    const centerY = (row, x) => 20 + row * 34 + 4 * Math.sin(x / 23 + row * .3);
    const horizontal = (row, x0, x1) => {
      const top = [], bottom = [];
      for (let x = x0; x <= x1; x += .5) { top.push([x, centerY(row, x) - 6]); bottom.unshift([x, centerY(row, x) + 6]); }
      c.poly([...top, ...bottom], weft[row]);
    };
    for (let row = 0; row < 5; row++) horizontal(row, 2, 74);
    for (let lane = 0; lane < 3; lane++) {
      const left = [], right = [];
      for (let y = 5; y <= 179; y += 1) { left.push([centerX(lane, y) - 6, y]); right.unshift([centerX(lane, y) + 6, y]); }
      c.poly([...left, ...right], warp[lane]);
    }
    for (let row = 0; row < 5; row++) for (let lane = 0; lane < 3; lane++) if ((row + lane) % 2 === 0) {
      const x = centerX(lane, 20 + row * 34);
      horizontal(row, x - 7.6, x + 7.6);
    }
    // Open ends and alternating overlap make sequences visible without labels.
    c.rect(7, 173, 4, 6, '#E8C88D');
    c.rect(33, 2, 4, 7, '#E8C88D');
  },
  resonance(c) {
    for (let lane = 0; lane < 11; lane++) {
      const points = [];
      for (let y = 3; y <= 180; y += 1) {
        const spread = 3.9 + 1.7 * Math.sin(y / 23);
        const sweep = 13 * Math.sin(y / 30 + .25) + 3 * Math.cos(y / 13);
        points.push([38 + (lane - 5) * spread + sweep + 2.6 * Math.sin(y / 18 + lane * .3), y]);
      }
      c.path(points, lane === 5 ? 2.9 : 1.7, lane < 5 ? '#487EAC' : lane === 5 ? '#DFB76C' : '#C86D68');
    }
  },
  // Six original compositions study cut edges, pigment, cadence, counterform,
  // print overlap, and brush weight. They are drawn for the 76×182 display size,
  // with a single composition per strip and no borrowed artwork or UI symbols.
  cutpaper(c) {
    c.shape([-5, 17], [
      [19, 3, 45, 5, 60, 14], [77, 25, 62, 39, 47, 40],
      [34, 41, 37, 52, 51, 61], [69, 74, 56, 92, 41, 94],
      [18, 96, 2, 76, 14, 62], [26, 49, -7, 36, -5, 17]
    ], '#2348C7');
    c.poly([[44, 72], [76, 61], [76, 111], [52, 123], [35, 106]], '#E6B83D');
    c.shape([7, 111], [
      [21, 96, 50, 108, 53, 124], [56, 138, 36, 137, 36, 149],
      [36, 162, 58, 165, 61, 181], [39, 180, 14, 174, 9, 157],
      [3, 140, 19, 133, 10, 128], [4, 124, 3, 116, 7, 111]
    ], '#E3634A');
  },
  colorfield(c) {
    c.field(17, 77, 33, 66, -8, '#477B9F', .16, .7);
    c.field(52, 56, 23, 40, 8, '#C18572', .22, 2.1);
    c.field(44, 128, 29, 43, 21, '#735568', .20, 1.2);
    c.field(50, 99, 14, 31, -19, '#BA87763D', .65, 2.7);
  },
  chromatic(c) {
    c.poly([[0, 15.125], [47, 15.125], [47, 46], [64, 46], [64, 104],
      [40, 104], [40, 79], [19, 79], [19, 51], [0, 51]], '#244DD7');
    c.poly([[55, 1], [76, 1], [76, 90], [55, 90]], '#DD5946');
    c.poly([[7, 62], [27, 62], [27, 90], [48, 90], [48, 117],
      [76, 117], [76, 142], [48, 142], [48, 178], [21, 178], [21, 114], [7, 114]], '#E3AE30');
    c.poly([[0, 101], [13, 101], [13, 137], [36, 137], [36, 159], [0, 159]], '#DD5946');
    c.poly([[48, 148], [64, 148], [64, 182], [48, 182]], '#244DD7');
    c.rect(27, 90, 13, 27, '#F0E7CE');
  },
  counterform(c) {
    c.shape([36, 13], [
      [59, 15, 77, 36, 72, 61], [68, 82, 49, 88, 41, 108],
      [33, 131, 63, 152, 75, 168], [58, 176, 22, 165, 17, 145],
      [6, 110, 44, 91, 47, 69], [49, 47, 35, 34, 36, 13]
    ], '#EEE5CE');
    c.shape([0, 4], [
      [27, -2, 56, 10, 56, 33], [58, 57, 29, 68, 27, 89],
      [22, 115, 40, 129, 52, 149], [59, 161, 58, 174, 56, 182],
      [34, 182, 13, 182, 0, 182], [0, 173, 0, 164, 0, 158],
      [20, 164, 31, 162, 30, 145], [29, 127, 7, 112, 8, 88],
      [9, 63, 34, 52, 33, 35], [33, 19, 13, 24, 0, 28],
      [0, 20, 0, 12, 0, 4]
    ], '#1D2021');
    c.poly([[49, 105], [73, 99], [69, 111], [44, 117]], '#D4DE46');
  },
  overprint(c) {
    c.poly([[1, 23], [57, 9], [66, 105], [11, 121]], '#DC4E37E6');
    c.poly([[24, 66], [75, 51], [68, 169], [18, 181]], '#244EB8DB');
    c.poly([[24, 66], [61, 55], [66, 105], [21, 118]], '#513960');
    c.poly([[1, 23], [6, 22], [15, 116], [11, 121]], '#DC4E37');
    c.poly([[68, 169], [63, 170], [70, 59], [75, 51]], '#244EB8');
    c.poly([[9, 30], [60, 17], [60, 20], [9, 33]], '#F3B09270');
  },
  gesture(c) {
    c.shape([49, 26], [
      [37, 39, 12, 59, 12, 77], [10, 91, 20, 96, 20, 111],
      [20, 128, 12, 144, 6, 156], [29, 139, 37, 119, 38, 105],
      [40, 90, 33, 83, 33, 70], [32, 55, 47, 39, 53, 30],
      [52, 29, 51, 27, 49, 26]
    ], '#A8A093');
    c.shape([61, 13], [
      [64, 14, 63, 16, 70, 18], [61, 32, 49, 43, 43, 57],
      [38, 69, 42, 76, 46, 88], [49, 101, 41, 118, 31, 134],
      [23, 146, 15, 154, 10, 158], [22, 134, 31, 115, 31, 102],
      [31, 91, 21, 82, 23, 69], [24, 47, 43, 29, 61, 13]
    ], '#21262A');
    // A blunt pressure break and a single offset red mark; the open lower-right
    // interval carries as much weight as the sweep itself.
    c.poly([[21, 72], [25, 68], [28, 82], [25, 89], [20, 81]], '#21262A');
    c.poly([[52, 137], [70, 131], [68, 139], [51, 144]], '#C94836');
  },
  galaxy(c) {
    for (let ring = 0; ring < 8; ring++) {
      c.arc(40, 86, 7 + ring * 3.3, 19 + ring * 6.2, -160 + ring * 12, 138 + ring * 12, 28, 1.7, ['#AD79F2','#777EF3','#E59BDD'][ring % 3]);
    }
    c.circle(40, 86, 5, '#F8D4F1');
    for (let i = 0; i < 38; i++) {
      const x = 5 + (i * 31 % 67), y = 5 + (i * 47 % 172);
      c.circle(x, y, i % 7 === 0 ? 1.65 : .7, i % 2 ? '#EFD7FF' : '#91BDF8');
    }
    c.line(8, 21, 20, 21, 1, '#FDEAB9'); c.line(14, 15, 14, 27, 1, '#FDEAB9');
    c.line(57, 157, 69, 157, 1, '#FDEAB9'); c.line(63, 151, 63, 163, 1, '#FDEAB9');
  },
  starlight(c) {
    const stars = [[15,18,6],[55,37,9],[28,76,7],[62,104,6],[17,132,10],[48,166,7]];
    c.path(stars.map(([x,y]) => [x,y]), .8, '#8198BC');
    for (const [x,y,r] of stars) {
      c.poly([[x,y-r],[x+r*.3,y-r*.3],[x+r,y],[x+r*.3,y+r*.3],[x,y+r],[x-r*.3,y+r*.3],[x-r,y],[x-r*.3,y-r*.3]], '#F4D799');
      c.circle(x, y, 1.1, '#FFF9DF');
    }
    for (let i = 0; i < 26; i++) c.circle(6 + i * 29 % 64, 9 + i * 53 % 164, i % 3 ? .75 : 1.2, '#ABBFE0');
    c.arc(19, 88, 43, 43, -67, 67, 0, .65, '#8198BC');
    c.arc(19, 88, 47, 47, -61, 61, 0, .65, '#8198BC');
  },
  moonlight(c) {
    // A crescent polygon leaves real transparency through its open center.
    const crescent = [];
    for (let a = 56; a <= 304; a += 2) crescent.push([38 + Math.cos(rad(a))*25, 43 + Math.sin(rad(a))*25]);
    for (let a = 280; a >= 80; a -= 2) crescent.push([51 + Math.cos(rad(a))*22, 43 + Math.sin(rad(a))*22]);
    c.poly(crescent, '#F0CF83');
    c.arc(38, 43, 31, 31, 38, 320, 0, .8, '#E5AEDC');
    for (const [x,y,r] of [[15,12,4],[64,75,5],[17,94,3],[55,158,4]]) c.poly([[x,y-r],[x+1.2,y-1.2],[x+r,y],[x+1.2,y+1.2],[x,y+r],[x-1.2,y+1.2],[x-r,y],[x-1.2,y-1.2]], '#F1D48E');
    c.circle(39, 113, 13, '#DD8DBE'); c.circle(39, 113, 8, '#F4D48A');
    c.poly([[39,102],[45,113],[39,124],[33,113]], '#EBAED5');
    c.poly([[26,111],[9,101],[12,125],[28,116]], '#B2A0E8');
    c.poly([[52,111],[69,101],[65,125],[50,116]], '#B2A0E8');
    c.path([[28,126],[20,151],[32,143],[35,165]], 3, '#DD8DBE');
    c.path([[47,126],[55,146],[43,140],[39,174]], 3, '#B2A0E8');
    for (let i = 0; i < 7; i++) c.circle(8 + (i*19%61), 71 + (i*23%100), .75, '#EBCBFA');
  },
  frost(c) {
    c.poly([[10,77],[9,46],[23,61],[26,22],[39,53],[52,16],[55,61],[68,41],[64,77]], '#81CDEC');
    c.poly([[17,72],[19,55],[31,68],[29,42],[40,67],[51,35],[52,70],[61,58],[58,82]], '#D4F3FA');
    c.poly([[10,77],[64,77],[59,93],[16,93]], '#3D84B4');
    c.poly([[32,79],[39,72],[46,79],[39,89]], '#C7EFF8');
    c.path([[39,101],[39,165],[24,143],[39,154],[54,136]], 1.9, '#85D9F0');
    c.path([[14,111],[25,124],[15,136],[26,152]], 1.1, '#4E93BB');
    c.path([[64,108],[54,121],[63,129],[56,157]], 1.1, '#4E93BB');
    for (let i = 0; i < 18; i++) c.circle(5 + i*29%65, 7 + i*41%165, .7, '#A7DEEF');
    c.poly([[39,169],[43,175],[39,181],[35,175]], '#9BE1F4');
  },
  orbit(c) {
    const violet = '#8C72FF', lime = '#D8F36A', lavender = '#BCADFF';
    c.circle(53, 19, 9, lime);
    c.arc(43, 78, 29, 56, -125, 180, 29, 2.1, violet);
    c.arc(43, 78, 23, 48, -121, 196, 29, 1, lavender);
    c.arc(43, 78, 16, 42, -82, 218, 29, 3.1, violet);
    c.arc(43, 78, 35, 22, 10, 295, -29, 1.25, lime);
    c.circle(12, 82, 3.6, lime);
    c.circle(49, 122, 2.4, lavender);
    c.arc(59, 166, 44, 39, 169, 292, 0, 2.2, violet);
    c.arc(59, 166, 35, 31, 169, 292, 0, 0.85, lavender);
    c.line(15, 151, 15, 163, 1.15, lime);
    c.line(9, 157, 21, 157, 1.15, lime);
    c.circle(66, 146, 1.4, lime);
  },
  studio(c) {
    const cobalt = '#5272FF', coral = '#FF7C68', cream = '#F7DDB7';
    c.poly([[10, 12], [39, 12], [39, 41], [10, 41]], cobalt);
    c.circle(39, 41, 27, coral);
    c.rect(12, 41, 27, 27, cobalt);
    c.rect(39, 14, 27, 27, cream);
    c.circle(39, 41, 10, cream);
    c.rect(13, 82, 20, 37, coral);
    c.poly([[33, 82], [63, 82], [33, 112]], cobalt);
    c.circle(56, 113, 9, cream);
    c.rect(39, 129, 27, 37, cobalt);
    for (let y = 129; y <= 164; y += 6) c.rect(11, y, 22, 2.1, cream);
    c.poly([[39, 166], [66, 139], [66, 166]], coral);
    c.circle(13, 176, 2, cobalt);
    c.circle(22, 176, 2, coral);
    c.circle(31, 176, 2, cream);
  },
  contour(c) {
    const teal = '#26B5A0', mint = '#86DDC5';
    for (let ring = 0; ring < 13; ring++) {
      const points = [], rx = 9 + ring * 3.25, ry = 16 + ring * 5.7;
      for (let step = 0; step <= 240; step++) {
        const theta = step * Math.PI * 2 / 240;
        const wave = 1 + 0.105 * Math.sin(theta * 3 + ring * 0.11) + 0.06 * Math.cos(theta * 5 - 0.4);
        points.push([52 + Math.cos(theta) * rx * wave + 7 * Math.sin(theta * 2), 81 + Math.sin(theta) * ry * wave]);
      }
      c.path(points, ring % 4 === 0 ? 1.15 : 0.75, ring % 3 === 0 ? mint : teal, true);
    }
    c.circle(51, 80, 2.2, mint);
    c.circle(15, 163, 4.4, teal);
    c.line(27, 163, 64, 163, 0.8, mint);
    for (let i = 0; i < 5; i++) c.line(37 + i * 6.7, 171, 37 + i * 6.7, 174 + i % 2 * 2, 0.8, teal);
  },
  prism(c) {
    const purple = '#AA78EF', rose = '#F06AAB', coral = '#FF937B', peach = '#FFD3A0';
    c.poly([[37, 6], [67, 6], [23, 57], [5, 40]], purple);
    c.poly([[67, 6], [67, 36], [23, 86], [23, 57]], rose);
    c.poly([[5, 40], [23, 57], [67, 107], [49, 124], [5, 74]], coral);
    c.poly([[23, 57], [23, 86], [49, 116], [67, 107]], '#DD578F');
    c.poly([[67, 107], [67, 138], [26, 178], [9, 160]], purple);
    c.poly([[49, 124], [67, 107], [26, 151], [9, 160], [9, 132]], rose);
    c.path([[47, 6], [11, 42], [57, 109], [15, 153]], 1.15, peach);
    c.line(49, 167, 65, 150, 1.2, coral);
    c.line(55, 173, 68, 160, 1.2, peach);
  },
  editorial(c) {
    const amber = '#D7A347', charcoal = '#62636B', cream = '#E7D7B7';
    c.line(12, 13, 64, 13, 1, amber);
    c.line(12, 17, 64, 17, 0.6, charcoal);
    c.rect(12, 29, 7, 7, amber);
    c.rect(24, 29, 2, 7, cream);
    c.line(12, 54, 12, 108, 1.15, amber);
    c.line(12, 54, 26, 54, 1.15, amber);
    c.line(12, 108, 26, 108, 1.15, amber);
    c.arc(56, 79, 22, 22, 90, 270, 0, 3, cream);
    c.arc(56, 79, 14, 14, 90, 270, 0, 0.8, amber);
    c.circle(60, 99, 3.5, amber);
    c.line(60, 103, 57, 109, 1.2, amber);
    c.line(12, 130, 64, 130, 0.6, charcoal);
    c.line(12, 136, 64, 136, 1.2, amber);
    for (let i = 0; i < 7; i++) c.line(12 + i * 8.5, 149, 12 + i * 8.5, i % 3 === 0 ? 159 : 154, 0.75, cream);
    c.line(12, 172, 37, 172, 0.8, amber);
    c.rect(60, 169, 5, 5, amber);
  },
  signal(c) {
    const mint = '#78DDB5', teal = '#278F7A', pale = '#C4F4DA';
    for (let x = 10; x <= 66; x += 14) for (let y = 14; y <= 168; y += 14) c.circle(x, y, 0.65, teal);
    c.path([[10, 28], [24, 28], [24, 56], [52, 56], [66, 42], [66, 14]], 1.65, mint);
    c.path([[10, 70], [24, 70], [38, 84], [38, 126], [66, 126]], 2.3, mint);
    c.path([[66, 70], [52, 70], [52, 98], [66, 112]], 0.9, pale);
    c.path([[10, 112], [24, 112], [24, 140], [38, 154], [66, 154]], 1.1, mint);
    c.path([[10, 154], [10, 168], [38, 168]], 0.8, teal);
    for (const [x, y] of [[10, 28], [66, 14], [10, 70], [66, 126], [66, 154]]) {
      c.circle(x, y, 3.1, mint);
      c.circle(x, y, 1.25, '#256F60');
    }
    c.rect(31, 28, 14, 14, mint);
    c.rect(35, 32, 6, 6, '#256F60');
    c.rect(47, 163, 4, 11, pale);
    c.rect(54, 158, 4, 16, mint);
    c.rect(61, 153, 4, 21, teal);
  }
};

export function renderPattern(name) {
  if (!Object.hasOwn(painters, name)) throw new Error(`Unknown pattern: ${name}`);
  const surface = canvas();
  painters[name](surface);
  return surface.finish();
}

export function preparePatterns(directory = new URL('../sig/', import.meta.url)) {
  mkdirSync(directory, {recursive: true});
  return patternNames.map(name => {
    const image = renderPattern(name), filename = `pattern-${name}.png`, bytes = encodePNG(image);
    writeFileSync(new URL(filename, directory), bytes);
    return {name: filename, width: image.width, height: image.height, bytes: bytes.length};
  });
}

// Independent file-contract checks include alpha diversity and distinct artwork.
// --check never rewrites assets; this catches stale or missing published files.
export function inspectPatterns(directory = new URL('../sig/', import.meta.url)) {
  const hashes = new Set();
  return patternNames.map(name => {
    const bytes = readFileSync(new URL(`pattern-${name}.png`, directory)), {width, height, rgba} = decodePNG(bytes);
    if (width !== 304 || height !== 728) throw new Error(`${name}: expected 304×728 native pixels.`);
    let visible = 0, partial = 0, opaque = 0;
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i] > 0) visible++;
      if (rgba[i] === 255) opaque++;
      if (rgba[i] > 0 && rgba[i] < 255) partial++;
    }
    const coverage = visible / (width * height);
    if (coverage < 0.035 || coverage > 0.8 || partial < 100 || opaque < 100) throw new Error(`${name}: missing negative space, ink, or antialiased edges.`);
    const identity = bytes.toString('base64');
    if (hashes.has(identity)) throw new Error(`${name}: duplicate artwork.`);
    if (!bytes.equals(encodePNG(renderPattern(name)))) throw new Error(`${name}: generated artwork is stale; run node scripts/prepare-patterns.mjs.`);
    hashes.add(identity);
    return {name, width, height, bytes: bytes.length, coverage: Number(coverage.toFixed(4)), partial, opaque};
  });
}

export function prepareArtworkProof(target = new URL('../docs/design-artwork.png', import.meta.url)) {
  const width = patternNames.length * 180, height = 848, rgba = Buffer.alloc(width * height * 4);
  const backgrounds = [[247, 245, 239], [25, 28, 36]];
  const sources = patternNames.map(renderPattern);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rgba.set([...backgrounds[y < 424 ? 0 : 1], 255], (y * width + x) * 4);
  for (let row = 0; row < 2; row++) for (let column = 0; column < patternNames.length; column++) {
    const source = sources[column], bg = backgrounds[row];
    const ox = column * 180 + 14, oy = row * 424 + 30;
    for (let y = 0; y < 364; y++) for (let x = 0; x < 152; x++) {
      const dst = ((oy + y) * width + ox + x) * 4, sum = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const s = ((y * 2 + dy) * source.width + x * 2 + dx) * 4, a = source.rgba[s + 3] / 255;
        for (let c = 0; c < 3; c++) sum[c] += source.rgba[s + c] * a + bg[c] * (1 - a);
      }
      for (let c = 0; c < 3; c++) rgba[dst + c] = Math.round(sum[c] / 4);
    }
  }
  writeFileSync(target, encodePNG({width, height, rgba}));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const check = process.argv.includes('--check');
  for (const file of check ? inspectPatterns() : preparePatterns()) console.log(JSON.stringify(file));
  if (process.argv.includes('--proof') && !check) prepareArtworkProof();
}
