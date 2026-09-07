import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../signature-core.js';
import codec from '../session-data.js';
const example=(draft={},themes=[])=>({draft:{...core.defaults,...draft},themes,ui:{editorTab:'details'}});

test('information and design form disjoint complete field groups',()=>{
  const fields=[...codec.informationFields,...codec.designFields];
  assert.equal(new Set(fields).size,fields.length);
  assert.deepEqual([...fields].sort(),Object.keys(core.defaults).sort());
  assert.ok(codec.informationFields.includes('portraitUrl')); assert.ok(codec.designFields.includes('portraitShape'));
});
test('selected groups preserve unselected content, photos, themes and UI',()=>{
  const savedTheme={id:'theme-existing',name:'My theme',frontBackground:'#ffffff',backBackground:'#101010',accent:'#669966'};
  const current=example({nameLine1:'Casey',portraitUrl:'https://example.org/me.jpg',design:'studio'},[savedTheme]);
  current.ui={editorTab:'photo',selectedThemeId:savedTheme.id};
  const incoming=example({nameLine1:'Jordan',portraitUrl:'',design:'signal',pattern:'frost'});
  const information=codec.selectParts(incoming,current,{information:true,design:false});
  assert.equal(information.draft.nameLine1,'Jordan'); assert.equal(information.draft.design,'studio'); assert.equal(information.draft.portraitUrl,'');
  assert.deepEqual(information.themes,current.themes); assert.equal(information.ui.editorTab,'photo');
  const design=codec.selectParts(incoming,current,{information:false,design:true});
  assert.equal(design.draft.nameLine1,'Casey'); assert.equal(design.draft.portraitUrl,current.draft.portraitUrl); assert.equal(design.draft.design,'signal');
  assert.deepEqual(design.themes,[]); assert.equal(design.ui.editorTab,'details');
  assert.equal(current.draft.design,'studio'); assert.equal(incoming.draft.nameLine1,'Jordan');
});
test('selected import validates the merged fit and can repair an invalid current selected field',()=>{
  assert.throws(()=>codec.selectParts(example(),example(),{information:false,design:false}),/Select/);
  const bad=example({accent:'bad'});
  assert.doesNotThrow(()=>codec.selectParts(example(),bad,{information:false,design:true}));
  assert.throws(()=>codec.selectParts(example(),bad,{information:true,design:false}),/accent/);
  const source=example({nameLine1:'MMMMMMMMMMMMMMMMMMMM',nameLine2:'MMMMMMMMMMMMMMM',width:420,height:320});
  assert.throws(()=>codec.selectParts(source,example({width:280,height:180}),{information:true,design:false}),/name|width|fit|shorter/i);
});
test('chat-pasted email escapes and identical Markdown URL wrappers are cleaned explicitly',()=>{
  const draft=example({email:'jordan@example.com',linkedin:'https://www.linkedin.com/in/example',imageBase:'https://example.com/sig'});
  let text=codec.serialize(draft).replace('jordan@example.com','jordan\\@example.com');
  text=text.replace('"https://www.linkedin.com/in/example"','"[https://www.linkedin.com/in/example](https://www.linkedin.com/in/example)"');
  text=text.replace('"https://example.com/sig"','"[https://example.com/sig](https://example.com/sig)"');
  assert.throws(()=>codec.parse(text),/valid JSON/);
  const result=codec.parsePasted('```json\n'+text+'\n```');
  assert.equal(result.session.draft.email,'jordan@example.com'); assert.equal(result.session.draft.linkedin,'https://www.linkedin.com/in/example'); assert.equal(result.session.draft.imageBase,'https://example.com/sig');
  assert.equal(result.repairs.length,4);
});
test('paste cleanup never repairs arbitrary malformed JSON, redirects or unsafe values',()=>{
  for(const replacement of ['[https://example.com](https://evil.example)','[javascript:alert(1)](javascript:alert(1))','file:///private/sig']) {
    assert.throws(()=>codec.parsePasted(codec.serialize(example()).replace(core.defaults.imageBase,replacement)));
  }
  assert.throws(()=>codec.parsePasted('{"nameLine1":"bad\\q"}'),/valid JSON/);
  assert.throws(()=>codec.parsePasted('{"__proto__":{"polluted":true}}'),/prototype/);
  assert.throws(()=>codec.parsePasted('x'.repeat(1048577)),/too large/);
  assert.equal({}.polluted,undefined);
});
