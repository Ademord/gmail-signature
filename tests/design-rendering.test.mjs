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
  assert.deepEqual(Object.keys(core.patterns),['auto','cutpaper','colorfield','chromatic','counterform','overprint','gesture','dots','orbit','studio','contour','prism','editorial','signal','galaxy','starlight','moonlight','frost','custom','none']);
  assert.ok(Object.isFrozen(core.designs) && core.designs.every(Object.isFrozen) && Object.isFrozen(core.patterns));
  for(const d of core.designs){
    assert.equal(typeof d.name,'string');assert.equal(typeof d.description,'string');assert.equal(d.pattern,'auto');
    for(const k of ['accent','frontBackground','backBackground'])assert.match(d[k],/^#[a-f0-9]{6}$/);
  }
  const old={...core.defaults};for(const key of ['design','pattern','customPattern','customLayout','portraitData','portraitUrl','portraitShape','portraitSize','artworkPlacement','artworkScale','artworkPositionX','artworkPositionY'])delete old[key];
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

test('all seven compositions support minimum, default and maximum dimensions in both exports',()=>{
  for(const d of core.designs)for(const [width,height] of [[280,180],[321,208],[420,320]])for(const layout of ['paired','stacked']){
    const v=values({...d,design:d.id,width,height,layout}),html=core.render(v);
    assert.deepEqual(core.validate(v),{},d.id);
    assert.ok(html.length<10000,`${d.id}: ${html.length}`);
    const expectedWidth=layout==='paired'?width*2+20:width,expectedHeight=layout==='paired'?height:height*2+20;
    assert.match(html,new RegExp('^<table[^>]+width="'+expectedWidth+'" height="'+expectedHeight+'"'));
    assert.deepEqual(image.dimensions(v,4),{width:expectedWidth*4,height:expectedHeight*4,logicalWidth:expectedWidth,logicalHeight:expectedHeight});
    assert.match(html,/<td\b[^>]*style="[^"]*font-family:'IBM Plex Mono'[^\"]*font-weight:400[^\"]*">Software Engineer<\/td>/);
    assert.doesNotMatch(html,/<svg\b|<script\b|<style\b|background-image|display:(?:flex|grid)|position:|data:image/);
    assert.equal(core.plainText(v),core.plainText(core.defaults));
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
