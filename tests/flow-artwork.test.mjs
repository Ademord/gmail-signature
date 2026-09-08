// Independent contracts for continuous decorative canvases. These verify HTML
// geometry and data safety, not a received Gmail message or browser appearance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import core from '../signature-core.js';
import codec from '../session-data.js';
import ai from '../ai-extension-core.js';
import {decodePNG} from '../scripts/prepare-icons.mjs';
import {PUBLIC_FILES,requestedPublicFile} from '../scripts/public-files.mjs';
import {createPublicServer} from '../scripts/serve.mjs';

const patterns=['cutpaper','colorfield','chromatic','counterform','overprint','gesture'];
const designs=['original','orbit','studio','contour','prism','editorial','signal'];
const fields=['artworkPlacement','artworkScale','artworkPositionX','artworkPositionY'];
const flowFiles=[
  'sig/pattern-cutpaper-wide.png','sig/pattern-cutpaper-tall.png',
  'sig/pattern-colorfield-wide.png','sig/pattern-colorfield-tall.png',
  'sig/pattern-chromatic-wide.png','sig/pattern-chromatic-tall.png',
  'sig/pattern-counterform-wide.png','sig/pattern-counterform-tall.png',
  'sig/pattern-overprint-wide.png','sig/pattern-overprint-tall.png',
  'sig/pattern-gesture-wide.png','sig/pattern-gesture-tall.png'
];
const read=name=>readFileSync(new URL('../'+name,import.meta.url));
const photo='data:image/png;base64,'+read('sig/icon-web.png').toString('base64');
const photoUrl='https://example.com/portrait.png';
const draft=patch=>({...core.defaults,imageBase:'https://example.com/assets',...patch});
const recipe={palette:['#223344'],rows:['00..','00..','....','....']};
const surfaces=html=>[...html.matchAll(/<table\b[^>]*\bstyle="[^"]*background-image:[^"]*"[^>]*>/g)].map(([tag])=>({
  width:Number(tag.match(/\bwidth="(\d+)"/)[1]),height:Number(tag.match(/\bheight="(\d+)"/)?.[1]||0),
  size:tag.match(/background-size:([^;]+)/)[1],position:tag.match(/background-position:([^;]+)/)[1].split(' ').map(parseFloat),tag
}));
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=.0011,label+': '+actual+' vs '+expected);
const envelope=changes=>JSON.stringify({format:'signature-ai',version:1,section:'artwork',name:'Flow study',changes});
// Read complete nested table cells, so a painted wrapper must contain an entire
// information group. Matching a color anywhere in the HTML would miss fragments.
const informationMats=html=>{
  const stack=[],mats=[];
  for(const match of html.matchAll(/<\/?td\b[^>]*>/g)) {
    if(match[0].startsWith('</')) {
      const cell=stack.pop();assert.ok(cell,'balanced table cells');
      const style=cell.tag.match(/\bstyle="([^"]*)"/)?.[1]||'';
      const padding=style.match(/(?:^|;)padding:([1-9]\d*(?:\.\d+)?)px(?:;|$)/),background=style.match(/(?:^|;)background-color:(#[0-9a-f]{6})(?:;|$)/);
      if(padding&&background)mats.push({padding:Number(padding[1]),background:background[1],html:html.slice(cell.start,match.index+match[0].length)});
    }else stack.push({tag:match[0],start:match.index});
  }
  assert.equal(stack.length,0,'all table cells close');
  return mats;
};

test('the six abstract artworks flow automatically while every older graphic keeps its motif behavior',()=>{
  assert.deepEqual(fields.map(key=>core.defaults[key]),['auto',100,50,50]);
  assert.deepEqual(core.flowingPatterns,patterns);
  for(const pattern of patterns) for(const layout of ['paired','stacked']) {
    const value=draft({pattern,layout});
    assert.equal(core.resolveArtworkPlacement(value),'flow');
    assert.equal(core.flowAsset(value),'pattern-'+pattern+(layout==='paired'?'-wide.png':'-tall.png'));
    const html=core.render(value);
    assert.ok(surfaces(html).length>=2,pattern+' paints separate readable panels on a common canvas');
    assert.doesNotMatch(html,new RegExp('<img[^>]*pattern-'+pattern+'\\.png'));
    assert.match(core.render({...value,artworkPlacement:'motif'}),new RegExp('<img[^>]*pattern-'+pattern+'\\.png'));
  }
  for(const pattern of ['auto','dots','orbit','studio','contour','prism','editorial','signal','galaxy','starlight','moonlight','frost','none','custom']) {
    const value=draft({pattern,customPattern:pattern==='custom'?JSON.stringify(recipe):''});
    assert.equal(core.resolveArtworkPlacement(value),'motif',pattern);
    assert.equal(core.flowAsset(value),'');
    assert.equal(core.render(value),core.render({...value,artworkPlacement:'motif'}),pattern+' preserves exact previous rendering');
    assert.doesNotMatch(core.render(value),/background-image/);
  }
});

test('flowing artwork covers all seven compositions and dimensions with every supported photo size',()=>{
  for(const pattern of patterns) for(const design of designs) for(const layout of ['paired','stacked']) {
    for(const [width,height] of [[280,180],[321,208],[420,320]]) for(const portraitSize of [0,40,64,96]) {
      const label=[pattern,design,layout,width,height,portraitSize].join(':');
      const value=draft({pattern,design,layout,width,height,portraitSize:portraitSize||64,portraitUrl:portraitSize?photoUrl:'',portraitData:portraitSize?photo:''});
      assert.deepEqual(core.validate(value),{},label);
      const html=core.render(value), preview=core.render(value,{preview:true,assetBase:'./sig'});
      const asset='pattern-'+pattern+(layout==='paired'?'-wide.png':'-tall.png');
      const painted=surfaces(html);
      assert.ok(painted.length>=2,label+' retains a painting behind both information regions');
      assert.equal(new Set(painted.map(item=>item.size)).size,1,label+' uses one shared image scale');
      assert.ok(painted.every(item=>item.tag.includes('/assets/'+asset)),label+' exports the hosted art');
      assert.ok(surfaces(preview).every(item=>item.tag.includes('./sig/'+asset)),label+' previews local art');
      assert.ok(html.length<10000,label+' respects whole-email budget: '+html.length);
      assert.doesNotMatch(html,new RegExp('<img[^>]*pattern-'+pattern+'\\.png'),label+' has no narrow art copy');
      assert.doesNotMatch(html,/<(?:script|svg|canvas|iframe|style)\b|\bon[a-z]+=|data:image|blob:|display:(?:flex|grid)|position:(?:absolute|fixed)/i);
      assert.ok(html.includes('href="https://example.com/"'),label+' contact links stay live');
      assert.equal(core.plainText(value),core.plainText(draft()),label+' artwork never changes information');
      if(portraitSize) {assert.ok(html.includes('src="'+photoUrl+'"'),label);assert.ok(preview.includes(photo),label);}
      const W=layout==='paired'?width*2+20:width,H=layout==='paired'?height:height*2+20;
      assert.match(html,new RegExp('^<table[^>]+width="'+W+'" height="'+H+'"'),label);
    }
  }
});

test('Original continues the same painting through both cards and their gap under scale and focal movement',()=>{
  for(const layout of ['paired','stacked']) for(const [width,height] of [[280,180],[420,320]]) {
    for(const artworkScale of [75,100,150]) for(const [artworkPositionX,artworkPositionY] of [[0,0],[50,50],[100,100],[19,83]]) {
      const value=draft({pattern:'counterform',layout,width,height,artworkScale,artworkPositionX,artworkPositionY});
      const painted=surfaces(core.render(value)); assert.equal(painted.length,3,'outer canvas plus two panel samples');
      const W=layout==='paired'?width*2+20:width,H=layout==='paired'?height:height*2+20;
      const sourceW=layout==='paired'?860:420,sourceH=layout==='paired'?320:660;
      const fit=Math.max(W/sourceW,H/sourceH)*artworkScale/100;
      const imageW=sourceW*fit,imageH=sourceH*fit,originX=(W-imageW)*artworkPositionX/100,originY=(H-imageH)*artworkPositionY/100;
      const [outer,front,back]=painted;
      for(const item of painted) {
        const size=item.size.split(' ').map(parseFloat); near(size[0],imageW,'continuous width'); near(size[1],imageH,'continuous height');
      }
      for(const item of [outer,front]) {near(item.position[0],originX,'first x');near(item.position[1],originY,'first y');}
      near(back.position[0],originX-(layout==='paired'?width+20:0),'second card x continues from first');
      near(back.position[1],originY-(layout==='stacked'?height+20:0),'second card y continues from first');
      assert.equal(outer.width,W);assert.equal(outer.height,H);
    }
  }
});

test('flow text and links remain readable when decorative backgrounds are omitted by an email client',()=>{
  for(const design of designs) {
    const value=draft({design,pattern:'gesture'}), html=core.render(value);
    // Simulate stripping just decorative image declarations. A receive test is
    // still required to establish what any particular email client strips.
    const fallback=html.replace(/background-(?:image|size|position|repeat):[^;]+;/g,'');
    assert.doesNotMatch(fallback,/background-image/);
    for(const text of ['Avery','Morgan','Software Engineer','example.com','Zurich']) assert.ok(fallback.includes(text),design+': '+text);
    assert.ok(fallback.includes('background-color:'+value.frontBackground));
    assert.ok(fallback.includes('background-color:'+value.backBackground));
    assert.doesNotMatch(html,/<(?:span|img)\b[^>]*style="[^"]*background(?:-color)?:/,design+' does not fragment the painting with line or icon masks');
    const mats=informationMats(fallback);
    assert.equal(mats.length,2,design+' uses one padded mat for identity and one for contacts');
    const identity=mats.find(mat=>mat.html.includes('Avery')),contacts=mats.find(mat=>mat.html.includes('href="https://example.com/"'));
    assert.ok(identity&&contacts&&identity!==contacts,design+' keeps the information regions separate');
    for(const text of ['Avery','Morgan','Software Engineer','AI &amp; AUTOMATION']) assert.ok(identity.html.includes(text),design+' identity group contains '+text);
    for(const text of ['example.com','Zurich','+41 00 000 00 00','linkedin.com','SOFTWARE · DATA · AI']) assert.ok(contacts.html.includes(text),design+' contact group contains '+text);
    assert.equal(identity.background,value.frontBackground);
    assert.equal(contacts.background,design==='editorial'?value.frontBackground:value.backBackground);
    assert.ok(mats.every(mat=>mat.padding>=4&&mat.padding<=12),design+' gives the complete text groups breathing room');
  }
});

test('flow bounds and unsupported combinations fail explicitly rather than silently changing user choices',()=>{
  for(const [key,min,max] of [['artworkScale',75,150],['artworkPositionX',0,100],['artworkPositionY',0,100]]) {
    for(const value of [min-1,max+1,1.5,NaN,Infinity,'',null,true,{},[]]) {
      const candidate=draft({pattern:'gesture',[key]:value});
      assert.ok(core.validate(candidate)[key],key+' rejects '+String(value));
      assert.throws(()=>core.render(candidate),key+' cannot render invalid '+String(value));
    }
    for(const value of [min,max]) assert.deepEqual(core.validate(draft({pattern:'gesture',[key]:value})),{});
  }
  for(const artworkPlacement of ['FLOW','side','toString','__proto__',true,{},null]) assert.ok(core.validate(draft({pattern:'gesture',artworkPlacement})).artworkPlacement);
  for(const pattern of ['auto','none','custom','galaxy','dots','signal']) {
    const value=draft({pattern,artworkPlacement:'flow',customPattern:pattern==='custom'?JSON.stringify(recipe):''});
    assert.match(core.validate(value).artworkPlacement,/six abstract/);
    assert.throws(()=>core.render(value));
  }
});

test('flow URLs cannot terminate their CSS or HTML attribute and unsafe schemes are rejected',()=>{
  assert.throws(()=>core.render(draft({pattern:'gesture',imageBase:"https://example.com/art');color:red"})),/Invalid signature/);
  const oddBase='https://example.com/art%27);color:red;/*(quoted)';
  const html=core.render(draft({pattern:'gesture',imageBase:oddBase}));
  for(const {tag} of surfaces(html)) {
    const source=tag.match(/background-image:url\(&quot;(.+?)&quot;\);background-repeat/);
    assert.ok(source,'CSS URL is enclosed in encoded double quotes');
    assert.ok(tag.includes('%27')&&tag.includes('%28')&&tag.includes('%29'),'CSS delimiters in a public URL are percent encoded');
    assert.doesNotMatch(tag,/art'\)|"\);color:red|background-image:url\([^&]/);
  }
  assert.doesNotMatch(html,/<script|onerror=/i);
  for(const assetBase of ['javascript:alert(1)','data:image/png;base64,AAAA','//evil.example/art','../private','https://example.com/art?q=x']) {
    assert.throws(()=>core.render(draft({pattern:'gesture'}),{assetBase}),assetBase);
  }
});

test('all twelve full-canvas assets are distinct native PNGs with art crossing the center and both ends',()=>{
  const hashes=new Set();
  for(const file of flowFiles) {
    assert.ok(PUBLIC_FILES.includes(file),file);assert.equal(requestedPublicFile('/'+file+'?v=independent-flow'),file);
    const {width,height,rgba}=decodePNG(read(file)),tall=file.endsWith('-tall.png');
    assert.equal(width,tall?840:1720,file); assert.equal(height,tall?1320:640,file);
    const hash=createHash('sha256').update(rgba).digest('hex');assert.ok(!hashes.has(hash),file+' differs from every other canvas');hashes.add(hash);
    const regions=[0,0,0,0];let visible=0,partial=0,center=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const alpha=rgba[(y*width+x)*4+3];if(!alpha)continue;
      const axis=tall?y/height:x/width;visible++;regions[Math.min(3,Math.floor(axis*4))]++;
      if(alpha<255)partial++; if(axis>=.46&&axis<=.54)center++;
    }
    assert.ok(visible/(width*height)>.08&&visible/(width*height)<.85,file+' balances visible art and negative space');
    assert.ok(partial>100,file+' has antialiased edges');
    assert.ok(regions.every(count=>count>width*height*.005),file+' reaches all four canvas quarters');
    assert.ok(center>width*height*.01,file+' crosses the former panel seam');
  }
  assert.equal(hashes.size,12);
});

test('the real public server delivers all twelve flow images as their exact reviewed PNG bytes',async t=>{
  const server=createPublicServer(fileURLToPath(new URL('../',import.meta.url)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  for(const file of flowFiles) {
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/'+file+'?v=flow-contract');
    assert.equal(response.status,200,file);assert.match(response.headers.get('content-type'),/^image\/png/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),read(file),file);
  }
});

test('35-field sessions keep flow settings in the design import group and migrate older drafts',()=>{
  assert.equal(Object.keys(core.defaults).length,35);
  for(const key of fields) {assert.ok(codec.designFields.includes(key),key);assert.ok(!codec.informationFields.includes(key),key);}
  const current={draft:draft({nameLine1:'Current',pattern:'gesture',artworkPlacement:'motif',artworkScale:75,artworkPositionX:2,artworkPositionY:4}),themes:[],ui:{}};
  const incoming={draft:draft({nameLine1:'Incoming',pattern:'overprint',artworkPlacement:'flow',artworkScale:150,artworkPositionX:97,artworkPositionY:81}),themes:[],ui:{}};
  const restored=codec.parse(codec.serialize(incoming));
  assert.deepEqual(restored.draft,incoming.draft);
  for(const design of [false,true]) {
    const result=codec.selectParts(restored,current,{information:true,design});
    for(const key of fields) assert.equal(result.draft[key],(design?incoming:current).draft[key],key+' selected import');
  }
  const old=Object.fromEntries(Object.entries(incoming.draft).filter(([key])=>!fields.includes(key)));
  const migrated=codec.parse(JSON.stringify(old));
  for(const key of fields) assert.equal(migrated.draft[key],core.defaults[key],key+' migration default');
  assert.equal(core.resolveArtworkPlacement(migrated.draft),'flow','old abstract drafts gain continuous artwork');
  for(const key of fields.filter(key=>key!=='artworkPlacement')) {
    for(const invalid of ['100',true,null]) assert.throws(()=>codec.parse(JSON.stringify({...incoming.draft,[key]:invalid})),key+' enforces JSON number types');
  }
});

test('AI artwork controls enforce section boundaries, bounds, stale previews and explicit custom motif transitions',()=>{
  const before=draft({pattern:'gesture',artworkPlacement:'flow',artworkScale:100,artworkPositionX:50,artworkPositionY:50,nameLine1:'PrivateName'});
  const changes={artworkPlacement:'flow',artworkScale:125,artworkPositionX:18,artworkPositionY:92};
  const proposal=ai.createProposal(envelope(changes),{section:'artwork',draft:before});
  assert.deepEqual(ai.applyProposal(proposal,before),changes);
  assert.deepEqual(proposal.candidate,{...before,...changes});
  assert.doesNotMatch(ai.buildPrompt('artwork',before),/PrivateName|https:\/\/example.com\/assets/);
  for(const key of fields) assert.ok(ai.buildPrompt('artwork',before).includes(key),key+' is documented');
  for(const key of fields) {
    assert.throws(()=>ai.applyProposal(proposal,{...before,[key]:key==='artworkPlacement'?'motif':changes[key]}),/changed since/);
    const json=JSON.stringify({format:'signature-ai',version:1,section:'colors',name:'Wrong section',changes:{[key]:changes[key]}});
    assert.throws(()=>ai.createProposal(json,{section:'colors',draft:before}),/Unsupported changes/);
  }
  for(const [key,values] of [['artworkScale',[74,151,'100',100.5]],['artworkPositionX',[-1,101,'50']],['artworkPositionY',[-1,101,null]]])
    for(const value of values) assert.throws(()=>ai.createProposal(envelope({[key]:value}),{section:'artwork',draft:before}),/whole number/);
  assert.throws(()=>ai.createProposal(envelope({pattern:'custom',customPattern:recipe}),{section:'artwork',draft:before}),/Flow|flow|abstract/);
  const custom=ai.createProposal(envelope({pattern:'custom',customPattern:recipe,artworkPlacement:'motif'}),{section:'artwork',draft:before});
  assert.equal(custom.candidate.artworkPlacement,'motif');assert.match(core.render(custom.candidate),/bgcolor="#223344"/);
  assert.doesNotMatch(core.render(custom.candidate),/background-image/);
});
