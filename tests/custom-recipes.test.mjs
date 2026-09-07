import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../signature-core.js';
import image from '../signature-image.js';

const recipe={palette:['#22aa77','#eeaa33'],rows:['....','.00.','.11.','....']};
const customPattern=JSON.stringify(recipe);
const values=overrides=>({...core.defaults,...overrides});

test('recipe schemas are public immutable contracts and the custom tile is separate from built-ins',()=>{
  assert.equal(core.customDesign.id,'custom');assert.ok(Object.isFrozen(core.customDesign));
  assert.equal(core.designs.length,7);assert.ok(!core.designs.some(d=>d.id==='custom'));
  for(const key of ['customPattern','customLayout']){
    const schema=core.recipeSchemas[key];assert.equal(schema.type,'object');assert.equal(schema.additionalProperties,false);
    assert.ok(Object.isFrozen(schema)&&Object.isFrozen(schema.properties)&&Object.isFrozen(schema.required));
    assert.equal(core.defaults[key],'');
  }
  assert.equal(core.patterns.custom,'Custom artwork');
});

test('artwork recipes enforce palette, equal grid dimensions and the 384-cell bound',()=>{
  const parsed=core.parseCustomPattern(JSON.stringify({...recipe,palette:['#22AA77','#EEAA33']}));
  assert.deepEqual(parsed,recipe);assert.ok(Object.isFrozen(parsed.palette)&&Object.isFrozen(parsed.rows));
  assert.equal(core.parseCustomPattern(JSON.stringify({palette:['#123456'],rows:Array(32).fill('0'.repeat(12))})).rows.length,32);
  for(const invalid of [
    '',null,{},'[]','null','{"palette":["#ffffff"],"rows":["0000","0000","0000","0000"],"__proto__":{}}',
    JSON.stringify({...recipe,url:'https://example.com/art.png'}),
    JSON.stringify({...recipe,palette:[]}),JSON.stringify({...recipe,palette:Array(9).fill('#123456')}),
    JSON.stringify({...recipe,palette:['red;position:fixed']}),JSON.stringify({...recipe,palette:['#fff']}),
    JSON.stringify({...recipe,rows:['....','...','.00.','....']}),
    JSON.stringify({...recipe,rows:['....','.<b>','.00.','....']}),
    JSON.stringify({...recipe,rows:['....','.02.','.00.','....']}),
    JSON.stringify({...recipe,rows:Array(32).fill('0'.repeat(16))}),
    JSON.stringify({...recipe,rows:Array(33).fill('....')}),
    JSON.stringify({...recipe,rows:['....','....','....']})
  ])assert.throws(()=>core.parseCustomPattern(invalid),TypeError,String(invalid));
});

test('layout recipes allow only supported composition, display font and identity alignment',()=>{
  const valid={composition:'orbit',font:'serif',align:'center'};
  assert.deepEqual(core.parseCustomLayout(JSON.stringify(valid)),valid);
  assert.ok(Object.isFrozen(core.parseCustomLayout(JSON.stringify(valid))));
  for(const invalid of [{...valid,script:'alert(1)'},{...valid,composition:'original'},{...valid,composition:'../../private'},
    {...valid,font:'url(https://example.com/font)'},{...valid,align:'right'},{composition:'orbit',font:'sans'},['orbit','sans','left']])
    assert.throws(()=>core.parseCustomLayout(JSON.stringify(invalid)),TypeError);
});

test('custom recipes are validated before preview, email or PNG export',()=>{
  for(const bad of [{design:'custom'},{pattern:'custom'},{customPattern:'{}'},{customLayout:'{"font":"serif"}'}]){
    const v=values(bad);assert.ok(Object.keys(core.validate(v)).length);
    assert.throws(()=>core.render(v,{preview:true}));assert.throws(()=>image.dimensions(v,4));
  }
  const v=values({design:'custom',customLayout:JSON.stringify({composition:'studio',font:'serif',align:'center'})});
  assert.deepEqual(core.validate(v),{});
  const html=core.render(v);
  assert.match(html,/pattern-studio\.png/,'Auto pattern follows the selected compositional base');
  assert.match(html,/<td align="center" style="[^"]*font-family:Georgia,Times,serif/);
  assert.match(html,/font-family:'IBM Plex Mono'[^\"]*font-weight:400/,'The role stays regular monospace');
  assert.equal(core.plainText(v),core.plainText(core.defaults));
});

test('custom type and alignment work with every composition, size and arrangement',()=>{
  for(const composition of core.designs.map(d=>d.id).filter(id=>id!=='original'))for(const font of ['sans','serif','mono'])for(const align of ['left','center'])
    for(const layout of ['paired','stacked'])for(const [width,height] of [[280,180],[321,208],[420,320]]){
      const v=values({design:'custom',customLayout:JSON.stringify({composition,font,align}),layout,width,height});
      assert.deepEqual(core.validate(v),{},JSON.stringify({composition,font,align,layout,width,height}));
      const html=core.render(v);assert.ok(html.length<10000);
      assert.equal(core.plainText(v),core.plainText(core.defaults));
    }
});

test('custom artwork renders native bounded table cells and no invented image endpoint',()=>{
  for(const d of core.designs){
    const v=values({design:d.id,pattern:'custom',customPattern}),html=core.render(v);
    assert.match(html,/<colgroup>/);assert.match(html,/bgcolor="#22aa77"/);assert.match(html,/bgcolor="#eeaa33"/);
    assert.doesNotMatch(html,/pattern-custom|data:image|<svg|background-image|position:|<script|onload=/);
    assert.ok(html.length<10000);assert.equal(core.plainText(v),core.plainText(core.defaults));
  }
  const merged=core.render(values({pattern:'custom',customPattern:JSON.stringify({palette:['#123456'],rows:Array(32).fill('0'.repeat(12))})}));
  assert.equal((merged.match(/bgcolor="#123456"/g)||[]).length,1,'Identical rows and adjacent cells merge into one native color cell');
});

test('overly detailed native mosaics fail with an artwork-specific email budget error',()=>{
  const dense=JSON.stringify({palette:['#112233','#aabbcc'],rows:Array.from({length:24},(_,y)=>Array.from({length:16},(_,x)=>String((x+y)%2)).join(''))});
  assert.ok(core.parseCustomPattern(dense));
  const v=values({pattern:'custom',customPattern:dense});
  assert.equal(typeof core.validate(v).customPattern,'string');
  assert.throws(()=>core.render(v),error=>typeof error.errors?.customPattern==='string');
});

test('chosen custom display fonts use their own width estimates',()=>{
  for(const font of ['sans','serif','mono']){
    const v=values({design:'custom',customLayout:JSON.stringify({composition:'signal',font,align:'center'}),layout:'stacked',width:280,nameLine1:'W'.repeat(24)});
    assert.equal(typeof core.validate(v).nameLine1,'string');assert.throws(()=>core.render(v));
  }
});
