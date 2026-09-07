// Independent extension contract checks. Browser interaction evidence lives in
// docs/reviews/ai-extension-2026-09-07.md; these tests do not simulate a real AI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ai from '../ai-extension-core.js';
import core from '../signature-core.js';
import session from '../session-data.js';
import history from '../editor-history.js';
import collections from '../design-collections.js';

const photo = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png', import.meta.url)).toString('base64');
const privateDraft = {...core.defaults, nameLine1:'Privacy',nameLine2:'Sentinel',title:'PRIVATE_ROLE_739',subtitle:'PRIVATE_SUBTITLE_739',tags:'PRIVATE_TAGS_739',
  website:'https://example.com/private-site-739',websiteLabel:'PRIVATE_LABEL_739',email:'private739@example.com',phone:'+41 22 739 00 00',
  linkedin:'https://www.linkedin.com/in/private739',location:'PRIVATE_CITY_739',portraitUrl:'https://example.com/private-photo-739.png',portraitData:photo,
  imageBase:'https://example.com/private-assets-739',width:420,height:320};
const envelope = (section,changes,other={}) => JSON.stringify({format:'signature-ai',version:1,section,name:'Independent proposal',changes,...other});
const settings = (section,draft=privateDraft,includeDetails=false) => ({section,draft,includeDetails});
const pattern = {palette:['#edcc83','#7763c5'],rows:['....00..','....00..','........','11......','11......','........','......00','......00']};
const recipe = {composition:'editorial',font:'serif',align:'center'};
const identityKeys = ['nameLine1','nameLine2','title','subtitle','tags','website','websiteLabel','email','phone','linkedin','location','portraitData','portraitUrl','imageBase'];

test('all seven independent section prompts keep stored identity and photo private by default', () => {
  const sections = ['design','artwork','layout','colors','details','icons','photo'];
  assert.deepEqual(Object.keys(ai.sections).sort(),sections.sort());
  for (const section of sections) {
    const text = ai.buildPrompt(section,privateDraft,{brief:'An elegant moon and stars'});
    assert.ok(text.includes('An elegant moon and stars'));
    for (const key of identityKeys) assert.ok(!text.includes(privateDraft[key]),section + ' leaks ' + key);
    assert.doesNotMatch(text,/data:image|base64|private739|private-photo-739|private-assets-739/);
    assert.match(text,/"format":"signature-ai"/);
  }
  const opted = ai.buildPrompt('details',privateDraft,{includeDetails:true});
  for (const key of identityKeys.filter(key => !['portraitData','portraitUrl','imageBase'].includes(key))) assert.ok(opted.includes(privateDraft[key]),key);
  for (const key of ['portraitData','portraitUrl','imageBase']) assert.ok(!opted.includes(privateDraft[key]),key);
  // A previous details opt-in must not enable disclosure in another section.
  assert.ok(!ai.buildPrompt('colors',privateDraft,{includeDetails:true}).includes(privateDraft.email));
});

test('every section example is usable and only explicit details opt-in can rewrite identity', () => {
  for (const section of ['design','artwork','layout','colors','details','icons','photo']) {
    const proposal = ai.createProposal(ai.exampleResponse(section),settings(section));
    const patch = ai.applyProposal(proposal,privateDraft);
    for (const key of identityKeys.filter(key => !(section === 'details' && ['title','subtitle','tags'].includes(key)))) assert.equal(proposal.candidate[key],privateDraft[key],section + ' preserves ' + key);
    assert.ok(Object.keys(patch).length);
    assert.match(core.render(proposal.candidate),/^<table/);
  }
  assert.throws(() => ai.createProposal(envelope('details',{nameLine1:'Alex'}),settings('details')),/Unsupported/);
  assert.equal(ai.createProposal(envelope('details',{nameLine1:'Alex'}),settings('details',privateDraft,true)).candidate.nameLine1,'Alex');
  assert.throws(() => ai.createProposal(envelope('details',{portraitUrl:'https://example.com/new.png'}),settings('details',privateDraft,true)),/Unsupported/);
});

test('malformed envelopes, code, unknown keys and prototype pollution cannot become a proposal', () => {
  const invalid = [
    '<script>alert(1)</script>', 'Here is your JSON: ' + envelope('colors',{accent:'#112233'}),
    envelope('colors',{accent:'#112233'},{version:2}), envelope('colors',{accent:'#112233'},{format:'signature-editor-session'}),
    envelope('layout',{design:'orbit'}), envelope('colors',{}), envelope('colors',{accent:'#112233'},{extra:'unknown'}),
    envelope('colors',{frontBackground:'red'}), envelope('colors',{accent:'url(https://example.com/x)'}),
    envelope('colors',{nameLine1:'Unrequested identity'}), envelope('colors',{css:'body{display:none}'}),
    envelope('colors',{accent:'#112233'},{name:'<img src=x onerror=alert(1)>'}),
    '{"format":"signature-ai","version":1,"section":"colors","name":"x","changes":{"__proto__":{"polluted":true}}}',
    '{"format":"signature-ai","version":1,"section":"colors","name":"x","changes":{"constructor":{"prototype":{"polluted":true}}}}',
    ' '.repeat(65537)
  ];
  for (const text of invalid) assert.throws(() => ai.createProposal(text,settings('colors')),TypeError);
  assert.equal({}.polluted,undefined);
  assert.throws(() => ai.createProposal(envelope('layout',{width:'320'}),settings('layout')),/whole number/);
  assert.throws(() => ai.createProposal(envelope('layout',{height:321}),settings('layout')),/whole number/);
  assert.throws(() => ai.createProposal(envelope('photo',{portraitSize:39}),settings('photo')),/whole number/);
  assert.throws(() => ai.createProposal(envelope('icons',{websiteIcon:'https://example.com/icon.png'}),settings('icons')),/available/);
  assert.throws(() => ai.createProposal(envelope('details',{title:'<b>Developer</b>'}),settings('details')),/markup/);
  assert.equal(ai.createProposal('```json\n' + envelope('colors',{accent:'#ABCDEF'}) + '\n```',settings('colors')).changes.accent,'#abcdef');
});

test('custom artwork and layout recipes survive preview, email, undo, redo and exported session', () => {
  const before = {...privateDraft};
  const proposal = ai.createProposal(envelope('design',{design:'custom',customLayout:recipe,pattern:'custom',customPattern:pattern}),settings('design',before));
  const after = {...before,...ai.applyProposal(proposal,before)};
  for (const key of identityKeys) assert.equal(after[key],before[key],key);
  const html = core.render(after);
  assert.ok(html.length < 10000);
  assert.match(html,/Georgia,Times,serif/);
  assert.match(html,/#edcc83/);
  assert.doesNotMatch(html,/<(?:script|style|svg|canvas|iframe)|\bon[a-z]+=|data:image|blob:|(?:position|transform|object-fit):/i);
  assert.match(html,/src="https:\/\/example.com\/private-photo-739.png"/);
  for (const [,src] of html.matchAll(/\bsrc="([^"]+)"/g)) assert.ok(src.startsWith('https://'),src);
  const changes = history.create(); changes.record(before,after);
  assert.deepEqual(changes.undo(after),before); assert.deepEqual(changes.redo(before),after);
  const restored = session.parse(session.serialize({draft:after})).draft;
  assert.deepEqual(restored,after);
  assert.equal(core.render(restored),html);
  assert.deepEqual(core.parseCustomPattern(restored.customPattern),pattern);
  assert.deepEqual(core.parseCustomLayout(restored.customLayout),recipe);
});

test('custom recipes reject unsupported code, inconsistent artwork, and unsafe HTML budgets', () => {
  const badPatterns = [
    {...pattern,css:'filter:blur(1px)'}, {...pattern,palette:['url(https://example.com/x)']},
    {...pattern,rows:['0000','000','0000','0000']}, {...pattern,rows:['8888','....','....','....']},
    {...pattern,rows:['7777','....','....','....']}, {...pattern,rows:Array(32).fill('0'.repeat(16))},
    JSON.stringify(pattern)
  ];
  for (const customPattern of badPatterns) assert.throws(() => ai.createProposal(envelope('artwork',{pattern:'custom',customPattern}),settings('artwork')),TypeError);
  for (const customLayout of [{...recipe,html:'<table>'},{...recipe,align:'right'},{...recipe,font:'Comic Sans'},{composition:'original',font:'sans',align:'left'}])
    assert.throws(() => ai.createProposal(envelope('layout',{design:'custom',customLayout}),settings('layout')),TypeError);
  assert.throws(() => ai.createProposal(envelope('artwork',{customPattern:pattern}),settings('artwork')),/also set/);
  assert.throws(() => ai.createProposal(envelope('layout',{customLayout:recipe}),settings('layout')),/also set/);
  const checker = {palette:['#ffffff','#000000'],rows:Array.from({length:24},(_,i)=>(i%2?'10':'01').repeat(8))};
  assert.throws(() => ai.createProposal(envelope('artwork',{pattern:'custom',customPattern:checker}),settings('artwork')),/10,000/);
});

test('only a genuine unchanged preview can apply; forged, modified and stale proposals fail', () => {
  const draft = {...privateDraft};
  const proposal = ai.createProposal(envelope('colors',{accent:'#123456'}),settings('colors',draft));
  assert.equal(draft.accent,privateDraft.accent,'Preview has no draft side effect');
  assert.ok(Object.isFrozen(proposal)); assert.ok(Object.isFrozen(proposal.changes)); assert.ok(Object.isFrozen(proposal.candidate));
  assert.throws(() => { proposal.changes.accent='#ffffff'; },TypeError);
  assert.throws(() => ai.applyProposal({...proposal},draft),/Preview/);
  assert.throws(() => ai.applyProposal(JSON.parse(JSON.stringify(proposal)),draft),/Preview/);
  for (const change of [{nameLine1:'Another'},{portraitData:''},{width:419},{accent:'#ffffff'}])
    assert.throws(() => ai.applyProposal(proposal,{...draft,...change}),/changed since/);
  assert.deepEqual(ai.applyProposal(proposal,Object.fromEntries(Object.entries(draft).reverse())),{accent:'#123456'});
});

test('all four independently expected fantasy themes retain portraits and produce hosted email artwork', () => {
  const expected = {galaxy:'orbit',starlight:'editorial',moonlight:'contour',frost:'signal'};
  assert.deepEqual(collections.map(item=>item.id).sort(),Object.keys(expected).sort());
  for (const [id,design] of Object.entries(expected)) {
    const collection = collections.find(item=>item.id===id);
    assert.equal(collection.design,design); assert.equal(collection.pattern,id);
    const {frontBackground,backBackground,accent,pattern} = collection;
    for (const layout of ['paired','stacked']) {
      const after = {...privateDraft,design,frontBackground,backBackground,accent,pattern,layout};
      const restored = session.parse(session.serialize({draft:after})).draft;
      for (const key of identityKeys) assert.equal(restored[key],privateDraft[key],id + ':' + key);
      const html = core.render(restored);
      assert.ok(html.includes('pattern-'+id+'.png')); assert.ok(html.length<10000);
      assert.doesNotMatch(html,/data:image|blob:|<svg|<script/);
      assert.ok(core.render(restored,{preview:true}).includes(photo));
      const artwork = readFileSync(new URL('../sig/pattern-'+id+'.png',import.meta.url));
      assert.deepEqual([...artwork.subarray(0,8)],[137,80,78,71,13,10,26,10]);
      assert.equal(artwork.readUInt32BE(16),304); assert.equal(artwork.readUInt32BE(20),728);
    }
  }
});

test('selective import uses the independently expected information/design boundary and preserves every unchecked field', () => {
  const information = ['nameLine1','nameLine2','title','subtitle','website','websiteLabel','email','phone','linkedin','location','tags','portraitData','portraitUrl'];
  const design = ['width','height','layout','design','pattern','customPattern','customLayout','accent','frontBackground','backBackground','websiteIcon','emailIcon','phoneIcon','linkedinIcon','locationIcon','imageBase','portraitShape','portraitSize'];
  assert.deepEqual([...session.informationFields].sort(),[...information].sort());
  assert.deepEqual([...session.designFields].sort(),[...design].sort());
  const oldTheme = {id:'theme-shared',name:'Old palette',frontBackground:'#eeeeee',backBackground:'#111111',accent:'#557755'};
  const newTheme = {id:'theme-shared',name:'Incoming palette',frontBackground:'#eeddcc',backBackground:'#223344',accent:'#994466'};
  const current = session.parse(session.serialize({draft:privateDraft,themes:[oldTheme],ui:{editorTab:'photo',selectedThemeId:oldTheme.id}}));
  const incoming = session.parse(session.serialize({draft:{...core.defaults,nameLine1:'Incoming',nameLine2:'Person',title:'Artist',subtitle:'ART',tags:'DRAW · BUILD',
    website:'https://example.org/work',websiteLabel:'Portfolio',email:'incoming@example.org',phone:'+44 20 0000 0000',linkedin:'https://www.linkedin.com/in/incoming',location:'Paris',
    portraitData:'data:image/png;base64,'+readFileSync(new URL('../sig/icon-pin.png',import.meta.url)).toString('base64'),portraitUrl:'https://example.org/incoming.png',
    width:410,height:310,layout:'stacked',design:'custom',customLayout:JSON.stringify(recipe),pattern:'custom',customPattern:JSON.stringify(pattern),
    accent:'#994466',frontBackground:'#eeddcc',backBackground:'#223344',websiteIcon:'mail',emailIcon:'none',phoneIcon:'pin',linkedinIcon:'web',locationIcon:'linkedin',imageBase:'https://example.org/new-assets',portraitShape:'square',portraitSize:80},
    themes:[newTheme],ui:{editorTab:'layout',previewView:'email',imageScale:6,imageBackground:'white',selectedThemeId:newTheme.id,themeName:'New colors'}}));
  const beforeCurrent = JSON.stringify(current), beforeIncoming = JSON.stringify(incoming);
  for (const key of information.concat(design)) assert.notEqual(incoming.draft[key],current.draft[key],'Fixture exercises '+key);
  for (const choices of [{information:true,design:false},{information:false,design:true},{information:true,design:true}]) {
    const selected = session.selectParts(incoming,current,choices);
    for (const key of information) assert.equal(selected.draft[key],(choices.information?incoming:current).draft[key],JSON.stringify(choices)+' '+key);
    for (const key of design) assert.equal(selected.draft[key],(choices.design?incoming:current).draft[key],JSON.stringify(choices)+' '+key);
    assert.deepEqual(selected.ui,(choices.design?incoming:current).ui);
    const merged = session.mergeThemes(current.themes,selected.themes,selected.ui.selectedThemeId);
    assert.equal(merged.themes.length,choices.design?2:1);
    assert.ok(merged.themes.some(theme=>theme.name==='Old palette'));
    assert.equal(merged.themes.find(theme=>theme.id===merged.selectedThemeId).name,choices.design?'Incoming palette (imported)':'Old palette');
  }
  assert.throws(()=>session.selectParts(incoming,current,{information:false,design:false}),/Select/);
  assert.equal(JSON.stringify(current),beforeCurrent); assert.equal(JSON.stringify(incoming),beforeIncoming);
});

test('copied-text repairs stay narrow and feed strict validation before partial import', () => {
  const incoming = {draft:{...core.defaults,email:'person@example.com',linkedin:'https://www.linkedin.com/in/person',imageBase:'https://example.com/assets'}};
  const copied = session.serialize(incoming)
    .replace('person@example.com','person\\@example.com')
    .replace('"https://www.linkedin.com/in/person"','"[https://www.linkedin.com/in/person](https://www.linkedin.com/in/person)"')
    .replace('"https://example.com/assets"','"[https://example.com/assets](https://example.com/assets)"');
  const result = session.parsePasted(copied);
  assert.equal(result.repairs.length,3);
  assert.equal(result.session.draft.email,'person@example.com');
  assert.equal(result.session.draft.linkedin,'https://www.linkedin.com/in/person');
  assert.equal(result.session.draft.imageBase,'https://example.com/assets');
  assert.equal(session.parsePasted(session.serialize(incoming)).repairs.length,0);
  for (const bad of [
    copied.replace('person\\@example.com','person\\q@example.com'),
    copied.replace('[https://example.com/assets](https://example.com/assets)','[https://example.com/assets](https://different.example.com/assets)'),
    copied.replace('[https://example.com/assets](https://example.com/assets)','[javascript:alert(1)](javascript:alert(1))'),
    copied.replace('"width": 321','"width": "321"'),
    copied.replace('"nameLine1": "Avery"','"nameLine1": {"__proto__":{"polluted":true}}')
  ]) assert.throws(()=>session.parsePasted(bad),TypeError);
  assert.equal({}.polluted,undefined);
});
