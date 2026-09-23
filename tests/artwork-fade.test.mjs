import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import core from '../signature-core.js';

const draft = changes => ({...core.defaults,artworkPlacement:'background',...changes});
const photoUrl = 'https://example.com/photo.jpg';
const photoData = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
const recipe = JSON.stringify({palette:['#223344'],rows:['00..','00..','....','....']});
const surfaces = html => [...html.matchAll(/<table\b[^>]*style="[^"]*background-image:[^"]*"[^>]*>/g)].map(([tag]) => ({
  tag,
  sizes:tag.match(/background-size:([^;]+);/)[1].split(',').map(value=>value.trim().split(' ').map(parseFloat)),
  positions:tag.match(/background-position:([^;]+);/)[1].split(',').map(value=>value.trim().split(' ').map(parseFloat))
}));
const near = (actual,expected,label) => assert.ok(Math.abs(actual-expected)<.0011,label+': '+actual+' / '+expected);
const hash = html => createHash('sha256').update(html).digest('hex');

test('no fade preserves published uniform background HTML byte for byte',()=>{
  assert.deepEqual(['artworkFade','artworkFadeAngle','artworkFadeDirection','artworkFadeX','artworkFadeY'].map(key=>core.defaults[key]),['none',90,'normal',50,50]);
  const fixtures=[
    [{pattern:'dots',artworkOpacity:35},'0400a00705ff7d922bc2ce23a2b372ac43e6db5dbbb5d9850fdb467a0d5344e9'],
    [{pattern:'counterform',design:'studio',layout:'stacked',artworkScale:250,cardFormat:'single',portraitUrl:photoUrl},'1c11f6b074e97e522114549a7a2227a6f86f98af4e1e6bbccf1c8c7efeecd3e1'],
    [{pattern:'custom',customPattern:recipe},'25dbe08c62ef67dd4169a5f5c6384b9860e11aca1faa482a752d847acdbb22b2']
  ];
  for(const [changes,expected] of fixtures) {
    const value=draft(changes);for(const key of ['artworkFade','artworkFadeAngle','artworkFadeDirection','artworkFadeX','artworkFadeY'])delete value[key];
    assert.equal(hash(core.render(value)),expected,'old drafts inherit no fade');
    assert.equal(hash(core.render({...value,artworkFade:'none',artworkFadeAngle:360,artworkFadeDirection:'reverse',artworkFadeX:0,artworkFadeY:100})),expected,'inactive parameters have no visible effect');
  }
});

test('linear fades use the selected CSS angle and maximum opacity, with reversible endpoints',()=>{
  for(const artworkFadeAngle of [0,45,90,180,270,360])for(const artworkFadeDirection of ['normal','reverse'])for(const artworkOpacity of [1,35,100]) {
    const value=draft({artworkFade:'linear',artworkFadeAngle,artworkFadeDirection,artworkOpacity,frontBackground:'#123456',backBackground:'#abcdef'});
    const [front,back]=surfaces(core.render(value));
    for(const [surface,rgb] of [[front,'18,52,86'],[back,'171,205,239']]) {
      const maximum='rgba('+rgb+','+(100-artworkOpacity)/100+')',zero='rgba('+rgb+',1)';
      const stops=artworkFadeDirection==='normal'?[maximum,zero]:[zero,maximum];
      assert.ok(surface.tag.includes('linear-gradient('+artworkFadeAngle+'deg,'+stops[0]+' 0%,'+stops[1]+' 100%)'));
    }
    assert.equal(core.render({...value,artworkFadeX:0,artworkFadeY:100}),core.render(value),'radial controls do not alter linear fades');
  }
});

test('radial fades use a circle from the selected full-canvas center to its farthest corner',()=>{
  for(const [artworkFadeX,artworkFadeY] of [[0,0],[100,100],[50,50],[19,83]])for(const artworkFadeDirection of ['normal','reverse']) {
    const value=draft({artworkFade:'radial',artworkFadeDirection,artworkFadeX,artworkFadeY,artworkOpacity:35});
    const [front]=surfaces(core.render(value)),maximum='rgba(243,240,234,0.65)',zero='rgba(243,240,234,1)';
    const stops=artworkFadeDirection==='normal'?[maximum,zero]:[zero,maximum];
    assert.ok(front.tag.includes('radial-gradient(circle farthest-corner at '+artworkFadeX+'% '+artworkFadeY+'%,'+stops[0]+' 0%,'+stops[1]+' 100%)'));
    assert.equal(core.render({...value,artworkFadeAngle:271}),core.render(value),'linear angle does not alter radial fades');
  }
});

test('every template and format samples one continuous fade independently from artwork movement',()=>{
  for(const design of core.designs.map(item=>item.id))for(const cardFormat of ['auto','single','front-back'])for(const layout of ['paired','stacked'])for(const artworkFade of ['linear','radial']) {
    const value=draft({design,cardFormat,layout,artworkFade,pattern:'counterform',artworkOpacity:35,artworkScale:250,artworkPositionX:19,artworkPositionY:83,cardGap:60,portraitUrl:photoUrl});
    assert.deepEqual(core.validate(value),{},[design,cardFormat,layout,artworkFade].join(':'));
    const html=core.render(value),size=core.dimensions(value),bounds=core.artworkBounds(value),painted=surfaces(html);
    const moved=surfaces(core.render({...value,artworkScale:25,artworkPositionX:100,artworkPositionY:0}));
    assert.ok(painted.length>0);
    for(const [index,paint] of painted.entries()) {
      assert.deepEqual(paint.sizes[0],[size.width,size.height],'the opacity field covers the full signature canvas');
      near(paint.positions[0][0],paint.positions[1][0]-bounds.x,'mask samples the face x offset');
      near(paint.positions[0][1],paint.positions[1][1]-bounds.y,'mask samples the face y offset');
      assert.deepEqual(moved[index].positions[0],paint.positions[0],'artwork movement never moves the fade');
      assert.deepEqual(moved[index].sizes[0],paint.sizes[0],'artwork resizing never resizes the fade');
    }
    if(cardFormat==='front-back'||(cardFormat==='auto'&&design==='original')) {
      assert.equal(painted.length,2,'only the actual two faces paint');
      assert.deepEqual(painted[0].positions[0],[0,0]);
      assert.deepEqual(painted[1].positions[0],layout==='stacked'?[0,-(value.height+60)]:[-(value.width+60),0]);
      assert.doesNotMatch(html.slice(0,html.indexOf('>')+1),/background-image|background-color/,'the gap remains unpainted');
    }
    assert.deepEqual(core.dimensions(value),core.dimensions({...value,artworkFade:'none'}));
    assert.deepEqual(core.artworkBounds(value),core.artworkBounds({...value,artworkFade:'none'}));
    assert.equal(core.plainText(value),core.plainText({...value,artworkFade:'none'}));
    assert.equal(html.split('src="'+photoUrl+'"').length-1,1,'one unchanged photo');
    assert.ok(html.includes('href="https://example.com/"'),'contacts stay clickable');
    assert.doesNotMatch(html,/(?:^|[;" ])opacity:|mask-image:|filter:|position:(?:absolute|fixed)/,'the fade does not affect content opacity');
    assert.ok(html.length<10000,'complete HTML budget');
  }
});

test('fades support custom drawings and custom template compositions without changing local photos',()=>{
  for(const composition of ['orbit','studio','contour','prism','editorial','signal'])for(const artworkFade of ['linear','radial'])for(const layout of ['paired','stacked']) {
    const value=draft({design:'custom',customLayout:JSON.stringify({composition,font:'serif',align:'center'}),cardFormat:'single',layout,pattern:'custom',customPattern:recipe,artworkFade,portraitData:photoData,portraitUrl:photoUrl,artworkOpacity:75});
    const html=core.render(value),preview=core.render(value,{preview:true,assetBase:'./sig'});
    assert.match(html,/linear-gradient\(#223344,#223344\)/,'custom native drawing stays below the wash');
    assert.match(html,artworkFade==='radial'?/radial-gradient\(circle farthest-corner/:/linear-gradient\(90deg/);
    assert.equal(preview.split('src="'+photoData+'"').length-1,1,'the cropped local photo remains intact');
    assert.deepEqual(core.dimensions(value),core.dimensions({...value,artworkFade:'none'}));
    assert.ok(html.length<10000);
  }
});

test('inactive placements, absent artwork and zero maximum opacity ignore all fade settings',()=>{
  for(const changes of [{artworkPlacement:'auto',pattern:'dots'},{artworkPlacement:'motif',pattern:'galaxy'},{artworkPlacement:'flow',pattern:'counterform'},{pattern:'none'},{artworkOpacity:0}]) {
    const value=draft(changes),baseline=core.render(value);
    for(const artworkFade of ['linear','radial'])assert.equal(core.render({...value,artworkFade,artworkFadeAngle:123,artworkFadeDirection:'reverse',artworkFadeX:0,artworkFadeY:100}),baseline);
  }
});

test('fade enums and numeric bounds reject invalid values and preserve saved numeric strings',()=>{
  for(const [key,min,max] of [['artworkFadeAngle',0,360],['artworkFadeX',0,100],['artworkFadeY',0,100]]) {
    for(const invalid of [min-1,max+1,1.5,NaN,Infinity,'',null,true,{},[]]) {
      assert.ok(core.validate(draft({[key]:invalid}))[key],key+': '+String(invalid));
      assert.throws(()=>core.render(draft({[key]:invalid})));
    }
    for(const valid of [min,max,String(min),String(max)]) {
      assert.deepEqual(core.validate(draft({[key]:valid})),{});
      assert.equal(core.normalize({[key]:valid})[key],Number(valid));
    }
  }
  for(const [key,allowed] of [['artworkFade',['none','linear','radial']],['artworkFadeDirection',['normal','reverse']]]) {
    for(const invalid of ['LINEAR','toString','__proto__','',null,true,{},[]])assert.ok(core.validate(draft({[key]:invalid}))[key],key+': '+String(invalid));
    for(const valid of allowed)assert.deepEqual(core.validate(draft({[key]:valid})),{});
  }
});
