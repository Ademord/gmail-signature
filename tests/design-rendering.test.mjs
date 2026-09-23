import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import core from '../signature-core.js';
import image from '../signature-image.js';

const values = overrides => ({...core.defaults,...overrides});
const photo = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
const customPattern = JSON.stringify({palette:['#336699'],rows:['....','.00.','.00.','....']});
const ids = ['original','orbit','studio','contour','prism','editorial','signal'];

test('design and pattern catalogs are immutable and old 23-field sessions inherit the original',()=>{
  assert.deepEqual(core.designs.map(d=>d.id),ids);
  assert.deepEqual(Object.keys(core.patterns),['auto','cutpaper','colorfield','chromatic','counterform','overprint','gesture','neural','latent','tokenweave','resonance','dots','orbit','studio','contour','prism','editorial','signal','galaxy','starlight','moonlight','frost','custom','none']);
  assert.ok(Object.isFrozen(core.designs) && core.designs.every(Object.isFrozen) && Object.isFrozen(core.patterns));
  for(const d of core.designs){
    assert.equal(typeof d.name,'string');assert.equal(typeof d.description,'string');assert.equal(d.pattern,'auto');
    for(const k of ['accent','frontBackground','backBackground'])assert.match(d[k],/^#[a-f0-9]{6}$/);
  }
  const old={...core.defaults};for(const key of ['cardFormat','cardGap','design','pattern','customPattern','customLayout','portraitData','portraitUrl','portraitShape','portraitSize','artworkPlacement','artworkScale','artworkPositionX','artworkPositionY','motifScale','motifPositionX','motifPositionY'])delete old[key];
  assert.equal(Object.keys(old).length,23);
  assert.equal(core.normalize(old).design,'original');assert.equal(core.normalize(old).pattern,'auto');
  assert.equal(core.normalize(old).portraitData,'');assert.equal(core.normalize(old).portraitSize,64);
});

test('legacy email markup stays byte-identical for representative pre-design sessions',()=>{
  const fixtures=[
    [{},'ff0a66d3dd3ab2eae0c6746710ab906c45a65acf505c5b140e40e6104262abc1'],
    [{width:280,height:180},'efb61bdd114b0eab04bdee8d8a96f4a8d0b8f8c24b00ea8c8d0fd537141ef01b'],
    [{layout:'stacked',width:420,height:320},'aca19a52706d23faa1cd323fafe38f3ddf45f3e7866122742820804d6f57802a'],
    [{nameLine1:'Jean',nameLine2:'Mörgán',phone:'',tags:'',frontBackground:'#ccddee'},'e3a4d3e4cca11644224a4403d9db5254cd4bfc6b7d0df76cafbe79515776be7f']
  ];
  for(const [fields,hash] of fixtures){
    const v=values(fields);delete v.design;delete v.pattern;
    assert.equal(createHash('sha256').update(core.render(v)).digest('hex'),hash);
  }
});

test('omitted and automatic card formats preserve all fourteen published template renderings byte for byte',()=>{
  const hashes={
    original:['ff0a66d3dd3ab2eae0c6746710ab906c45a65acf505c5b140e40e6104262abc1','94cff76e51a814f9e0d95c8493ecd6a7d13e8df870153c299d4166f609950831'],
    orbit:['f95d1fc2ff1437798d4e5523e2ce61d8a3a9ef903f926ae0ef20218afed245ab','4517f980dca7d66c93da8c4f4e9e851214d6597dac5cc7968ba9710f33293ed6'],
    studio:['c93cebc627336a6700482ec358c1441ff562ab97454510e03c78af9564c5898c','cd09ce091013e99490d9dbfb9b7e393b23a3c5a6d427cc3bc92c4cc0f994447b'],
    contour:['9e8cda8dffd20bd1cd1ad0a89c2141324dec1bcc16ce345aa9b52a9bc2a16934','893d32bd7182d20e678283e32819c028b743d75be9b03b80beaf1fc53a93e1a8'],
    prism:['a283fa4a62234539def15423dc4f7136da7811e6f38b57fab376111c8bb9f030','6e1045692b33fbd38fccce73b63626d5e9a2c6bb532abf7159d985dc6415cc67'],
    editorial:['26614854a82e64a6be638f75817853b0acc4f6925838e1fa08e1f1be6262d0bc','967892cabac6a22ad77714b3ad514b2f0f4105413612e023b249a605124df717'],
    signal:['4a9e0da73fb94faaf38c34b8981f7b4157888f45b2efa3440d33bcdcf3af2b6f','949918fa346353fe8949a27b0eddcdda9ea9b518be16617ae1f0d4d2e778b5db']
  };
  for(const design of ids)for(const [index,layout] of ['paired','stacked'].entries()){
    const legacy=values({design,layout});delete legacy.cardFormat;
    for(const v of [legacy,{...legacy,cardFormat:'auto'}])assert.equal(createHash('sha256').update(core.render(v)).digest('hex'),hashes[design][index],design+': '+layout);
  }
});

test('explicit formats retain every template, contact and photo while using their own real canvas',()=>{
  for(const composition of ids)for(const design of [composition,...(composition==='original'?[]:['custom'])])for(const layout of ['paired','stacked'])for(const cardFormat of ['single','front-back'])for(const portraitSize of [0,64,96]){
    const v=values({design,layout,cardFormat,cardGap:37,backBackground:'#123456',portraitUrl:portraitSize?'https://example.com/portrait.jpg':'',portraitSize:portraitSize||64,customLayout:design==='custom'?JSON.stringify({composition,font:'serif',align:'center'}):''});
    const label=[design,composition,layout,cardFormat,portraitSize].join(':');
    assert.deepEqual(core.validate(v),{},label);
    const html=core.render(v),size=core.dimensions(v);
    assert.match(html,new RegExp('^<table[^>]+width="'+size.width+'" height="'+size.height+'"'),label);
    assert.deepEqual(image.dimensions(v,4),{width:size.width*4,height:size.height*4,logicalWidth:size.width,logicalHeight:size.height});
    for(const href of ['https://example.com/','tel:+41000000000','https://www.linkedin.com/'])assert.equal(html.split('href="'+href+'"').length-1,1,label+' preserves one live contact');
    assert.equal(html.split('alt="Avery Morgan"').length-1,portraitSize?1:0,label+' preserves exactly one portrait');
    assert.ok(html.length<10000,label+' whole-email budget');
    if(cardFormat==='single'){
      assert.equal(size.width,layout==='paired'?642:321);assert.ok(size.height>=208);
      assert.equal(core.render({...v,cardGap:0,backBackground:'#abcdef'}),html,label+' ignores stored back-face controls');
      assert.doesNotMatch(html,/#123456/,label+' paints one card background');
    }else{
      assert.deepEqual(size,{width:layout==='paired'?679:321,height:layout==='paired'?208:453});
      assert.equal([...html.matchAll(/<table\b[^>]*width="321" height="208"/g)].length,2,label+' renders two actual faces');
    }
    if(design==='custom'){assert.match(html,/font-family:Georgia,Times,serif/);assert.match(html,/text-align:center/);}
  }
});

test('Single Original composes long business details naturally with one brand marker',()=>{
  const reference=values({cardFormat:'single',layout:'stacked',nameLine1:'Jean Alexander',nameLine2:'Morgan Winterbourne',title:'Forward Deployed Engineer · Acme',subtitle:'AI Engineering & Platforms',website:'business.example.com',websiteLabel:'',email:'info@business.example.com',phone:'+41 00 000 00 00',linkedin:'https://linkedin.com/in/example',location:'Example City, Switzerland',tags:'PLATFORMS · DATA · ML · AUTOMATION',portraitUrl:'https://example.com/portrait.jpg',portraitSize:64});
  assert.deepEqual(core.validate(reference),{});
  assert.equal(core.dimensions(reference).width,reference.width);
  for(const layout of ['paired','stacked']){
    const v={...reference,layout},html=core.render(v),text=core.plainText(v);
    assert.equal([...html.matchAll(/<table\b[^>]*width="17" height="17"/g)].length,1,'one Original brand square');
    assert.equal([...html.matchAll(/<table\b[^>]*width="321" height="208"/g)].length,0,'no fixed-height legacy face remains');
    for(const value of ['Jean Alexander Morgan Winterbourne','Forward Deployed Engineer · Acme','info@business.example.com','Example City, Switzerland','PLATFORMS · DATA · ML · AUTOMATION'])assert.ok(text.includes(value),value);
    for(const href of ['mailto:info@business.example.com','tel:+41000000000','https://business.example.com/','https://linkedin.com/in/example'])assert.ok(html.includes('href="'+href+'"'),href);
    assert.ok(core.dimensions(v).height<reference.height*2,'compact composition retains all details');
  }
  const withoutMotif={...reference,pattern:'none'};
  assert.equal(core.dimensions(withoutMotif).width,reference.width);
  assert.ok(core.dimensions(withoutMotif).height<reference.height*2,'compact composition also works without artwork');
  assert.equal(core.dimensions({...withoutMotif,height:320}).height,Math.max(320,core.dimensions(withoutMotif).height),'Height remains a minimum, not a crop');
  assert.ok(core.validate({...reference,nameLine2:'W'.repeat(36)}).nameLine2,'Single still rejects unreadably compressed names');
});

test('Single Original keeps its accent footer divider only when tags are present',()=>{
  function footerRules(html){return [...html.matchAll(/<table\b[^>]* height="1"[^>]*><tr><td style="padding:0;background-color:#c8362a;font-size:0;line-height:0">/g)];}
  for(const layout of ['paired','stacked'])for(const pattern of ['none','counterform'])for(const hasContacts of [true,false]){
    const v=values({cardFormat:'single',layout,pattern,...(hasContacts?{}:{website:'',email:'',phone:'',linkedin:'',location:''})});
    const html=core.render(v);
    assert.equal(footerRules(html).length,1,'tags retain the thin Original footer rule');
    assert.equal([...html.matchAll(/<table\b[^>]*width="17" height="17"/g)].length,1,'footer rule does not add a second brand square');
    assert.equal(footerRules(core.render({...v,tags:''})).length,0,'no empty footer divider');
  }
  for(const design of ids.filter(id=>id!=='original'))assert.equal(footerRules(core.render(values({design,cardFormat:'single'}))).length,0,'other templates keep their existing tag treatment');
});

test('single cards with empty optional content retain a bounded name card without empty contact groups',()=>{
  for(const design of ids)for(const layout of ['paired','stacked'])for(const pattern of ['none','counterform']){
    const v=values({design,layout,pattern,cardFormat:'single',width:280,height:180,title:'',subtitle:'',website:'',email:'',phone:'',linkedin:'',location:'',tags:''});
    assert.deepEqual(core.validate(v),{});
    const html=core.render(v),size=core.dimensions(v);
    assert.equal(size.width,layout==='paired'?560:280);assert.equal(size.height,180);
    assert.match(html,/Avery/);assert.match(html,/Morgan/);
    assert.doesNotMatch(html,/href=|icon-|undefined|NaN|height="0"|width="0"/);
    assert.equal(core.render({...v,backBackground:'#654321',cardGap:60}),html);
  }
});

test('all seven compositions support minimum, default and maximum dimensions in both exports',()=>{
  for(const d of core.designs)for(const [width,height] of [[280,180],[321,208],[420,320]])for(const layout of ['paired','stacked'])for(const cardGap of [0,20,60]){
    const v=values({...d,design:d.id,width,height,layout,cardGap}),html=core.render(v);
    assert.deepEqual(core.validate(v),{},d.id);
    assert.ok(html.length<10000,`${d.id}: ${html.length}`);
    const gap=d.id==='original'?cardGap:20,expectedWidth=layout==='paired'?width*2+gap:width,expectedHeight=layout==='paired'?height:height*2+gap;
    assert.match(html,new RegExp('^<table[^>]+width="'+expectedWidth+'" height="'+expectedHeight+'"'));
    assert.deepEqual(image.dimensions(v,4),{width:expectedWidth*4,height:expectedHeight*4,logicalWidth:expectedWidth,logicalHeight:expectedHeight});
    assert.match(html,/<td\b[^>]*style="[^"]*font-family:'IBM Plex Mono'[^\"]*font-weight:400[^\"]*">Software Engineer<\/td>/);
    assert.doesNotMatch(html,/<svg\b|<script\b|<style\b|background-image|display:(?:flex|grid)|position:|data:image/);
    assert.equal(core.plainText(v),core.plainText(core.defaults));
  }
});

test('joined named and custom compositions keep their canvas and markup when a stored card gap changes',()=>{
  for(const composition of ids.filter(id=>id!=='original'))for(const layout of ['paired','stacked'])for(const design of [composition,'custom']){
    const v=values({design,layout,customLayout:design==='custom'?JSON.stringify({composition,font:'sans',align:'left'}):''});
    const baseline=core.render(v),size=core.dimensions(v),png=image.dimensions(v,4);
    for(const cardGap of [0,60]){
      assert.equal(core.render({...v,cardGap}),baseline,design+': '+composition);
      assert.deepEqual(core.dimensions({...v,cardGap}),size);
      assert.deepEqual(image.dimensions({...v,cardGap},4),png);
    }
  }
});

test('patterns switch independently, none removes artwork, and all assets retain declared aspect ratios',()=>{
  for(const design of ids)for(const pattern of Object.keys(core.patterns)){
    const html=core.render(values({design,pattern,artworkPlacement:'motif',customPattern:pattern==='custom'?customPattern:''}));
    const effective=pattern==='auto'?(design==='original'?'dots':design):pattern;
    const images=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).filter(tag=>/alt=""/.test(tag));
    if(effective==='none'){assert.equal(images.length,0);continue;}
    if(effective==='custom'){assert.equal(images.length,0);assert.match(html,/<colgroup>/);continue;}
    assert.equal(images.length,1);
    assert.match(images[0],new RegExp('/'+(effective==='dots'?'dots':'pattern-'+effective)+'\\.png"'));
    const [,w,h]=images[0].match(/width="(\d+)" height="(\d+)"/);
    assert.ok(Math.abs(Number(w)/Number(h)-76/182)<.006,images[0]);
  }
  const structure=ids.map(design=>core.render(values({design,pattern:'none'})).replace(/#[a-f0-9]{6}/g,'#COLOR'));
  assert.equal(new Set(structure).size,7,'Compositions differ even with the same palette and no pattern');
});

test('all designs preserve optional contacts, selected icons, links and user colors',()=>{
  for(const design of ids){
    const v=values({design,websiteIcon:'mail',phoneIcon:'none',email:'hello@example.com',height:260,frontBackground:'#ffffff',backBackground:'#eef2ff',accent:'#114488'});
    const html=core.render(v);
    assert.match(html,/background-color:#ffffff/);assert.match(html,/background-color:#eef2ff/);assert.match(html,/background-color:#114488/);
    assert.match(html,/icon-mail-dark\.png/);assert.doesNotMatch(html,/icon-phone/);
    assert.match(html,/href="mailto:hello@example.com"/);assert.match(html,/href="tel:\+41000000000"/);
    const empty=core.render({...v,website:'',email:'',phone:'',linkedin:'',location:'',tags:''});
    assert.doesNotMatch(empty,/icon-|href=/);
  }
});

test('unknown design and pattern ids cannot become image paths or markup',()=>{
  for(const key of ['design','pattern'])for(const value of ['../private','https://example.com/x','toString','__proto__','<img src=x>','unknown']){
    const v=values({[key]:value});assert.equal(typeof core.validate(v)[key],'string');assert.throws(()=>core.render(v));
  }
  for(const design of ids)for(const assetBase of ['//localhost','../sig','./%2e%2e/sig','javascript:alert(1)'])assert.throws(()=>core.render(values({design}),{assetBase}));
});

test('name and field fit failures stop every design from silently overflowing',()=>{
  for(const design of ids){
    const compact={design,layout:'stacked',width:280,height:180};
    for(const field of ['nameLine1','nameLine2'])assert.equal(typeof core.validate(values({...compact,[field]:'W'.repeat(22)}))[field],'string');
    assert.equal(typeof core.validate(values({...compact,nameLine1:'😀'.repeat(12)})).nameLine1,'string','Wide fallback emoji cannot escape name fit validation');
    assert.equal(typeof core.validate(values({...compact,title:'W'.repeat(64)})).title,'string');
    assert.equal(typeof core.validate(values({...compact,email:'a'.repeat(64)+'@example.com'})).email,'string');
    const dense=values({design,width:280,height:180,websiteLabel:'Portfolio · Research · Design · Products',email:'long.email.address.for.contact@example.com',location:'Somewhere in a very long region of Switzerland',tags:'ENGINEERING · RESEARCH · STRATEGY · AUTOMATION'});
    if(Object.keys(core.validate(dense)).length)assert.throws(()=>core.render(dense));
    else assert.match(core.render(dense),/href="mailto:long.email.address.for.contact@example.com"/,'Wider compositions may fit more content');
    const spacious={...dense,width:420,height:320};assert.deepEqual(core.validate(spacious),{});
  }
});

test('new designs use unified geometry and adaptive contact columns instead of equal card pairs',()=>{
  for(const design of ids.filter(id=>id!=='original')){
    const wide=core.render(values({design})),tall=core.render(values({design,layout:'stacked'}));
    for(const html of [wide,tall]){
      const oldCards=[...html.matchAll(/<table\b[^>]*width="321" height="208"/g)];
      assert.equal(oldCards.length,0,design+' must not hide the original equal-card anatomy under new artwork');
    }
    assert.notEqual(wide.replace(/width="\d+"|height="\d+"|\d+px/g,''),tall.replace(/width="\d+"|height="\d+"|\d+px/g,''),design+' rearranges in tall format');
  }
  for(const design of ['contour','prism','editorial','signal'])assert.match(core.render(values({design})),/Avery Morgan<\/td>/,'Wide mastheads use the joined name');
  const terminal=core.render(values({design:'signal'}));for(const label of ['WEBSITE','PHONE','LINKEDIN','LOCATION'])assert.match(terminal,new RegExp('>'+label+'<'));
  assert.match(core.render(values({design:'editorial'})),/font-family:Georgia,Times,serif/);
});

test('Signal declares its frame columns before content so fixed-layout email tables stay aligned',()=>{
  for(const layout of ['paired','stacked'])for(const width of [280,321,420]){
    const html=core.render(values({design:'signal',layout,width}));
    const firstRow=html.match(/^<table\b[^>]*><tr>(.*?)<\/tr>/)[1];
    const widths=[...firstRow.matchAll(/<td\b[^>]*width="(\d+)"/g)].map(match=>Number(match[1]));
    assert.deepEqual(widths,[4,(layout==='paired'?width*2+20:width)-8,4]);
    assert.match(firstRow,/height="4"/);
  }
});

test('cropped local portraits are explicit preview/PNG assets while email requires a public URL',()=>{
  for(const design of ids)for(const portraitSize of [40,64,96]){
    const v=values({design,portraitData:photo,portraitSize});
    assert.deepEqual(core.validate(v),{});
    assert.throws(()=>core.render(v),error=>typeof error.errors?.portraitUrl==='string');
    for(const option of [{preview:true},{allowPortraitData:true}]){
      const html=core.render(v,option);
      assert.match(html,new RegExp('width="'+portraitSize+'" height="'+portraitSize+'" alt="Avery Morgan"'));
      assert.ok(html.includes(photo));assert.match(html,/border-radius:50%/);
    }
    const publicPhoto={...v,portraitUrl:'https://example.com/cropped.jpg'};
    assert.ok(!core.render(publicPhoto).includes('data:image/'));
    assert.match(core.render(publicPhoto),/src="https:\/\/example.com\/cropped.jpg"/);
    assert.ok(core.render(publicPhoto,{preview:true}).includes(photo));
    assert.equal(core.plainText(v),core.plainText(core.defaults));
  }
  assert.match(core.render(values({portraitUrl:'https://example.com/cropped.png',portraitShape:'rounded'})),/border-radius:12px/);
  assert.match(core.render(values({portraitUrl:'https://example.com/cropped.png',portraitShape:'square'})),/border-radius:0/);
});

test('portrait validation rejects unsafe sources, unsupported data types and unbounded dimensions',()=>{
  for(const portraitUrl of ['http://example.com/p.jpg','https://localhost/p.jpg','javascript:alert(1)','data:image/png;base64,abcd'])assert.equal(typeof core.validate(values({portraitUrl})).portraitUrl,'string');
  const corrupt=Buffer.from(photo.split(',')[1],'base64');corrupt[33]^=1;
  for(const portraitData of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,YWJjZA==','data:image/jpeg;base64,/9j/','data:image/jpeg;base64,/9j/2Q==','data:image/png;base64,iVBORw0KGgo=',photo.replace('image/png','image/jpeg'),photo+'!', 'data:image/png;base64,'+corrupt.toString('base64'),'data:image/png;base64,'+'A'.repeat(327684)])assert.equal(typeof core.validate(values({portraitData})).portraitData,'string');
  for(const portraitSize of ['',39,97,64.5,null])assert.equal(typeof core.validate(values({portraitSize})).portraitSize,'string');
  assert.equal(typeof core.validate(values({portraitShape:'<script>'})).portraitShape,'string');
});
