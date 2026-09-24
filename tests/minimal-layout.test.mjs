import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import core from '../signature-core.js';
import image from '../signature-image.js';
import session from '../session-data.js';
import ai from '../ai-extension-core.js';

const localPhoto='data:image/png;base64,'+readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
// Requirement oracle: only replace Original's brand squares with equal-height
// empty space; all remaining markup (including art, footer rule and photo) is exact.
function withoutMarks(html, count) {
  let found=0;
  const result=html.replace(/<tr><td style="padding:0"><table\b[^>]*width="(15|17)" height="\1"[^>]*><tr><td style="padding:0;background-color:#[a-f0-9]{6};font-size:0;line-height:0">&nbsp;<\/td><\/tr><\/table><\/td><\/tr>/g,(_,size)=>{
    found++;
    return '<tr><td height="'+size+'" style="padding:0;height:'+size+'px;font-size:0;line-height:0">&nbsp;</td></tr>';
  });
  assert.equal(found,count,'oracle locates every Original accent square');
  return result;
}

test('Minimal is Original minus its marks in every format, orientation and export surface',()=>{
  const variants=[{}, {width:280,height:180}, {portraitUrl:'https://example.com/photo.jpg',portraitSize:96},
    {portraitData:localPhoto}, {pattern:'none'}, {pattern:'gesture'},
    {pattern:'galaxy',artworkPlacement:'background',artworkScale:175,artworkFade:'radial',artworkOpacity:65},
    {pattern:'custom',customPattern:JSON.stringify({palette:['#336699'],rows:['....','.00.','.00.','....']})}];
  for(const cardFormat of ['auto','single','front-back'])for(const layout of ['paired','stacked'])for(const variant of variants){
    const original={...core.defaults,cardFormat,layout,...variant},minimal={...original,design:'minimal'},count=cardFormat==='single'?1:2;
    assert.deepEqual(core.validate(minimal),{});
    assert.deepEqual(core.dimensions(minimal),core.dimensions(original));
    assert.deepEqual(image.dimensions(minimal,4),image.dimensions(original,4));
    assert.equal(core.plainText(minimal),core.plainText(original));
    assert.equal(core.effectiveFormat(minimal),core.effectiveFormat(original));
    for(const method of ['artworkBounds','motifBounds','flowAsset'])assert.deepEqual(core[method](minimal),core[method](original));
    for(const options of [{},{preview:true},{preview:true,assetBase:'./sig'}]){
      if(minimal.portraitData && !options.preview)continue;
      assert.equal(core.render(minimal,options),withoutMarks(core.render(original,options),count),JSON.stringify({cardFormat,layout,variant,options}));
    }
    if(!minimal.portraitData){
      assert.equal(core.renderEmail(minimal,{scale:100}),withoutMarks(core.renderEmail(original,{scale:100}),count));
      const scaled=core.renderEmail(minimal,{scale:75});
      assert.match(scaled,new RegExp('^<table[^>]*width="'+Math.round(core.dimensions(minimal).width*.75)+'"'));
      assert.deepEqual(core.emailDimensions(minimal,75),core.emailDimensions(original,75));
    }
  }
});

test('Minimal keeps Original gap geometry, fit validation and compact preset measurements',()=>{
  for(const layout of ['paired','stacked'])for(const cardGap of [0,37,60])for(const cardFormat of ['auto','single','front-back']){
    const original={...core.defaults,layout,cardGap,cardFormat},minimal={...original,design:'minimal'};
    assert.deepEqual(core.dimensions(minimal),core.dimensions(original));
    for(const fields of [{height:180,email:'hello@example.com',tags:'ONE TWO THREE'},{nameLine1:'W'.repeat(80)}]){
      assert.deepEqual(core.validate({...minimal,...fields}),core.validate({...original,...fields}));
    }
  }
  const original={...core.defaults,...core.compactPreset,portraitUrl:'https://example.com/photo.jpg'},minimal={...original,design:'minimal'};
  assert.deepEqual(core.dimensions(minimal),core.dimensions(original));
  assert.equal(core.render(minimal),withoutMarks(core.render(original),1));
  assert.equal(core.normalize({...core.defaults,hideAccent:true}).hideAccent,undefined,'internal flag is not a draft override');
});

test('Minimal round-trips through sessions and scoped AI proposals without changing other settings',()=>{
  const original={...core.defaults,portraitData:localPhoto,portraitUrl:'https://example.com/photo.jpg',sidePadding:8},minimal={...original,design:'minimal'};
  const restored=session.parse(session.serialize({draft:minimal,ui:{emailScale:75}}));
  assert.deepEqual(restored.draft,minimal);assert.equal(restored.ui.emailScale,75);
  for(const section of ['layout','design']){
    const response=JSON.stringify({format:'signature-ai',version:1,section,name:'Minimal',changes:{design:'minimal'}});
    const proposal=ai.createProposal(response,{section,draft:original});
    assert.deepEqual(proposal.candidate,minimal);
    assert.deepEqual(ai.applyProposal(proposal,original),{design:'minimal'});
  }
});
