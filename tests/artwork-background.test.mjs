import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import core from '../signature-core.js';

const draft = changes => ({...core.defaults,imageBase:'https://example.com/assets',artworkPlacement:'background',...changes});
const photoUrl = 'https://example.com/portrait.jpg';
const photoData = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
const painted = html => [...html.matchAll(/<table\b[^>]*style="[^"]*background-image:[^"]*"[^>]*>/g)].map(([tag]) => tag);
const near = (actual,expected,label) => assert.ok(Math.abs(actual-expected)<.0011,label+': '+actual+' / '+expected);
const rectangle = tag => ({
  size:tag.match(/background-size:100% 100%,([^;]+);/)[1].split(' ').map(parseFloat),
  position:tag.match(/background-position:0px 0px,([^;]+);/)[1].split(' ').map(parseFloat)
});

test('background artwork fits the complete card canvas then scales beyond its clipped edges',()=>{
  for(const layout of ['paired','stacked'])for(const cardFormat of ['auto','single','front-back'])for(const pattern of ['dots','counterform'])for(const artworkScale of [25,100,400])for(const [artworkPositionX,artworkPositionY] of [[0,0],[50,50],[100,100],[19,83]]) {
    const value=draft({layout,cardFormat,pattern,artworkScale,artworkPositionX,artworkPositionY}),size=core.dimensions(value),bounds=core.artworkBounds(value);
    const sourceW=pattern==='dots'?76:layout==='paired'?860:420,sourceH=pattern==='dots'?182:layout==='paired'?320:660;
    const fit=Math.min(size.width/sourceW,size.height/sourceH)*artworkScale/100;
    near(bounds.width,sourceW*fit,'paint width');near(bounds.height,sourceH*fit,'paint height');
    near(bounds.x,(size.width-bounds.width)*artworkPositionX/100,'horizontal crop offset');near(bounds.y,(size.height-bounds.height)*artworkPositionY/100,'vertical crop offset');
    assert.equal(bounds.availableWidth,size.width);assert.equal(bounds.availableHeight,size.height);
    if(artworkScale===100)assert.ok(bounds.width<=size.width+.001&&bounds.height<=size.height+.001,'100% contains the entire source');
    if(artworkScale===400)assert.ok(bounds.width>size.width||bounds.height>size.height,'oversized artwork extends beyond at least one edge');
    for(const tag of painted(core.render(value))) {
      const paint=rectangle(tag);near(paint.size[0],bounds.width,'rendered paint width');near(paint.size[1],bounds.height,'rendered paint height');
    }
  }
});

test('every bundled artwork becomes a background independent of content, photo and template layout',()=>{
  for(const design of core.designs.map(item=>item.id))for(const cardFormat of ['auto','single','front-back'])for(const layout of ['paired','stacked'])for(const pattern of Object.keys(core.patterns).filter(pattern=>!['none','custom'].includes(pattern))) {
    const value=draft({design,cardFormat,layout,pattern,portraitUrl:photoUrl,portraitData:photoData,artworkScale:400});
    assert.deepEqual(core.validate(value),{},[design,cardFormat,layout,pattern].join(':'));
    const html=core.render(value),preview=core.render(value,{preview:true,assetBase:'./sig'});
    assert.ok(painted(html).length,'real decorative surfaces exist');
    assert.equal(html.split('src="'+photoUrl+'"').length-1,1,'email retains exactly one photo');
    assert.equal(preview.split('src="'+photoData+'"').length-1,1,'preview retains exactly one local photo');
    assert.doesNotMatch(html,/<img[^>]+(?:pattern-[a-z]+|dots)\.png/,'no miniature side copy');
    assert.doesNotMatch(html,/padding:7px;background-color:/,'no opaque information mats');
    assert.ok(html.includes('href="https://example.com/"'),'contacts remain actual links');
    assert.doesNotMatch(html,/<(?:svg|canvas|iframe|style)\b|data:image|blob:|position:(?:absolute|fixed)/i);
    assert.ok(html.length<10000,'full email budget');
    assert.deepEqual(core.dimensions(value),core.dimensions({...value,pattern:'none'}),'artwork reserves no separate space');
    assert.equal(core.render({...value,artworkScale:25}).match(/alt="Avery Morgan"/g).length,1,'shrinking artwork retains the photo');
  }
});

test('the two faces sample one painting without painting their card gap',()=>{
  for(const layout of ['paired','stacked'])for(const cardGap of [0,20,60])for(const design of core.designs.map(item=>item.id)) {
    const value=draft({design,cardFormat:'front-back',layout,cardGap,pattern:'galaxy',artworkScale:250,artworkPositionX:19,artworkPositionY:83});
    const html=core.render(value),tags=painted(html),bounds=core.artworkBounds(value);
    assert.equal(tags.length,2,'only the two faces paint backgrounds');
    assert.doesNotMatch(html.slice(0,html.indexOf('>')+1),/background-image|background-color/,'the outer gap remains transparent');
    const [front,back]=tags.map(rectangle);
    near(front.position[0],bounds.x,'first face x');near(front.position[1],bounds.y,'first face y');
    near(back.position[0],bounds.x-(layout==='paired'?value.width+cardGap:0),'back face x');
    near(back.position[1],bounds.y-(layout==='stacked'?value.height+cardGap:0),'back face y');
  }
});

test('background opacity changes only the decorative paint using each face color',()=>{
  const base=draft({frontBackground:'#123456',backBackground:'#abcdef'});
  assert.equal(core.defaults.artworkOpacity,100);
  assert.match(core.render({...base,artworkOpacity:35}),/linear-gradient\(rgba\(18,52,86,0\.65\),rgba\(18,52,86,0\.65\)\)/);
  assert.match(core.render({...base,artworkOpacity:35}),/linear-gradient\(rgba\(171,205,239,0\.65\),rgba\(171,205,239,0\.65\)\)/);
  assert.match(core.render({...base,artworkOpacity:100}),/linear-gradient\(rgba\(18,52,86,0\),rgba\(18,52,86,0\)\)/);
  assert.doesNotMatch(core.render({...base,artworkOpacity:0}),/background-image/);
  for(const opacity of [0,35,100]) {
    assert.deepEqual(core.dimensions({...base,artworkOpacity:opacity}),core.dimensions(base));
    assert.equal(core.plainText({...base,artworkOpacity:opacity}),core.plainText(base));
  }
  for(const artworkPlacement of ['auto','motif','flow']) {
    const value={...base,artworkPlacement,pattern:'counterform'};
    assert.equal(core.render({...value,artworkOpacity:0}),core.render({...value,artworkOpacity:100}),'old placements ignore background opacity');
  }
});

test('custom drawings use clipped native gradient rectangles and retain the complete email budget',()=>{
  const customPattern=JSON.stringify({palette:['#223344'],rows:['00..','00..','....','....']});
  for(const layout of ['paired','stacked'])for(const cardFormat of ['single','front-back'])for(const artworkScale of [25,100,400]) {
    const value=draft({layout,cardFormat,pattern:'custom',customPattern,artworkScale,artworkPositionX:0,artworkPositionY:0});
    const html=core.render(value);assert.match(html,/linear-gradient\(#223344,#223344\)/);
    assert.doesNotMatch(html,/pattern-custom|data:|<colgroup>/);assert.ok(html.length<10000);
    assert.deepEqual(core.dimensions(value),core.dimensions({...value,pattern:'none'}));
  }
  const dense=JSON.stringify({palette:['#123456','#abcdef'],rows:Array.from({length:24},(_,y)=>Array.from({length:16},(_,x)=>String((x+y)%2)).join(''))});
  const value=draft({pattern:'custom',customPattern:dense});
  assert.match(core.validate(value).customPattern,/10,000/);assert.throws(()=>core.render(value));
});

test('background defaults resolve custom templates and incomplete recipes keep slider bounds usable',()=>{
  const customLayout=JSON.stringify({composition:'editorial',font:'serif',align:'center'});
  const value=draft({design:'custom',customLayout,cardFormat:'single',pattern:'auto'});
  assert.match(core.render(value),/pattern-editorial\.png/);
  assert.deepEqual(core.artworkBounds(value),core.artworkBounds({...value,design:'editorial',customLayout:''}));
  for(const changes of [{design:'custom',customLayout:''},{pattern:'custom',customPattern:''},{pattern:'none'},{artworkPlacement:'motif'}]) {
    const bounds=core.artworkBounds(draft(changes));
    assert.ok(Object.values(bounds).every(Number.isFinite));assert.ok(bounds.availableWidth>0&&bounds.availableHeight>0);
  }
});

test('new scale, position and opacity limits reject malformed input while legacy cover geometry is preserved',()=>{
  for(const [key,min,max] of [['artworkScale',25,400],['artworkOpacity',0,100],['artworkPositionX',0,100],['artworkPositionY',0,100]]) {
    for(const invalid of [min-1,max+1,1.5,NaN,Infinity,'',null,true,{},[]])assert.ok(core.validate(draft({[key]:invalid}))[key],key+': '+String(invalid));
    for(const valid of [min,max])assert.deepEqual(core.validate(draft({[key]:valid})),{});
  }
  for(const artworkScale of [25,100,400]) {
    const value=draft({pattern:'counterform',artworkPlacement:'flow',artworkScale,artworkPositionX:19,artworkPositionY:83}),bounds=core.artworkBounds(value),size=core.dimensions(value);
    const fit=Math.max(size.width/860,size.height/320)*artworkScale/100;
    near(bounds.width,860*fit,'legacy Flow cover width');near(bounds.height,320*fit,'legacy Flow cover height');
    assert.deepEqual(core.validate(value),{});
  }
  const legacy={...core.defaults};
  assert.equal(createHash('sha256').update(core.render(legacy)).digest('hex'),'ff0a66d3dd3ab2eae0c6746710ab906c45a65acf505c5b140e40e6104262abc1');
});
