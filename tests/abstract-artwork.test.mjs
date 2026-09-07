// Independent artwork contracts: fixed rosters must catch an omitted study even
// when the runtime catalog or public allowlist is accidentally reduced.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import core from '../signature-core.js';
import image from '../signature-image.js';
import session from '../session-data.js';
import ai from '../ai-extension-core.js';
import collections from '../design-collections.js';
import {decodePNG} from '../scripts/prepare-icons.mjs';
import {PUBLIC_FILES, requestedPublicFile} from '../scripts/public-files.mjs';
import {createPublicServer} from '../scripts/serve.mjs';

const abstractIds = ['cutpaper','colorfield','chromatic','counterform','overprint','gesture'];
const fantasyIds = ['galaxy','starlight','moonlight','frost'];
const designIds = ['original','orbit','studio','contour','prism','editorial','signal'];
const abstractFiles = [
  'sig/pattern-cutpaper.png', 'sig/pattern-colorfield.png', 'sig/pattern-chromatic.png',
  'sig/pattern-counterform.png', 'sig/pattern-overprint.png', 'sig/pattern-gesture.png'
];
const fantasyFiles = ['sig/pattern-galaxy.png','sig/pattern-starlight.png','sig/pattern-moonlight.png','sig/pattern-frost.png'];
// Existing compact identity slots can be fully occupied by the photo. Keep this
// exception roster explicit so disappearing artwork in other cases still fails.
const photoOccupiedSlots = new Set([
  'contour:paired:280:180:64', 'contour:paired:280:180:96', 'contour:paired:321:208:96',
  'editorial:paired:280:180:96', 'editorial:paired:321:208:96'
]);
const project = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(new URL('../' + name, import.meta.url));
const photo = 'data:image/png;base64,' + read('sig/icon-web.png').toString('base64');
const photoUrl = 'https://example.com/cropped-portrait.png?v=2';
const assetBase = 'https://example.com/signature-assets';
const draft = changes => ({...core.defaults, nameLine1:'Zoë', nameLine2:'Atlas', title:'Designer',
  website:'https://example.com/work', websiteLabel:'Selected work', imageBase:assetBase, ...changes});
const artworkTag = (html, id) => {
  const tags = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  const selected = tags.filter(tag => tag.includes('/pattern-' + id + '.png"'));
  assert.equal(selected.length, 1, id + ' appears exactly once');
  assert.match(selected[0], /alt=""/);
  const [,width,height] = selected[0].match(/width="(\d+)" height="(\d+)"/);
  assert.ok(Number(width) > 0 && Number(height) > 0);
  assert.ok(Math.abs(Number(width) - Number(height) * 76 / 182) <= .5, 'artwork keeps its portrait ratio after pixel rounding');
  return selected[0];
};

test('six named abstract collections precede and preserve all four fantasy collections', () => {
  assert.deepEqual(collections.map(item => item.id), [...abstractIds,...fantasyIds]);
  assert.deepEqual(collections.filter(item => item.category === 'abstract').map(item => item.id), abstractIds);
  assert.ok(Object.isFrozen(collections) && collections.every(Object.isFrozen));
  for (const id of abstractIds) {
    const collection = collections.find(item => item.id === id);
    assert.equal(collection.pattern, id);
    assert.ok(designIds.includes(collection.design), id + ' uses a supported composition');
    assert.equal(typeof core.patterns[id], 'string');
    for (const key of ['frontBackground','backBackground','accent']) assert.match(collection[key], /^#[0-9a-f]{6}$/);
  }
});

test('six distinct decodable portrait PNGs are public alongside every preserved fantasy asset', () => {
  const pixelHashes = new Set();
  for (const name of [...abstractFiles,...fantasyFiles]) {
    assert.ok(PUBLIC_FILES.includes(name), name + ' remains in the public release');
    assert.equal(requestedPublicFile('/' + name + '?v=artwork-review'), name);
    const decoded = decodePNG(read(name));
    assert.equal(decoded.width, 304, name); assert.equal(decoded.height, 728, name);
    const hash = createHash('sha256').update(decoded.rgba).digest('hex');
    assert.ok(!pixelHashes.has(hash), name + ' is not a duplicate of another abstract or fantasy study');
    pixelHashes.add(hash);
    assert.ok(decoded.rgba.some((value,index) => index % 4 === 3 && value > 0), name + ' contains visible pixels');
  }
  assert.equal(PUBLIC_FILES.length, 50);
});

test('every abstract pattern supports all seven designs and photo sizes in wide and tall formats', () => {
  for (const pattern of abstractIds) for (const design of designIds) for (const layout of ['paired','stacked']) {
    for (const [width,height] of [[280,180],[321,208],[420,320]]) for (const photoSize of [0,40,64,96]) {
      const withPhoto = photoSize > 0;
      const label = [pattern,design,layout,width,height,photoSize].join(':');
      const value = draft({pattern,design,layout,width,height,
        portraitData:withPhoto ? photo : '', portraitUrl:withPhoto ? photoUrl : '', portraitSize:photoSize || 64});
      assert.deepEqual(core.validate(value), {}, label);
      const html = core.render(value), preview = core.render(value,{preview:true,assetBase:'./sig'});
      assert.ok(html.length < 10000, label + ': ' + html.length + ' HTML characters');
      if (photoOccupiedSlots.has([design,layout,width,height,photoSize].join(':'))) {
        assert.ok(!html.includes('/pattern-'+pattern+'.png') && !preview.includes('/pattern-'+pattern+'.png'),label + ' retains the existing photo-filled slot');
        assert.equal(value.pattern,pattern,label + ' keeps the artwork selected');
        artworkTag(core.render({...value,portraitData:'',portraitUrl:''}),pattern);
      } else {
        assert.match(artworkTag(html,pattern), /src="https:\/\/example.com\/signature-assets\/pattern-/);
        assert.match(artworkTag(preview,pattern), /src="\.\/sig\/pattern-/);
      }
      assert.doesNotMatch(html, /data:image|blob:|<(?:script|svg|canvas|iframe|style)\b|\bon[a-z]+=|background-image|display:(?:flex|grid)|position:/i);
      assert.ok(html.includes('href="https://example.com/work"'), label);
      assert.equal(core.plainText(value), core.plainText(draft()), label);
      const logicalWidth = layout === 'paired' ? width * 2 + 20 : width;
      const logicalHeight = layout === 'paired' ? height : height * 2 + 20;
      assert.match(html, new RegExp('^<table[^>]+width="' + logicalWidth + '" height="' + logicalHeight + '"'));
      assert.deepEqual(image.dimensions(value,4), {width:logicalWidth*4,height:logicalHeight*4,logicalWidth,logicalHeight});
      if (withPhoto) {
        assert.ok(html.includes('src="' + photoUrl + '"'), label);
        assert.ok(preview.includes(photo), label + ' preserves the local crop');
      }
    }
  }
});

test('abstract artwork and photos round-trip without changing the selected design, details, theme or UI', () => {
  const theme = {id:'theme-abstract',name:'Saved study',frontBackground:'#f5f0e6',backBackground:'#282b35',accent:'#325ea8'};
  for (const pattern of abstractIds) for (const design of designIds) for (const layout of ['paired','stacked']) {
    const input = {draft:draft({pattern,design,layout,portraitData:photo,portraitUrl:photoUrl,portraitShape:'rounded',portraitSize:96}),
      themes:[theme],ui:{editorTab:'design',previewView:'card',imageScale:4,imageBackground:'transparent',selectedThemeId:theme.id,themeName:theme.name}};
    const restored = session.parse(session.serialize(input));
    assert.deepEqual(restored, input, pattern + ':' + design + ':' + layout);
    assert.equal(core.render(restored.draft), core.render(input.draft));
    if (photoOccupiedSlots.has([design,layout,321,208,96].join(':'))) {
      assert.ok(!core.render(restored.draft).includes('/pattern-'+pattern+'.png'));
      artworkTag(core.render({...restored.draft,portraitData:'',portraitUrl:''}),pattern);
    } else artworkTag(core.render(restored.draft), pattern);
    assert.ok(core.render(restored.draft,{preview:true}).includes(photo));
  }
});

test('AI artwork prompts list all six ids and proposals apply only the requested artwork', () => {
  const value = draft({design:'editorial',portraitData:photo,portraitUrl:photoUrl});
  const prompt = ai.buildPrompt('artwork',value);
  const choices = prompt.match(/pattern choices: ([^.]+)\./)[1].split(', ');
  for (const pattern of abstractIds) {
    assert.ok(choices.includes(pattern), pattern + ' is offered to the AI');
    const text = JSON.stringify({format:'signature-ai',version:1,section:'artwork',name:'Abstract study',changes:{pattern}});
    const proposal = ai.createProposal(text,{section:'artwork',draft:value});
    const patch = ai.applyProposal(proposal,value);
    assert.deepEqual(patch,{pattern});
    assert.deepEqual(proposal.candidate,{...value,pattern});
    artworkTag(core.render(proposal.candidate),pattern);
  }
  assert.ok(!prompt.includes(photo) && !prompt.includes(photoUrl) && !prompt.includes(assetBase));
});

test('the complete HTML budget still rejects oversized hosted paths for each abstract pattern', () => {
  const oversizedBase = 'https://example.com/' + 'a'.repeat(3000);
  for (const pattern of abstractIds) {
    const value = draft({pattern,portraitUrl:photoUrl});
    assert.deepEqual(core.validate(value),{});
    assert.throws(() => core.render(value,{assetBase:oversizedBase}), error =>
      /too long/.test(error.message) && /10,000/.test(error.errors?.website), pattern);
  }
});

test('the real static server returns the exact six abstract PNGs through their hosted paths', async t => {
  const server = createPublicServer(project);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve())));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const name of abstractFiles) {
    const response = await fetch(base + '/' + name + '?v=abstract-review');
    assert.equal(response.status,200,name);
    assert.match(response.headers.get('content-type'), /^image\/png/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),read(name),name);
  }
});
