import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import artwork from '../artwork-core.js';
import core from '../signature-core.js';
import session from '../session-data.js';
import image from '../signature-image.js';

// Deliberately independent: removing a study or design cannot shrink coverage.
const studyIds=['cutforms','interlock','colorblocks','counterspace','offsetplanes','rhythm'];
const designs=['original','orbit','studio','contour','prism','editorial','signal'];
const palette=['#123456','#abcdef','#315b8c','#ba6345','#ada52a','#37593b','#795296','#d5bd9a'];
const base={palette:palette.slice(0,2),rows:['0...','..1.','...0','.11.']};
const blank={palette:palette.slice(0,2),rows:['....','....','....','....']};
const photo='data:image/png;base64,'+readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
const values=changes=>({...core.defaults,...changes});
const json=value=>JSON.stringify(value);

test('manual artwork exposes the six reviewed studies through frozen CommonJS and browser APIs',()=>{
  assert.deepEqual(artwork.studies.map(study=>study.id),studyIds);
  assert.ok(Object.isFrozen(artwork)&&Object.isFrozen(artwork.studies)&&artwork.studies.every(Object.isFrozen));
  const context={window:{SignatureCore:core}};
  vm.runInNewContext(readFileSync(new URL('../artwork-core.js',import.meta.url),'utf8'),context);
  assert.deepEqual(Array.from(context.window.SignatureArtwork.studies,study=>study.id),studyIds);
  assert.deepEqual(JSON.parse(json(context.window.SignatureArtwork.createStudy('cutforms',0))),artwork.createStudy('cutforms',0));
});

test('six studies and their seeded variations are distinct, deterministic and bounded recipes',()=>{
  const originals=[];
  for(const id of studyIds){
    const initial=artwork.createStudy(id),one=artwork.createStudy(id,1),seven=artwork.createStudy(id,7);
    originals.push(json(initial));
    assert.deepEqual(initial,artwork.createStudy(id,0));assert.deepEqual(one,artwork.createStudy(id,1));
    assert.notDeepEqual(initial,one,id+' has a usable first variation');
    assert.deepEqual(artwork.createStudy(id,'studio seed'),artwork.createStudy(id,'studio seed'));
    for(const recipe of [initial,one,seven]){
      assert.deepEqual(recipe,core.parseCustomPattern(json(recipe)));
      assert.ok(recipe.rows.length*recipe.rows[0].length<=384);
      assert.ok(recipe.rows.some(row=>/[0-7]/.test(row)),id+' is visible');
      assert.ok(recipe.rows.some(row=>row.includes('.')),id+' retains open space');
    }
    initial.palette[0]='#000000';initial.rows[0]='.'.repeat(initial.rows[0].length);
    assert.notDeepEqual(initial,artwork.createStudy(id),id+' never aliases its template');
  }
  assert.equal(new Set(originals).size,6);
  for(const id of ['missing','__proto__','toString','../private','<svg>',null,0])assert.throws(()=>artwork.createStudy(id),TypeError);
  for(const seed of [null,true,NaN,Infinity,-1,.5,Number.MAX_SAFE_INTEGER+1,[],{}])assert.throws(()=>artwork.createStudy('cutforms',seed),TypeError);
});

test('painting, erasing, mirroring, recoloring and strokes change exactly the requested cells without mutation',()=>{
  const before=json(base);
  assert.deepEqual(artwork.paint(base,3,0,'1').rows,['0..1','..1.','...0','.11.']);
  assert.deepEqual(artwork.paint(base,0,0,'.').rows,['....','..1.','...0','.11.']);
  assert.deepEqual(artwork.paint(blank,0,0,0).rows,['0...','....','....','....']);
  assert.deepEqual(artwork.paintLine(blank,{x:0,y:0},{x:3,y:3},0).rows,['0...','.0..','..0.','...0']);
  assert.deepEqual(artwork.paintLine(blank,{x:3,y:3},{x:0,y:0},0).rows,['0...','.0..','..0.','...0']);
  assert.deepEqual(artwork.paintLine(blank,{x:3,y:1},{x:0,y:1},1).rows,['....','1111','....','....']);
  assert.deepEqual(artwork.paintLine(blank,{x:2,y:0},{x:2,y:3},1).rows,['..1.','..1.','..1.','..1.']);
  assert.deepEqual(artwork.paintLine(base,{x:2,y:1},{x:2,y:1},'.'),artwork.paint(base,2,1,'.'));
  assert.deepEqual(artwork.mirror(base,'horizontal').rows,['...0','.1..','0...','.11.']);
  assert.deepEqual(artwork.mirror(base,'vertical').rows,['.11.','...0','..1.','0...']);
  for(const axis of ['horizontal','vertical'])assert.deepEqual(artwork.mirror(artwork.mirror(base,axis),axis),base);
  assert.deepEqual(artwork.setColor(base,1,'#AABBCC'),{palette:['#123456','#aabbcc'],rows:base.rows});
  assert.equal(json(base),before);assert.deepEqual(blank.rows,['....','....','....','....']);
  const cloned=artwork.clone(base);assert.notEqual(cloned,base);assert.notEqual(cloned.rows,base.rows);assert.notEqual(cloned.palette,base.palette);
  cloned.rows[0]='1111';cloned.palette[0]='#000000';assert.equal(json(base),before);
});

test('coordinates, inks, palette edits and recipe type boundaries reject unsafe or out-of-range values',()=>{
  const before=json(base);
  for(const bad of [-1,4,.5,'1',null,false,NaN,Infinity,{},[]]){
    assert.throws(()=>artwork.paint(base,bad,0,0),TypeError);
    assert.throws(()=>artwork.paint(base,0,bad,0),TypeError);
    assert.throws(()=>artwork.paintLine(base,{x:0,y:0},{x:bad,y:0},0),TypeError);
    assert.throws(()=>artwork.paintLine(base,{x:0,y:bad},{x:0,y:0},0),TypeError);
  }
  for(const ink of [-1,2,7,8,.5,'00','01','2','8','red','<',null,false,{},[]])assert.throws(()=>artwork.paint(base,0,0,ink),TypeError);
  for(const index of [-1,2,.5,'1',null,true,NaN,Infinity])assert.throws(()=>artwork.setColor(base,index,'#123456'),TypeError);
  for(const color of ['red','#fff','#12345678',' #123456','url(https://example.com/a)','<svg>','javascript:alert(1)',null,123456])assert.throws(()=>artwork.setColor(base,0,color),TypeError);
  for(const axis of ['diagonal','',null,0,{},[]])assert.throws(()=>artwork.mirror(base,axis),TypeError);
  const invalid=[null,[],42,true,'null','[]',{}, {...base,html:'<script>'}, {...base,palette:[]}, {...base,palette:Array(9).fill('#123456')},
    {...base,palette:['#fff']}, {...base,rows:['0000','000','0000','0000']}, {...base,rows:Array(32).fill('0'.repeat(16))},
    {...base,rows:['0000','0000','0000','7777']}, {...base,rows:['0000','0000','0000','<b>0']},
    '{"palette":["#123456"],"rows":["0000","0000","0000","0000"],"__proto__":{}}'];
  for(const recipe of invalid)assert.throws(()=>artwork.clone(recipe),TypeError);
  assert.equal(json(base),before);assert.equal({}.polluted,undefined);
});

test('old AI recipes reopen all one-to-eight inks and grids up to 384 cells without resampling',()=>{
  for(let inks=1;inks<=8;inks++)for(const [width,height] of [[4,4],[16,24],[12,32]]){
    const recipe={palette:palette.slice(0,inks),rows:Array.from({length:height},(_,y)=>String(y%inks).repeat(width))};
    const original=values({pattern:'custom',customPattern:json(recipe)}),before=json(original);
    const reopened=artwork.fromDraft(original);
    assert.equal(reopened.isCustom,true);assert.deepEqual(reopened.recipe,recipe);
    assert.deepEqual(artwork.clone(json(recipe)),recipe);
    const changed=artwork.paint(reopened.recipe,width-1,height-1,String(inks-1));
    assert.equal(changed.rows[height-1][width-1],String(inks-1));
    assert.equal(json(original),before);
    reopened.recipe.palette[0]='#000000';assert.equal(json(original),before);
  }
  const recipe={palette:palette.slice(),rows:Array.from({length:32},(_,y)=>String(Math.floor(y/4)).repeat(12))};
  const original=values({pattern:'custom',customPattern:json(recipe)});
  const proposal=artwork.createProposal(artwork.fromDraft(original).recipe,original);
  assert.equal(proposal.changes.customPattern,original.customPattern,'Applying an unchanged existing recipe preserves its serialization');
  const restored=session.parse(session.serialize({draft:proposal.candidate})).draft;
  assert.deepEqual(core.parseCustomPattern(restored.customPattern),recipe);
});

test('built-in artwork opens its related study without overwriting an inactive saved custom recipe',()=>{
  const expected={cutpaper:'cutforms',colorfield:'colorblocks',chromatic:'interlock',counterform:'counterspace',overprint:'offsetplanes',gesture:'rhythm'};
  for(const [pattern,studyId] of Object.entries(expected)){
    const original=values({pattern,customPattern:json(base)}),before=json(original),opened=artwork.fromDraft(original);
    assert.equal(opened.isCustom,false);assert.equal(opened.studyId,studyId);assert.deepEqual(opened.recipe,artwork.createStudy(studyId));
    assert.equal(json(original),before);
  }
});

test('all six studies make bounded email and PNG previews across seven designs, wide and tall, preserving the draft',()=>{
  for(const id of studyIds)for(const design of designs)for(const layout of ['paired','stacked'])for(const [width,height] of [[280,180],[321,208],[420,320]]){
    const original=values({design,layout,width,height,nameLine1:'Zoë',nameLine2:'Atlas',title:'Designer',
      website:'https://example.com/work',websiteLabel:'Portfolio',portraitData:photo,portraitUrl:'https://example.com/crop.png',portraitSize:40});
    const before=json(original),recipe=artwork.createStudy(id,1),proposal=artwork.createProposal(recipe,original);
    assert.equal(json(original),before,id+':'+design+':'+layout);
    assert.deepEqual(proposal.candidate,{...original,pattern:'custom',customPattern:json(recipe)});
    assert.deepEqual(artwork.applyProposal(proposal,original),{pattern:'custom',customPattern:json(recipe)});
    assert.ok(proposal.html.includes(photo));assert.ok(proposal.characters<10000);
    assert.equal(proposal.characters,proposal.html.length-photo.length);
    const email=core.render(proposal.candidate);
    assert.ok(email.length<10000);assert.match(email,/href="https:\/\/example.com\/work"/);assert.match(email,/src="https:\/\/example.com\/crop.png"/);
    assert.doesNotMatch(email,/<(?:script|svg|style|canvas|iframe)\b|data:image|blob:|pattern-custom|background-image|display:(?:grid|flex)|\bon[a-z]+=/i);
    assert.equal(core.plainText(proposal.candidate),core.plainText(original));
    assert.deepEqual(image.dimensions(proposal.candidate,4),image.dimensions(original,4));
    assert.deepEqual(session.parse(session.serialize({draft:proposal.candidate})).draft,proposal.candidate);
  }
});

test('local photos need no upload for artwork preview, and editable changes remain only the two artwork fields',()=>{
  const original=values({nameLine1:'Private',email:'private@example.com',portraitData:photo,portraitUrl:'',design:'custom',
    customLayout:'{"composition":"signal","font":"serif","align":"center"}',layout:'stacked',width:420,height:320});
  const proposal=artwork.createProposal(base,original);
  assert.deepEqual(Object.keys(proposal.changes).sort(),['customPattern','pattern']);
  assert.deepEqual(proposal.candidate,{...original,pattern:'custom',customPattern:json(base)});
  assert.ok(proposal.html.includes(photo));assert.throws(()=>core.render(proposal.candidate),/public HTTPS URL/);
  assert.ok(core.render(proposal.candidate,{allowPortraitData:true}).includes(photo));
});

test('only a genuine unchanged preview applies; recipe edits and returned patches cannot mutate a proposal',()=>{
  const original=values(),recipe=artwork.clone(base),proposal=artwork.createProposal(recipe,original),before=json(proposal);
  assert.ok(Object.isFrozen(proposal)&&Object.isFrozen(proposal.changes)&&Object.isFrozen(proposal.candidate));
  recipe.rows[0]='1111';recipe.palette[0]='#000000';assert.equal(json(proposal),before);
  const patch=artwork.applyProposal(proposal,original);patch.customPattern='{}';assert.equal(json(proposal),before);
  for(const forged of [{...proposal},JSON.parse(json(proposal)),{},null])assert.throws(()=>artwork.applyProposal(forged,original),TypeError);
  for(const changes of [{nameLine1:'Changed'},{email:'changed@example.com'},{portraitData:photo},{width:322},{design:'orbit'},{pattern:'none'},{accent:'#223344'},{imageBase:'https://example.com/other-assets'}]){
    assert.throws(()=>artwork.applyProposal(proposal,{...original,...changes}),/changed|reopen/i);
  }
  assert.deepEqual(artwork.applyProposal(proposal,Object.fromEntries(Object.entries(original).reverse())),proposal.changes);
});

test('schema-valid dense artwork is rejected by the complete HTML budget without changing the draft',()=>{
  const dense={palette:palette.slice(0,2),rows:Array.from({length:24},(_,y)=>(y%2?'10':'01').repeat(8))};
  assert.deepEqual(core.parseCustomPattern(json(dense)),dense,'The failure must come from rendered size, not the recipe schema');
  for(const design of designs)for(const layout of ['paired','stacked']){
    const original=values({design,layout}),before=json(original);
    assert.throws(()=>artwork.createProposal(dense,original),/10,000|too long|simplif|shorten/i,design+':'+layout);
    assert.equal(json(original),before);
  }
});
