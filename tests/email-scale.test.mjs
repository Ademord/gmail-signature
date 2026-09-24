import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import core from '../signature-core.js';

const values = overrides => ({...core.defaults,...overrides});
const ids = core.designs.map(design => design.id);
const customPattern = JSON.stringify({palette:['#336699','#dd6146'],rows:['....','.00.','.11.','....']});
const r3 = number => Math.round(number * 1000) / 1000;
const TAG = /<[^>]*>/g;
// An independent reader for the generated markup: a tag name followed by
// double-quoted attributes, in order. Escaped user text never contains quotes.
function parseTag(tag) {
  const head = /^<\/?([a-z][a-z\d]*)/i.exec(tag), attrs = [], pattern = /\s+([a-z][a-z\d-]*)="([^"]*)"/iy;
  assert.ok(head,'tag has a name: ' + tag.slice(0,60));
  let position = pattern.lastIndex = head[0].length, match;
  while ((match = pattern.exec(tag))) { attrs.push([match[1].toLowerCase(),match[2]]); position = pattern.lastIndex; }
  assert.match(tag.slice(position),/^\s*\/?>$/,'tag parses completely: ' + tag.slice(0,80));
  return {name:head[1].toLowerCase(),attrs};
}
const PX = /(^|[^\w.#%-])(-?(?:\d+(?:\.\d+)?|\.\d+))px(?![\w%-])/g;
function styleParts(style) {
  const urls = [], numbers = [];
  const skeleton = style.replace(/url\([^)]*\)/gi,url => { urls.push(url); return 'url()'; })
    .replace(PX,(_,lead,number) => { numbers.push(number); return lead + '#px'; });
  return {skeleton,urls,numbers};
}
const numericDimension = value => /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0;
function numericTokens(html) {
  let count = 0;
  for (const tag of html.match(TAG)) for (const [key,value] of parseTag(tag).attrs) {
    if (key === 'style') count += styleParts(value).numbers.length;
    else if ((key === 'width' || key === 'height') && numericDimension(value)) count++;
  }
  return count;
}
// Compares a scaled copy with the 100% render: identical text, tags and
// attributes, except px lengths and width/height attributes, which must be
// proportional (CSS within 0.0005 px, at most three decimals; attributes
// whole pixels within 0.5 px). URLs inside styles must be byte-identical.
function assertScaled(base, scaled, scale, label) {
  const before = base.match(TAG), after = scaled.match(TAG);
  assert.equal(after.length,before.length,label + ' keeps every tag');
  assert.deepEqual(scaled.split(TAG),base.split(TAG),label + ' keeps all text between tags byte-identical');
  let lengths = 0;
  before.forEach((tag,i) => {
    const a = parseTag(tag), b = parseTag(after[i]);
    assert.equal(b.name,a.name,label + ' tag order');
    assert.deepEqual(b.attrs.map(entry => entry[0]),a.attrs.map(entry => entry[0]),label + ' attribute order');
    a.attrs.forEach(([key,value],j) => {
      const out = b.attrs[j][1];
      if ((key === 'width' || key === 'height') && numericDimension(value)) {
        assert.match(out,/^[1-9]\d*$/,label + ' whole positive ' + key + ' attribute');
        assert.ok(Math.abs(Number(out) - Number(value) * scale / 100) <= 0.5 + 1e-9,label + ' ' + key + '="' + value + '" -> "' + out + '"');
        lengths++;
      } else if (key === 'style') {
        const x = styleParts(value), y = styleParts(out);
        assert.equal(y.skeleton,x.skeleton,label + ' style keeps every non-length token');
        assert.deepEqual(y.urls,x.urls,label + ' style URLs are byte-identical');
        assert.equal(y.numbers.length,x.numbers.length,label + ' style length count');
        y.numbers.forEach((number,k) => {
          assert.doesNotMatch(number,/\.\d{4}/,label + ' at most three decimals');
          assert.ok(Math.abs(Number(number) - Number(x.numbers[k]) * scale / 100) <= 0.0005 + 1e-9,label + ' ' + x.numbers[k] + 'px -> ' + number + 'px');
          lengths++;
        });
      } else assert.equal(out,value,label + ' ' + key + ' attribute is unchanged');
    });
  });
  assert.ok(lengths > 0,label + ' scaled some geometry');
}
const budgetLength = (html, v) => (v.portraitData ? html.replace(v.portraitData,'') : html).length;
// Renders the 100% base once, then each requested scale. A scaled copy may be
// refused only by the 10,000-character budget, and only when the base is close
// enough for scaling to cross it: each numeric token grows by at most three
// characters (an integer gains at most two decimals).
function scaledCopies(v, options, scales, label) {
  const base = core.render(v,options), tokens = numericTokens(base), copies = {};
  for (const scale of scales) {
    try { copies[scale] = core.renderEmail(v,{...options,scale}); }
    catch (error) {
      const reason = error.errors && (error.errors.website || error.errors.customPattern);
      if (!reason || !/10,000/.test(reason)) throw error;
      assert.ok(budgetLength(base,v) + 3 * tokens >= 10000,label + ' at ' + scale + '% is refused only near the budget');
      copies[scale] = null;
      continue;
    }
    assert.ok(budgetLength(copies[scale],v) < 10000,label + ' at ' + scale + '% stays under 10,000 characters');
    assert.doesNotMatch(copies[scale],/(?:transform|zoom)\s*:/i,label + ' uses no CSS transform or zoom');
    assertScaled(base,copies[scale],scale,label + ' at ' + scale + '%');
  }
  return {base,copies};
}
function outer(html) {
  const style = parseTag(html.match(TAG)[0]).attrs.find(entry => entry[0] === 'style')[1];
  return {width:Number(/(?:^|;)width:([\d.]+)px/.exec(style)[1]),height:Number(/(?:^|;)height:([\d.]+)px/.exec(style)[1])};
}
const crcTable = Array.from({length:256},(_,n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc(bytes) { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length,0); out.write(type,4,'ascii'); data.copy(out,8);
  out.writeUInt32BE(crc(out.subarray(4,8 + data.length)),8 + data.length);
  return out;
}
// A square RGB PNG with noisy pixels, so larger sizes stay large after deflate.
function png(size) {
  const header = Buffer.alloc(13), stride = 1 + size * 3, raw = Buffer.alloc(size * stride);
  header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8] = 8; header[9] = 2;
  let seed = 7;
  for (let i = 0; i < raw.length; i++) raw[i] = i % stride ? (seed = (Math.imul(seed,1103515245) + 12345) >>> 0) >>> 24 : 0;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}

test('100% email copies and dimensions are identical to render and dimensions', () => {
  for (const design of ids) for (const cardFormat of ['auto','single','front-back']) for (const layout of ['paired','stacked']) {
    const v = values({design,cardFormat,layout}), html = core.render(v), label = design + ' ' + cardFormat + ' ' + layout;
    for (const options of [undefined,null,{},{scale:100},{scale:undefined}]) assert.equal(core.renderEmail(v,options),html,label);
    assert.equal(core.renderEmail(v,{scale:100,assetBase:'./sig'}),core.render(v,{assetBase:'./sig'}),label + ' passes render options through');
    assert.deepEqual(core.emailDimensions(v),core.dimensions(v),label);
    assert.deepEqual(core.emailDimensions(v,100),core.dimensions(v),label);
  }
  assert.equal(core.renderEmail(values({pattern:'galaxy',artworkPlacement:'background'})),core.render(values({pattern:'galaxy',artworkPlacement:'background'})));
});

test('every design, card format and layout scales its native geometry at 50, 80 and 150%', () => {
  let attempts = 0, copied = 0;
  for (const design of ids) for (const cardFormat of ['auto','single','front-back']) for (const layout of ['paired','stacked']) {
    const v = values({design,cardFormat,layout}), label = design + ' ' + cardFormat + ' ' + layout;
    const {base,copies} = scaledCopies(v,undefined,[50,80,150],label);
    assert.deepEqual(outer(base),core.dimensions(v),label + ' base canvas');
    for (const scale of [50,80,150]) {
      attempts++;
      if (!copies[scale]) continue;
      copied++;
      assert.deepEqual(outer(copies[scale]),core.emailDimensions(v,scale),label + ' scaled canvas matches emailDimensions at ' + scale + '%');
    }
  }
  assert.ok(copied >= attempts / 2,'most template copies fit the budget (' + copied + '/' + attempts + ')');
});

test('every whole scale from 50 to 150 is exact for the default signature', () => {
  const v = values(), scales = Array.from({length:101},(_,i) => 50 + i);
  const {copies} = scaledCopies(v,undefined,scales,'default');
  for (const scale of scales) {
    assert.ok(copies[scale],'default signature fits the budget at ' + scale + '%');
    assert.deepEqual(outer(copies[scale]),core.emailDimensions(v,scale),'default canvas at ' + scale + '%');
  }
});

test('backgrounds, fades, flowing art, mosaics and portraits scale without touching URLs or colors', () => {
  const cases = [
    ['background radial',values({pattern:'galaxy',artworkPlacement:'background',artworkFade:'radial',artworkFadeX:30,artworkScale:140,artworkPositionX:20})],
    ['background linear single',values({design:'orbit',cardFormat:'single',pattern:'dots',artworkPlacement:'background',artworkFade:'linear',artworkFadeAngle:45,artworkOpacity:60})],
    ['background stacked front-back',values({design:'contour',cardFormat:'front-back',layout:'stacked',pattern:'frost',artworkPlacement:'background',artworkPositionY:100})],
    ['flow original',values({pattern:'cutpaper'})],
    ['flow studio stacked',values({design:'studio',pattern:'colorfield',layout:'stacked'})],
    ['custom mosaic',values({pattern:'custom',customPattern})],
    ['custom mosaic placed',values({pattern:'custom',customPattern,motifScale:60,motifPositionX:100})],
    ['custom background',values({pattern:'custom',customPattern,artworkPlacement:'background',artworkOpacity:70})],
    ['portrait url',values({portraitUrl:'https://img.example.com/p.png',portraitShape:'rounded',portraitSize:72})]
  ];
  for (const [label,v] of cases) {
    const {base,copies} = scaledCopies(v,undefined,[50,80,150],label);
    assert.ok(Object.values(copies).some(Boolean),label + ' has a copy within budget');
    for (const html of Object.values(copies).filter(Boolean)) {
      const urls = source => [...source.matchAll(/url\([^)]*\)/g)].map(match => match[0]);
      assert.deepEqual(urls(html),urls(base),label + ' style URLs');
      for (const color of base.match(/#[0-9a-f]{6}\b/g)) assert.ok(html.includes(color),label + ' keeps ' + color);
    }
  }
  const radial = scaledCopies(cases[0][1],undefined,[80],'radial').copies[80];
  assert.ok(radial.includes('circle farthest-corner at 30% 50%'),'fade percentages are unchanged');
  assert.ok(radial.includes('100% 100%') || radial.includes('background-size:'),'background sizes remain present');
  const custom = scaledCopies(cases[7][1],undefined,[80],'custom background').copies[80];
  assert.ok(custom.includes('linear-gradient(#336699,#336699)'),'custom background colors are unchanged');
});

test('links, text, image sources and style URLs stay byte-identical even when they look like px', () => {
  const v = values({nameLine1:'12px',nameLine2:'Morgan height=',title:'Lead 9px width:10px',subtitle:'AI & 3PX',
    websiteLabel:'14px & "2px"',website:'https://example.com/20px/page-10px.png',email:'px10@example.com',
    location:'Zone 10px <b>',tags:'8PX · 10px · AI',imageBase:'https://cdn.example.com/10px/a-12px',
    portraitUrl:'https://img.example.com/14px/photo-96px.png',portraitShape:'rounded',pattern:'galaxy',artworkPlacement:'background'});
  const {base,copies} = scaledCopies(v,undefined,[50,80,150],'px-like content');
  const pick = (html, pattern) => [...html.matchAll(pattern)].map(match => match[1]);
  const hrefs = html => pick(html,/ href="([^"]*)"/g), srcs = html => pick(html,/ src="([^"]*)"/g), alts = html => pick(html,/ alt="([^"]*)"/g);
  const urls = html => pick(html,/(url\([^)]*\))/g), count = (html, text) => html.split(text).length - 1;
  assert.ok(hrefs(base).includes('https://example.com/20px/page-10px.png'));
  assert.ok(srcs(base).includes('https://img.example.com/14px/photo-96px.png'));
  assert.ok(srcs(base).some(src => src.startsWith('https://cdn.example.com/10px/a-12px/icon-')));
  assert.ok(urls(base).some(url => url.includes('https://cdn.example.com/10px/a-12px/pattern-galaxy.png')));
  const texts = ['>12px<','Morgan height=','Lead 9px width:10px','AI &amp; 3PX','14px &amp; &quot;2px&quot;','Zone 10px &lt;b&gt;','8PX · 10px · AI','px10@example.com'];
  for (const text of texts) assert.ok(base.includes(text),'fixture renders ' + text);
  for (const scale of [50,80,150]) {
    const html = copies[scale];
    assert.ok(html,'px-like fixture fits the budget at ' + scale + '%');
    assert.deepEqual(hrefs(html),hrefs(base),'hrefs at ' + scale + '%');
    assert.deepEqual(srcs(html),srcs(base),'image sources at ' + scale + '%');
    assert.deepEqual(alts(html),alts(base),'alt text at ' + scale + '%');
    assert.deepEqual(urls(html),urls(base),'style URLs at ' + scale + '%');
    for (const text of texts) assert.equal(count(html,text),count(base,text),text + ' at ' + scale + '%');
    const photo = Object.fromEntries(parseTag(html.match(/<img\b[^>]*photo-96px[^>]*>/)[0]).attrs);
    assert.equal(photo.alt,'12px Morgan height=');
    assert.equal(photo.width,String(Math.round(64 * scale / 100)));
    assert.equal(photo.height,String(Math.round(64 * scale / 100)));
    assert.equal(photo.style,'display:block;width:' + r3(64 * scale / 100) + 'px;height:' + r3(64 * scale / 100) + 'px;border:0;border-radius:' + r3(12 * scale / 100) + 'px');
  }
});

test('photo shapes keep their radius form while the photo size scales', () => {
  for (const shape of ['circle','rounded','square']) for (const portraitSize of [40,96]) for (const scale of [50,80,100,150]) {
    const v = values({portraitUrl:'https://img.example.com/p.png',portraitShape:shape,portraitSize}), html = core.renderEmail(v,{scale});
    const photo = Object.fromEntries(parseTag(html.match(/<img\b[^>]*img\.example\.com\/p\.png[^>]*>/)[0]).attrs);
    const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? r3(12 * scale / 100) + 'px' : '0';
    assert.equal(photo.src,'https://img.example.com/p.png');
    assert.equal(photo.width,String(Math.round(portraitSize * scale / 100)),shape + ' ' + portraitSize + ' at ' + scale + '%');
    assert.ok(photo.style.endsWith(';border-radius:' + radius),shape + ' radius at ' + scale + '%');
    assert.ok(photo.style.includes('width:' + r3(portraitSize * scale / 100) + 'px;height:' + r3(portraitSize * scale / 100) + 'px'),shape + ' size at ' + scale + '%');
  }
});

test('contact separators and hairline rules scale with their rows', () => {
  const marks = html => [...html.matchAll(/(<td\b[^>]*aria-hidden="true"[^>]*>)([^<]*)<\/td>/g)].map(match => ({attrs:Object.fromEntries(parseTag(match[1]).attrs),glyph:match[2]}));
  for (const [label,v,glyph] of [['compact bar',values(core.compactPreset),'|'],['original dot',values({contactLayout:'inline',contactSeparator:'dot'}),'·'],
    ['signal slash',values({design:'signal',cardFormat:'single',contactLayout:'inline',contactSeparator:'slash'}),'/']]) {
    const {base,copies} = scaledCopies(v,undefined,[50,80,150],label), before = marks(base);
    assert.ok(before.length > 0,label + ' renders separators');
    for (const scale of [50,80,150]) {
      if (!copies[scale]) continue;
      const after = marks(copies[scale]);
      assert.equal(after.length,before.length,label + ' separator count at ' + scale + '%');
      after.forEach((mark,i) => {
        assert.equal(mark.glyph,glyph);
        assert.equal(mark.attrs.width,String(Math.max(1,Math.round(Number(before[i].attrs.width) * scale / 100))),label + ' separator width at ' + scale + '%');
        for (const property of ['font-size','line-height']) {
          const size = Number(new RegExp(property + ':([\\d.]+)px').exec(before[i].attrs.style)[1]);
          assert.ok(mark.attrs.style.includes(property + ':' + r3(size * scale / 100) + 'px'),label + ' separator ' + property + ' at ' + scale + '%');
        }
      });
    }
  }
  const {base,copies} = scaledCopies(values(),undefined,[50,150],'rules');
  assert.ok(base.includes('<td height="1" style="padding:0;height:1px;'),'the footer rule is a 1 px row');
  assert.ok(copies[50].includes('<td height="1" style="padding:0;height:0.5px;'),'a half-size rule keeps a whole-pixel attribute');
  assert.ok(copies[150].includes('<td height="2" style="padding:0;height:1.5px;'),'a larger rule scales');
});

test('local photos keep the public-URL export guard, and allowed data URIs are copied outside the budget', () => {
  for (const size of [2,64]) {
    const data = png(size), v = values({portraitData:data});
    assert.deepEqual(core.validate(v),{},'fixture photo ' + size + ' is valid');
    for (const options of [undefined,{scale:80},{scale:150,assetBase:'./sig'}]) {
      assert.throws(() => core.renderEmail(v,options),error => /public HTTPS URL/.test(error.errors && error.errors.portraitUrl),'guard ' + JSON.stringify(options));
    }
    for (const options of [{allowPortraitData:true},{preview:true}]) {
      const {copies} = scaledCopies(v,options,[50,80,150],'photo ' + size + ' ' + Object.keys(options)[0]);
      for (const scale of [50,80,150]) {
        assert.ok(copies[scale],'photo copy at ' + scale + '%');
        assert.equal(copies[scale].split('src="' + data + '"').length,2,'the data URI is copied exactly once');
      }
      if (size === 64) {
        assert.ok(data.length > 10000,'large fixture photo exceeds the HTML budget by itself');
        assert.ok(copies[80].length > 10000,'the budget excludes the allowed local photo');
      }
    }
    const published = values({portraitData:data,portraitUrl:'https://img.example.com/p.png'});
    assert.ok(!core.renderEmail(published,{scale:80}).includes(data),'public URL export leaves out the local photo');
  }
});

test('invalid scales are rejected without coercion', () => {
  const v = values();
  const invalid = [null,'80','100','',' 80 ',NaN,Infinity,-Infinity,80.5,49.999,49,151,0,-0,-80,1e3,true,false,{},[],[80],80n,Number.MIN_VALUE];
  const rejected = error => error instanceof TypeError && /50 to 150/.test(error.message) && error.errors && error.errors.emailScale === error.message;
  for (const scale of invalid) {
    assert.throws(() => core.renderEmail(v,{scale}),rejected,'renderEmail rejects ' + String(scale));
    assert.throws(() => core.emailDimensions(v,scale),rejected,'emailDimensions rejects ' + String(scale));
  }
  for (const options of ['80',80,true,() => {}]) assert.throws(() => core.renderEmail(v,options),TypeError,'options must be an object');
  assert.throws(() => core.renderEmail(values({nameLine1:''}),{scale:80}),error => Boolean(error.errors && error.errors.nameLine1),'values are still validated');
  for (const scale of [50,51,99,101,149,150]) {
    assert.equal(typeof core.renderEmail(v,{scale}),'string');
    assert.equal(typeof core.emailDimensions(v,scale).width,'number');
  }
});

test('email dimensions scale the canvas and round to three decimals', () => {
  const compact = values(core.compactPreset);
  assert.equal(core.dimensions(compact).width,560);
  assert.deepEqual(core.emailDimensions(compact,80),{width:448,height:r3(core.dimensions(compact).height * .8)});
  for (const v of [values(),compact,values({width:283,height:197,layout:'stacked'}),values({design:'prism',cardFormat:'single',width:301}),values({cardGap:7})]) {
    const size = core.dimensions(v);
    for (let scale = 50; scale <= 150; scale++) {
      const scaled = core.emailDimensions(v,scale);
      assert.deepEqual(Object.keys(scaled),['width','height']);
      for (const key of ['width','height']) {
        assert.ok(Math.abs(scaled[key] - size[key] * scale / 100) <= 0.0005 + 1e-9,key + ' at ' + scale + '%');
        assert.doesNotMatch(String(scaled[key]),/\.\d{4}|e/,key + ' has at most three decimals');
      }
    }
  }
});

test('scaling never mutates inputs or compounds across repeated changes', () => {
  const v = Object.freeze(values({pattern:'galaxy',artworkPlacement:'background',artworkFade:'linear'})), snapshot = JSON.stringify(v);
  const options = Object.freeze({scale:80,assetBase:'./sig'});
  const first = core.renderEmail(v,options);
  assert.equal(JSON.stringify(v),snapshot,'values are unchanged');
  assert.deepEqual(options,{scale:80,assetBase:'./sig'},'options are unchanged');
  assert.equal(core.renderEmail(v,options),first,'the same scale gives the same bytes');
  for (const scale of [150,50,120,80,100,63]) core.renderEmail(v,{scale,assetBase:'./sig'});
  assert.equal(core.renderEmail(v,options),first,'switching scales never compounds');
  assert.equal(core.renderEmail(v,{assetBase:'./sig'}),core.render(v,{assetBase:'./sig'}),'returning to 100% restores the original bytes');
  assertScaled(core.render(v,{assetBase:'./sig'}),first,80,'80% is measured from the original render');
  assert.deepEqual(core.emailDimensions(v,80),core.emailDimensions(v,80));
  const again = core.renderEmail(v,{scale:80,assetBase:'./sig'});
  assert.equal(again,first);
});

test('the scaled copy is rechecked against the 10,000 character budget', () => {
  // One growing padding length fills the website, LinkedIn and image URLs in
  // turn; the LinkedIn path is long enough to show only its host.
  const padded = k => values({email:'budget.check@example.com',pattern:'galaxy',artworkPlacement:'background',
    website:'https://example.com/' + 'w'.repeat(Math.min(k,990)),
    linkedin:'https://www.linkedin.com/in/' + 'l'.repeat(20 + Math.max(0,Math.min(k - 990,450))),
    imageBase:'https://cdn.example.com/' + 'i'.repeat(Math.max(0,Math.min(k - 1440,470)))});
  const works = k => {
    try { core.render(padded(k)); return true; }
    catch (error) { assert.match(error.errors && error.errors.website,/10,000/,'only the budget refuses padding ' + k); return false; }
  };
  let low = 0, high = 1910;
  assert.ok(works(low),'the unpadded fixture renders');
  assert.ok(!works(high),'the fully padded fixture crosses the budget');
  while (high - low > 1) { const middle = (low + high) >> 1; if (works(middle)) low = middle; else high = middle; }
  const v = padded(low), base = core.render(v);
  assert.ok(base.length < 10000 && base.length > 9900,'the fixture sits just below the budget: ' + base.length);
  assert.equal(core.renderEmail(v,{scale:100}),base,'100% keeps the render budget decision');
  assert.throws(() => core.renderEmail(v,{scale:51}),error => error instanceof TypeError && /too long/.test(error.message) && /10,000/.test(error.errors.website),
    'a longer scaled copy is refused');
  for (const scale of [50,80,150]) {
    try { assert.ok(core.renderEmail(v,{scale}).length < 10000); }
    catch (error) { assert.match(error.errors && error.errors.website,/10,000/); }
  }
});
