// Independent side-artwork geometry and data contracts. These inspect emitted
// email tables and real asset bytes; they do not establish received-mail fidelity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import core from '../signature-core.js';
import codec from '../session-data.js';
import ai from '../ai-extension-core.js';
import image from '../signature-image.js';
import {decodePNG} from '../scripts/prepare-icons.mjs';
import {PUBLIC_FILES,requestedPublicFile} from '../scripts/public-files.mjs';

const keys=['motifScale','motifPositionX','motifPositionY'];
const neutral={motifScale:100,motifPositionX:50,motifPositionY:0};
const newPatterns=['neural','latent','tokenweave','resonance'];
const patterns=['dots','orbit','studio','contour','prism','editorial','signal','galaxy','starlight','moonlight','frost',...newPatterns];
const recipe=JSON.stringify({palette:['#2348c7','#dd6146'],rows:['00..','00..','....','..11','..11','....','....','....']});
const values=patch=>({...core.defaults,design:'studio',layout:'stacked',pattern:'signal',...patch});
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const fileFor=pattern=>pattern==='dots'?'dots.png':'pattern-'+pattern+'.png';
const checksum=bytes=>createHash('sha256').update(bytes).digest('hex');

// Match the artwork's actual enclosing cell, rather than trusting motifBounds
// to confirm geometry that the renderer may have forgotten to use.
function imageGeometry(html,pattern) {
  const stack=[];
  for(const match of html.matchAll(/<\/?(?:table|tr|td)\b[^>]*>|<img\b[^>]*>/g)) {
    const tag=match[0];
    if(tag.startsWith('</')) {stack.pop();continue;}
    if(tag.startsWith('<img')) {
      const art=attributes(tag);
      if(!art.src?.endsWith('/'+fileFor(pattern)))continue;
      const cell=attributes(stack.findLast(item=>item.startsWith('<td')));
      const padding=cell.style.match(/(?:^|;)padding:([^;]+)/)?.[1].split(/\s+/).map(parseFloat)||[0];
      const [top,right,bottom,left]=padding.length===4?padding:[padding[0],padding[0],padding[0],padding[0]];
      return {width:Number(art.width),height:Number(art.height),top,right,bottom,left,source:art.src};
    }
    stack.push(tag);
  }
  assert.fail('Expected a visible '+pattern+' image in the emitted signature');
}

test('neutral side-artwork settings preserve published Grid, photo and custom mosaic bytes',()=>{
  const fixtures=[
    [{},'94ae93e5c61010a5ac4551349ddb37114642e18c7411ff3116fa2a7da05537c8'],
    [{portraitUrl:'https://example.com/photo.png',portraitSize:64},'f6f0f4c955eeff71a014f211cfecaed24c2102d178a730c8880bc75aedf814a0'],
    [{pattern:'custom',customPattern:recipe},'6d14232ea110fb5947088bc10534e9c9a68791777cf86bec75054e952edc90a3']
  ];
  assert.deepEqual(Object.fromEntries(keys.map(key=>[key,core.defaults[key]])),neutral);
  for(const [patch,expected] of fixtures)assert.equal(checksum(core.render(values(patch))),expected);
});

test('Studio Tall Grid changes actual image size and bounded table padding without resizing its canvas or text',()=>{
  const original=values(),baseline=core.render(original),fit=imageGeometry(baseline,'signal');
  assert.equal(fit.width,69);assert.equal(fit.height,165,'published fitting area is independently fixed for this reported case');
  const smaller=values({motifScale:75}),small=imageGeometry(core.render(smaller),'signal');
  assert.equal(small.height,123);assert.equal(small.width,51);
  for(const [x,y] of [[0,0],[100,0],[0,100],[100,100],[18,83]]) {
    const draft={...smaller,motifPositionX:x,motifPositionY:y},html=core.render(draft),art=imageGeometry(html,'signal');
    assert.equal(art.width+art.left+art.right,76,'position is confined to the existing art column');
    assert.equal(art.height+art.top+art.bottom,165,'position is confined to the existing vertical space');
    assert.equal(art.left,Math.round(25*x/100));assert.equal(art.top,Math.round(42*y/100));
    assert.ok([art.left,art.right,art.top,art.bottom].every(value=>value>=0));
    assert.deepEqual(core.motifBounds(draft),{width:51,height:123,x:art.left,y:art.top,availableWidth:76,availableHeight:165});
    assert.equal(core.plainText(draft),core.plainText(original));
    assert.deepEqual(image.dimensions(draft,4),image.dimensions(original,4));
    assert.match(html,/^<table[^>]*width="321" height="436"/);
    assert.doesNotMatch(html,/overflow:|position:|transform:|background-image|<svg|<script|data:image|blob:/);
    const preview=imageGeometry(core.render(draft,{preview:true,assetBase:'./sig'}),'signal');
    assert.deepEqual({...preview,source:art.source},art,'preview and exported email use identical placement');
  }
});

test('standard and new motifs resize in every composition while reserving photo geometry',()=>{
  const designs=['original','orbit','studio','contour','prism','editorial','signal'];
  for(const pattern of patterns)for(const design of designs)for(const layout of ['paired','stacked']) {
    const initial=values({pattern,design,layout,width:420,height:320,portraitUrl:'https://example.com/photo.png',portraitSize:64});
    const draft={...initial,motifScale:50,motifPositionX:100,motifPositionY:100};
    const before=core.render(initial),after=core.render(draft),art=imageGeometry(after,pattern),fit=imageGeometry(before,pattern);
    assert.ok(art.width<fit.width&&art.height<fit.height,pattern+':'+design+':'+layout+' actually gets smaller');
    assert.ok(art.top>=0&&art.left>=0&&art.right===0&&art.bottom===0,'bottom right reaches its reserved bounds');
    const photo=html=>html.match(/<img\b[^>]*src="https:\/\/example.com\/photo\.png"[^>]*>/)[0];
    assert.equal(photo(after),photo(before),'decorative resizing does not resize or move the photo within its own row');
    assert.equal(core.plainText(draft),core.plainText(initial));assert.ok(after.length<10000);
    assert.match(art.source,new RegExp('/'+fileFor(pattern).replace('.', '\\.')+'$'));
  }
});

test('custom mosaics use the same positioning controls, and empty or photo-filled art slots remain empty',()=>{
  const initial=values({pattern:'custom',customPattern:recipe}),before=core.render(initial);
  const draft={...initial,motifScale:50,motifPositionX:100,motifPositionY:100},after=core.render(draft);
  assert.notEqual(after,before);assert.deepEqual(core.motifBounds(draft),{width:38,height:76,x:38,y:89,availableWidth:76,availableHeight:165});
  assert.match(after,/padding:89px 0px 0px 38px/);
  assert.match(after,/<table[^>]*width="38" height="76"/);assert.match(after,/bgcolor="#2348c7"/);
  assert.equal(core.plainText(draft),core.plainText(initial));assert.doesNotMatch(after,/overflow:|position:|transform:|<img[^>]*pattern-custom/);
  for(const value of [values({pattern:'none'}),values({pattern:'signal',design:'contour',layout:'paired',width:280,height:180,portraitSize:96,portraitUrl:'https://example.com/photo.png'})]) {
    const bounds=core.motifBounds(value);assert.equal(bounds.width,0);assert.equal(bounds.height,0);
    assert.equal(core.render(value),core.render({...value,motifScale:25,motifPositionX:100,motifPositionY:100}));
  }
});

test('fractional custom grids reach the selected edge using their actual rendered size without a second fit',()=>{
  for(const [columns,rows,motifScale] of [[7,13,75],[8,5,73],[4,32,63],[16,24,25]]) {
    const customPattern=JSON.stringify({palette:['#2348c7'],rows:Array.from({length:rows},()=> '0'.repeat(columns))});
    const draft=values({pattern:'custom',customPattern,motifScale,motifPositionX:100,motifPositionY:100});
    const html=core.render(draft),match=html.match(/(<td\b[^>]*>)(<table\b[^>]*>)<colgroup>/);
    assert.ok(match,'the positioned custom grid is rendered as an email table');
    const cell=attributes(match[1]),table=attributes(match[2]),width=Number(table.width),height=Number(table.height);
    const [top,right,bottom,left]=cell.style.match(/padding:([^;]+)/)[1].split(/\s+/).map(parseFloat);
    const label=columns+'×'+rows+' at '+motifScale+'%';
    assert.equal(left+width+right,76,label+' occupies its declared horizontal slot');
    assert.equal(top+height+bottom,165,label+' occupies its declared vertical slot');
    assert.equal(right,0);assert.equal(bottom,0);
    const bounds=core.motifBounds(draft);
    assert.equal(bounds.width,width,label+' controller width matches emitted artwork');
    assert.equal(bounds.height,height,label+' controller height matches emitted artwork');
  }
});

test('38-field sessions preserve independent side and flowing settings, importing them only with Design',()=>{
  assert.equal(Object.keys(core.defaults).length,38);
  for(const key of keys){assert.ok(codec.designFields.includes(key));assert.ok(!codec.informationFields.includes(key));}
  const current={draft:values({nameLine1:'Current',motifScale:70,motifPositionX:12,motifPositionY:86,artworkScale:125,artworkPositionX:18,artworkPositionY:83}),themes:[],ui:{}};
  const incoming={draft:values({nameLine1:'Incoming',motifScale:35,motifPositionX:97,motifPositionY:4,artworkScale:80,artworkPositionX:70,artworkPositionY:20}),themes:[],ui:{}};
  const restored=codec.parse(codec.serialize(incoming));assert.deepEqual(restored.draft,incoming.draft);
  for(const design of [false,true]) {
    const selected=codec.selectParts(restored,current,{information:true,design});
    for(const key of keys.concat(['artworkScale','artworkPositionX','artworkPositionY']))assert.equal(selected.draft[key],(design?incoming:current).draft[key]);
  }
  const old=Object.fromEntries(Object.entries(incoming.draft).filter(([key])=>!keys.includes(key)));assert.equal(Object.keys(old).length,35);
  for(const input of [old,{format:'signature-editor-session',version:1,exportedAt:'2026-09-09T12:00:00.000Z',draft:old,themes:[],ui:{}}]) {
    const migrated=codec.parse(JSON.stringify(input));
    assert.deepEqual(Object.fromEntries(keys.map(key=>[key,migrated.draft[key]])),neutral);
    assert.equal(migrated.draft.artworkScale,80,'older flowing-art scale keeps its separate meaning');
  }
});

test('side-artwork numeric bounds and AI section limits reject invalid values before changing a draft',()=>{
  const initial=values(),envelope=(changes,section='artwork')=>JSON.stringify({format:'signature-ai',version:1,section,name:'Positioned detail',changes});
  for(const [key,min,max] of [['motifScale',25,100],['motifPositionX',0,100],['motifPositionY',0,100]]) {
    for(const value of [min-1,max+1,1.5,'50',true,null]) {
      const invalid={...initial,[key]:value};
      // Native form values may be strings; external JSON remains number-only.
      if(typeof value==='string')assert.equal(core.normalize(invalid)[key],50);
      else assert.ok(core.validate(invalid)[key],key+' rejects '+String(value));
      assert.throws(()=>codec.parse(JSON.stringify(invalid)));
      assert.throws(()=>ai.createProposal(envelope({[key]:value}),{section:'artwork',draft:initial}));
    }
    for(const value of [min,max]) assert.deepEqual(core.validate({...initial,[key]:value}),{});
    assert.throws(()=>ai.createProposal(envelope({[key]:min},'colors'),{section:'colors',draft:initial}),/Unsupported/);
  }
  const changes={motifScale:60,motifPositionX:15,motifPositionY:87},proposal=ai.createProposal(envelope(changes),{section:'artwork',draft:initial});
  assert.deepEqual(ai.applyProposal(proposal,initial),changes);
  assert.throws(()=>ai.applyProposal(proposal,{...initial,motifPositionX:0}),/changed since/);
  for(const key of keys)assert.ok(ai.buildPrompt('artwork',initial).includes(key));
  const flowing={...initial,pattern:'gesture',artworkPlacement:'flow'};
  assert.equal(core.render(flowing),core.render({...flowing,...changes}),'side-artwork settings do not reinterpret a flowing composition');
});

test('four new AI motifs are distinct public PNGs and remain selectable hosted artwork in AI proposals',()=>{
  const hashes=new Set();
  const allFiles=['sig/dots.png',...['orbit','studio','contour','prism','editorial','signal','galaxy','starlight','moonlight','frost','cutpaper','colorfield','chromatic','counterform','overprint','gesture',...newPatterns].map(id=>'sig/pattern-'+id+'.png')];
  for(const file of allFiles) {
    const decoded=decodePNG(readFileSync(new URL('../'+file,import.meta.url))),hash=checksum(decoded.rgba);
    assert.ok(!hashes.has(hash),file+' has distinct artwork pixels');hashes.add(hash);
  }
  for(const pattern of newPatterns) {
    const file='sig/pattern-'+pattern+'.png',bytes=readFileSync(new URL('../'+file,import.meta.url)),decoded=decodePNG(bytes);
    assert.ok(PUBLIC_FILES.includes(file));assert.equal(requestedPublicFile('/'+file+'?v=motif-test'),file);
    assert.equal(decoded.width,304);assert.equal(decoded.height,728);assert.ok(decoded.rgba.some((value,index)=>index%4===3&&value>0));
    const initial=values(),response=JSON.stringify({format:'signature-ai',version:1,section:'artwork',name:'AI detail',changes:{pattern,motifScale:65}});
    const proposal=ai.createProposal(response,{section:'artwork',draft:initial});
    assert.deepEqual(ai.applyProposal(proposal,initial),{pattern,motifScale:65});
    const html=core.render(proposal.candidate),art=imageGeometry(html,pattern);
    assert.match(art.source,/^https:\/\//);assert.doesNotMatch(html,/data:image|blob:|<svg|<script/);assert.ok(html.length<10000);
    assert.equal(codec.parse(codec.serialize({draft:proposal.candidate})).draft.pattern,pattern);
    assert.ok(ai.buildPrompt('artwork',initial).includes(pattern));
  }
});
