import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../signature-core.js');
const codec = require('../session-data.js');
const draft = changes => ({ ...core.defaults, ...changes });
const theme = (id = 'theme-1', name = 'Océan', accent = '#a64435') => ({ id, name, frontBackground:'#edf2ea', backBackground:'#1d392f', accent });
const envelope = changes => ({format:'signature-editor-session', version:1, exportedAt:'2026-09-05T12:00:00.000Z', draft:draft(), themes:[], ...changes});
const parseValue = value => codec.parse(JSON.stringify(value));
// Independent copy of the frozen compact-editor contract (v1 text and spacing,
// v2 contact presentation). A changed implementation default or range must
// fail here instead of moving silently.
const contactDefaults = {contactSeparator:'none', websiteVisible:'show', emailVisible:'show', phoneVisible:'show', linkedinVisible:'show', locationVisible:'show'};
const formatDefaults = {nameLayout:'template', nameFontSize:0, titleFontSize:0, subtitleFontSize:0, contactFontSize:0, footerFontSize:0,
  lineSpacing:100, textSpacing:100, contactSpacing:100, sectionSpacing:100, contentPadding:-1,
  singleArrangement:'auto', contactLayout:'template', contactFont:'template', footerVisible:'show', ...contactDefaults};
const formatKeys = Object.keys(formatDefaults);
const visibilityKeys = ['websiteVisible','emailVisible','phoneVisible','linkedinVisible','locationVisible'];
const formatValid = {nameLayout:['template','single','wrap'], nameFontSize:[0,12,22,40], titleFontSize:[0,8,11,24], subtitleFontSize:[0,8,11,24],
  contactFontSize:[0,8,12,24], footerFontSize:[0,8,10,24], lineSpacing:[80,100,200], textSpacing:[0,65,200], contactSpacing:[0,100,200],
  sectionSpacing:[0,70,200], contentPadding:[-1,0,16,48], singleArrangement:['auto','rows','columns'], contactLayout:['template','stacked','inline'],
  contactFont:['template','sans','mono'], footerVisible:['show','hide'], contactSeparator:['none','bar','dot','slash','dash'],
  ...Object.fromEntries(visibilityKeys.map(key => [key, ['show','hide']]))};
const smallSizeInvalid = [1,7,-1,25,11.5,'11',null,false,[],{}];
const visibilityInvalid = ['','Hide','SHOW','hidden','visible',true,false,0,1,null,[],{}];
const formatInvalid = {nameLayout:['','Single','auto','inline',0,true,null,[],{}], nameFontSize:[1,11,-1,41,22.5,'22',null,true,[],{}],
  titleFontSize:smallSizeInvalid, subtitleFontSize:smallSizeInvalid, contactFontSize:smallSizeInvalid, footerFontSize:smallSizeInvalid,
  lineSpacing:[0,79,201,100.5,'100',null,true,[],{}], textSpacing:[-1,201,65.5,'65',null,true,[],{}], contactSpacing:[-1,201,99.5,'100',null,false,[],{}],
  sectionSpacing:[-1,201,70.5,'70',null,true,[],{}], contentPadding:[-2,49,16.5,'16','-1',null,true,[],{}],
  singleArrangement:['','Rows','template','stacked',1,false,null,[],{}], contactLayout:['','Inline','auto','rows',0,true,null,[],{}],
  contactFont:['','Sans','serif','Arial',0,null,[],{}], footerVisible:['','Hide','hidden',true,false,0,null,[],{}],
  contactSeparator:['','None','Bar','|','·','/','–','comma',0,true,null,[],{}], ...Object.fromEntries(visibilityKeys.map(key => [key, visibilityInvalid]))};
const formatOf = value => Object.fromEntries(formatKeys.map(key => [key, value[key]]));
// Every text, spacing and contact presentation field differs from its default at once.
const compactAll = {cardFormat:'single', layout:'paired', width:400, height:180, nameLayout:'single', nameFontSize:22, titleFontSize:11,
  subtitleFontSize:11, contactFontSize:12, footerFontSize:10, lineSpacing:110, textSpacing:65, contactSpacing:90, sectionSpacing:70,
  contentPadding:16, singleArrangement:'rows', contactLayout:'inline', contactFont:'sans', footerVisible:'hide',
  contactSeparator:'dot', websiteVisible:'hide', emailVisible:'hide', phoneVisible:'hide', linkedinVisible:'hide', locationVisible:'hide'};

test('browser global and CommonJS API operate without DOM or storage', () => {
  const window = {SignatureCore:core};
  vm.runInNewContext(readFileSync(new URL('../session-data.js', import.meta.url), 'utf8'), {window, TextEncoder, URL});
  assert.equal(typeof window.SignatureSession.serialize, 'function');
  assert.equal(typeof window.SignatureSession.mergeThemes, 'function');
  const result = window.SignatureSession.parse(window.SignatureSession.serialize({draft:draft()}));
  assert.equal(result.draft.nameLine1, core.defaults.nameLine1);
});

test('Unicode drafts, saved themes, and UI round-trip through pretty versioned JSON', () => {
  const input = {draft:draft({nameLine1:'Zoë', nameLine2:'Mörgán'}), themes:[theme()], ui:{editorTab:'design', previewView:'email', emailScale:80, imageScale:6, imageBackground:'white', selectedThemeId:'theme-1', themeName:'Crème 東京'}};
  const text = codec.serialize(input), raw = JSON.parse(text);
  assert.match(text, /\n  "format":/);
  assert.equal(raw.format, 'signature-editor-session');
  assert.equal(raw.version, 1);
  assert.equal(new Date(raw.exportedAt).toISOString(), raw.exportedAt);
  assert.deepEqual(codec.parse(text), input);
});

test('all four editor views survive session export and restore', () => {
  for (const editorTab of ['layout','details','photo','design']) {
    const input = {draft:draft({layout:'stacked'}), ui:{editorTab}};
    const text = codec.serialize(input);
    assert.equal(JSON.parse(text).ui.editorTab, editorTab);
    const restored = codec.parse(text);
    assert.equal(restored.ui.editorTab, editorTab);
    assert.equal(restored.draft.layout, 'stacked');
  }
});

test('email output size is optional in old sessions and strictly validated in new sessions', () => {
  assert.equal(codec.parse(codec.serialize({draft:draft()})).ui.emailScale,100);
  for(const scale of [50,70,80,100,150]) assert.equal(codec.parse(codec.serialize({draft:draft(),ui:{emailScale:scale}})).ui.emailScale,scale);
  for(const scale of [null,'80',false,NaN,Infinity,0,49,151,80.5]) assert.throws(()=>codec.serialize({draft:draft(),ui:{emailScale:scale}}),/emailScale/);
});

test('legacy Colors sessions restore into Design without changing their content', () => {
  const input = envelope({draft:draft({accent:'#a64435'}), themes:[theme()],
    ui:{editorTab:'colors', selectedThemeId:'theme-1', themeName:'Saved palette'}});
  const before = structuredClone(input);
  const restored = parseValue(input);
  assert.equal(restored.ui.editorTab, 'design');
  assert.equal(restored.ui.selectedThemeId, 'theme-1');
  assert.equal(restored.ui.themeName, 'Saved palette');
  assert.deepEqual(restored.draft, input.draft);
  assert.deepEqual(restored.themes, input.themes);
  assert.equal(JSON.parse(codec.serialize(input)).ui.editorTab, 'design');
  assert.deepEqual(codec.parse(codec.serialize(restored)), restored);
  assert.deepEqual(input, before);
});

test('bare legacy drafts gain missing core fields and default UI without importing themes', () => {
  const result = parseValue({nameLine1:'Avery', title:'Engineer'});
  assert.equal(result.draft.title, 'Engineer');
  assert.equal(result.draft.frontBackground, core.defaults.frontBackground);
  assert.equal(result.draft.websiteIcon, core.defaults.websiteIcon);
  assert.deepEqual(result.themes, []);
  assert.deepEqual(result.ui, {editorTab:'details', previewView:'card', emailScale:100, imageScale:4, imageBackground:'transparent', selectedThemeId:'', themeName:''});
  assert.equal(codec.parse('\uFEFF' + JSON.stringify(draft())).draft.nameLine1, core.defaults.nameLine1);
});

test('legacy drafts and version 1 backups retain the original 20 pixel card gap', () => {
  const legacy = draft(); delete legacy.cardGap;
  const before = structuredClone(legacy);
  for (const input of [legacy, envelope({draft:legacy})]) {
    const restored = parseValue(input);
    assert.equal(restored.draft.cardGap, 20);
    assert.equal(codec.parse(codec.serialize(restored)).draft.cardGap, 20);
  }
  assert.deepEqual(legacy, before);
});

test('card gap boundaries round-trip and malformed values are rejected in backups', () => {
  for (const layout of ['paired','stacked']) for (const cardGap of [0,20,60]) {
    const input = {draft:draft({layout,cardGap})};
    const text = codec.serialize(input);
    assert.equal(JSON.parse(text).draft.cardGap, cardGap);
    assert.deepEqual(codec.parse(text).draft, input.draft);
  }
  for (const cardGap of [-1,61,1.5,'0',null,true,[],{}]) {
    assert.throws(() => parseValue(envelope({draft:draft({cardGap})})), /cardGap/);
  }
  assert.throws(() => codec.serialize({draft:draft({cardGap:NaN})}), /cardGap/);
});

test('legacy formats restore as auto without changing template geometry or stored colors and gap', () => {
  const customLayout = JSON.stringify({composition:'editorial',font:'serif',align:'center'});
  for (const design of ['original','orbit','custom']) for (const layout of ['paired','stacked']) {
    const legacy = draft({design,layout,customLayout,width:420,height:320,cardGap:43,backBackground:'#123456'});
    delete legacy.cardFormat;
    const before = structuredClone(legacy);
    for (const input of [legacy, envelope({draft:legacy})]) {
      const restored = parseValue(input);
      assert.equal(restored.draft.cardFormat, 'auto');
      assert.equal(restored.draft.cardGap, 43); assert.equal(restored.draft.backBackground, '#123456');
      assert.deepEqual(core.dimensions(restored.draft), core.dimensions(legacy));
      assert.equal(core.render(restored.draft), core.render(legacy));
      assert.deepEqual(codec.parse(codec.serialize(restored)), restored);
    }
    assert.deepEqual(legacy, before);
  }
});

test('all card formats round-trip in version 1 and unsupported formats fail strictly', () => {
  for (const cardFormat of ['auto','single','front-back']) for (const layout of ['paired','stacked']) {
    const input = {draft:draft({cardFormat,layout,width:420,height:320,cardGap:0,backBackground:'#123456'})};
    const text = codec.serialize(input), raw = JSON.parse(text);
    assert.equal(raw.version, 1); assert.equal(raw.draft.cardFormat, cardFormat);
    assert.deepEqual(codec.parse(text).draft, input.draft);
  }
  for (const cardFormat of ['', 'Single', 'paired', 'frontBack', 0, false, null, [], {}]) {
    assert.throws(() => parseValue(envelope({draft:draft({cardFormat})})), /cardFormat|format/i);
    assert.throws(() => codec.serialize({draft:draft({cardFormat})}), /cardFormat|format/i);
  }
});

test('older drafts and version 1 sessions gain full artwork opacity without changing their existing output',()=>{
  for(const artworkPlacement of ['auto','motif','flow']) {
    const legacy=draft({pattern:'gesture',artworkPlacement,artworkScale:125});delete legacy.artworkOpacity;
    const before=structuredClone(legacy);
    for(const input of [legacy,envelope({draft:legacy})]) {
      const restored=parseValue(input);
      assert.equal(restored.draft.artworkOpacity,100);
      assert.equal(core.render(restored.draft),core.render(legacy));
      assert.deepEqual(codec.parse(codec.serialize(restored)),restored);
    }
    assert.deepEqual(legacy,before);
  }
});

test('background framing and opacity round-trip with strict types and ranges',()=>{
  for(const artworkScale of [25,100,250,400]) for(const artworkOpacity of [0,35,100]) {
    const value=draft({cardFormat:'single',artworkPlacement:'background',artworkScale,artworkOpacity,artworkPositionX:0,artworkPositionY:100});
    assert.deepEqual(codec.parse(codec.serialize({draft:value})).draft,value);
  }
  const customPattern=JSON.stringify({palette:['#2348c7'],rows:['00..','00..','....','....']});
  const custom=draft({pattern:'custom',customPattern,artworkPlacement:'background',artworkOpacity:45});
  assert.deepEqual(codec.parse(codec.serialize({draft:custom})).draft,custom);
  for(const [key,values] of [['artworkScale',[24,401,1.5,'250',null,true,{},[]]],['artworkOpacity',[-1,101,1.5,'35',null,true,{},[]]],['artworkPlacement',['Background','overlay',false,null,{},[]]]]) {
    for(const value of values) {
      assert.throws(()=>parseValue(envelope({draft:draft({[key]:value})})),new RegExp(key));
      assert.throws(()=>codec.serialize({draft:draft({[key]:value})}),new RegExp(key));
    }
  }
  for(const value of [NaN,Infinity])assert.throws(()=>codec.serialize({draft:draft({artworkOpacity:value})}),/artworkOpacity/);
});

test('selective design import owns background settings while information import leaves the current artwork intact',()=>{
  const current={draft:draft({nameLine1:'Existing',artworkPlacement:'motif',artworkOpacity:80,artworkScale:100}),themes:[],ui:{}};
  const incoming={draft:draft({nameLine1:'Incoming',pattern:'dots',artworkPlacement:'background',artworkScale:400,artworkOpacity:35,artworkPositionX:0,artworkPositionY:100}),themes:[],ui:{}};
  const keys=['pattern','artworkPlacement','artworkScale','artworkOpacity','artworkPositionX','artworkPositionY'];
  for(const selection of [{information:false,design:true},{information:true,design:false},{information:true,design:true}]) {
    const result=codec.selectParts(incoming,current,selection);
    for(const key of keys)assert.equal(result.draft[key],(selection.design?incoming:current).draft[key],key+' belongs to Design');
    assert.equal(result.draft.nameLine1,(selection.information?incoming:current).draft.nameLine1);
  }
  assert.ok(codec.designFields.includes('artworkOpacity'));assert.ok(!codec.informationFields.includes('artworkOpacity'));
});

test('text and spacing controls are Design fields while names, contacts and photos stay Information', () => {
  assert.deepEqual([...codec.informationFields], ['nameLine1','nameLine2','title','subtitle','website','websiteLabel','email','phone','linkedin','location','tags','portraitData','portraitUrl']);
  for (const key of formatKeys) {
    assert.ok(codec.designFields.includes(key), key + ' belongs to Design');
    assert.ok(!codec.informationFields.includes(key), key + ' is not Information');
  }
  assert.equal(new Set(codec.designFields).size, codec.designFields.length);
  assert.ok(Object.isFrozen(codec.designFields) && Object.isFrozen(codec.informationFields));
});

test('drafts and version 1 sessions without text and spacing fields gain template defaults and keep their exact output', () => {
  const customLayout = JSON.stringify({composition:'editorial',font:'serif',align:'center'});
  for (const design of ['original','orbit','custom']) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back']) {
    const legacy = draft({design,layout,cardFormat,customLayout:design === 'custom' ? customLayout : '',portraitUrl:'https://example.com/portrait.jpg'});
    for (const key of formatKeys) delete legacy[key];
    const before = structuredClone(legacy), label = [design,layout,cardFormat].join(':');
    for (const input of [legacy, envelope({draft:legacy})]) {
      const restored = parseValue(input);
      assert.deepEqual(formatOf(restored.draft), formatDefaults, label);
      assert.equal(core.render(restored.draft), core.render(legacy), label);
      assert.equal(core.render({...legacy, ...formatDefaults}), core.render(legacy), label + ' explicit template values');
      assert.deepEqual(core.dimensions(restored.draft), core.dimensions(legacy), label);
      assert.deepEqual(codec.parse(codec.serialize(restored)), restored, label);
    }
    assert.deepEqual(legacy, before);
  }
  const bare = parseValue({nameLine1:'Avery', title:'Engineer'});
  assert.deepEqual(formatOf(bare.draft), formatDefaults);
});

test('every text and spacing value round-trips exactly, including template zero and -1 padding', () => {
  const base = draft({cardFormat:'single', width:420, height:320});
  for (const [key, values] of Object.entries(formatValid)) for (const value of values) {
    const input = {draft:{...base, [key]:value}}, text = codec.serialize(input);
    assert.ok(Object.is(JSON.parse(text).draft[key], value), key + '=' + value + ' is written as is');
    assert.deepEqual(codec.parse(text).draft, input.draft, key + '=' + value);
  }
  const all = draft(compactAll), text = codec.serialize({draft:all}), restored = codec.parse(text);
  assert.deepEqual(restored.draft, all);
  for (const key of formatKeys) assert.notEqual(restored.draft[key], formatDefaults[key], key + ' is exercised with a non-default value');
  assert.deepEqual(codec.parse(codec.serialize(restored)), restored);
  assert.deepEqual(codec.parsePasted('```json\n' + text + '\n```').session.draft, all);
});

test('malformed text and spacing values are rejected in backups, bare drafts, pasted text and exports', () => {
  for (const [key, values] of Object.entries(formatInvalid)) for (const value of values) {
    const label = key + '=' + JSON.stringify(value), pattern = new RegExp('Draft ' + key);
    assert.throws(() => parseValue(envelope({draft:draft({[key]:value})})), pattern, label);
    assert.throws(() => parseValue({...draft(), [key]:value}), pattern, label);
    assert.throws(() => codec.parsePasted(JSON.stringify(envelope({draft:draft({[key]:value})}))), pattern, label);
    assert.throws(() => codec.serialize({draft:draft({[key]:value})}), pattern, label);
  }
  for (const key of formatKeys.filter(key => typeof formatDefaults[key] === 'number')) for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => codec.serialize({draft:draft({[key]:value})}), new RegExp(key));
  }
  assert.throws(() => parseValue(envelope({draft:draft({nameFontSize:11})})), /0 \(template size\) or a whole number from 12 to 40/);
  assert.throws(() => parseValue(envelope({draft:draft({titleFontSize:7})})), /0 \(template size\) or a whole number from 8 to 24/);
  assert.throws(() => parseValue(envelope({draft:draft({contentPadding:-2})})), /from -1 \(template padding\) to 48/);
  assert.throws(() => parseValue(envelope({draft:draft({contactLayout:'grid'})})), /template, stacked, inline/);
  assert.throws(() => parseValue(envelope({draft:draft({contactSeparator:'|'})})), /Draft contactSeparator must be one of: none, bar, dot, slash, dash/);
  assert.throws(() => parseValue(envelope({draft:draft({phoneVisible:false})})), /Draft phoneVisible must be one of: show, hide/);
});

test('hidden contacts keep every stored detail through export, restore and selective import', () => {
  const details = {website:'https://example.com/work', websiteLabel:'Selected work', email:'avery@example.com', phone:'+41 22 123 45 67',
    linkedin:'https://www.linkedin.com/in/example', location:'Geneva', websiteIcon:'mail', phoneIcon:'pin'};
  const hidden = draft({...details, contactLayout:'inline', contactSeparator:'bar', websiteVisible:'hide', phoneVisible:'hide'});
  const restored = codec.parse(codec.serialize({draft:hidden})).draft;
  assert.deepEqual(restored, hidden);
  for (const [key, value] of Object.entries(details)) assert.equal(restored[key], value, key + ' is kept while hidden');
  assert.doesNotMatch(core.plainText(restored), /123 45 67/, 'hidden phone leaves the plain text');
  assert.match(core.plainText({...restored, phoneVisible:'show'}), /123 45 67/, 'showing it again needs no re-entry');
  const other = {draft:draft({website:'https://example.org/new', phone:'+44 20 0000 0000'}), themes:[], ui:{}};
  const information = codec.selectParts(other, {draft:restored, themes:[], ui:{}}, {information:true, design:false}).draft;
  assert.equal(information.website, 'https://example.org/new'); assert.equal(information.websiteVisible, 'hide'); assert.equal(information.contactSeparator, 'bar');
  const design = codec.selectParts({draft:restored, themes:[], ui:{}}, other, {information:false, design:true}).draft;
  assert.equal(design.phone, '+44 20 0000 0000'); assert.equal(design.phoneVisible, 'hide'); assert.equal(design.websiteIcon, 'mail');
});

test('selective import moves text and spacing only with Design', () => {
  const current = {draft:draft({nameLine1:'Existing', ...formatDefaults}), themes:[], ui:{}};
  const incoming = {draft:draft({nameLine1:'Incoming', ...compactAll}), themes:[], ui:{}};
  for (const selection of [{information:false,design:true},{information:true,design:false},{information:true,design:true}]) {
    const result = codec.selectParts(incoming, current, selection);
    for (const key of formatKeys) assert.equal(result.draft[key], (selection.design ? incoming : current).draft[key], key + ' belongs to Design');
    assert.equal(result.draft.nameLine1, (selection.information ? incoming : current).draft.nameLine1);
  }
});

test('only known fields are returned and outputs do not alias inputs or one another', () => {
  const input = {draft:{...draft(), extra:'discard me'}, themes:[{...theme(), extra:'discard me'}], ui:{extra:'discard me'}};
  const before = structuredClone(input), text = codec.serialize(input), a = codec.parse(text), b = codec.parse(text);
  assert.deepEqual(input, before);
  assert.equal('extra' in a.draft, false);
  assert.equal('extra' in a.themes[0], false);
  assert.equal('extra' in a.ui, false);
  a.draft.nameLine1 = 'Changed'; a.themes[0].name = 'Changed'; a.ui.editorTab = 'icons';
  assert.equal(b.draft.nameLine1, core.defaults.nameLine1);
  assert.equal(b.themes[0].name, 'Océan');
  assert.equal(input.themes[0].name, 'Océan');
});

test('wrong file types, versions, and malformed envelope fields fail clearly', () => {
  for (const text of ['', '<html>hello</html>', '{broken', '[]', 'null', '42', '{}']) assert.throws(() => codec.parse(text), /JSON|session|draft/i);
  assert.throws(() => codec.parse(new Uint8Array()), /JSON.*text/i);
  for (const version of [0, 2, '1', null]) assert.throws(() => parseValue(envelope({version})), /version/i);
  assert.throws(() => parseValue(envelope({format:'other-app'})), /not a signature editor session/i);
  for (const exportedAt of ['', 'yesterday', 123, null, '2026-02-30T12:00:00Z']) assert.throws(() => parseValue(envelope({exportedAt})), /ISO timestamp/i);
  for (const field of ['draft','themes']) { const value = envelope(); delete value[field]; assert.throws(() => parseValue(value), /Draft|Themes/); }
});

test('prototype keys are rejected at every nesting level without polluting objects', () => {
  for (const key of ['__proto__','constructor','prototype']) {
    for (const location of ['root','draft','theme','ui','extra']) {
      const value = envelope({themes:[theme()]});
      const target = location === 'root' ? value : location === 'theme' ? value.themes[0] : location === 'extra' ? (value.extra = {nested:{}}).nested : (value[location] ||= {});
      Object.defineProperty(target, key, {value:{polluted:true}, enumerable:true});
      assert.throws(() => parseValue(value), /prototype key/i, `${key} in ${location}`);
    }
  }
  assert.equal({}.polluted, undefined);
  const inherited = Object.create({nameLine1:'Hidden'});
  assert.throws(() => codec.serialize({draft:inherited}), /plain JSON object/i);
});

test('draft arrays, unsafe primitives, dimensions, URLs, colors, and icon refs are rejected before normalization', () => {
  for (const bad of [[], null, 'Avery']) assert.throws(() => parseValue(envelope({draft:bad})), /Draft/i);
  for (const [key,value] of [
    ['nameLine1',{}], ['title',true], ['email',22], ['width','321'], ['width',279], ['width',420.5],
    ['height',null], ['height',321], ['website','javascript:alert(1)'], ['website','https://user:secret@example.com'],
    ['imageBase','http://127.0.0.1/assets'], ['frontBackground','#fff'], ['accent','red;position:fixed'],
    ['websiteIcon','../../private'], ['phoneIcon','constructor'],
  ]) assert.throws(() => parseValue(envelope({draft:draft({[key]:value})})), /Draft/i, `${key}: ${JSON.stringify(value)}`);
  assert.throws(() => codec.serialize({draft:draft({width:NaN})}), /width.*number/i);
});

test('theme library structure, names, IDs, colors, and count are strict', () => {
  for (const themes of [null, {}, 'colors', [null], [[]]]) assert.throws(() => parseValue(envelope({themes})), /Theme/i);
  for (const entry of [theme('', 'Empty ID'), theme('preset-custom','Reserved'), theme('a'.repeat(81),'Long ID'),
    theme('bad/id','Unsafe'), theme('theme-x',''), theme('theme-x','A'.repeat(41)), theme('theme-x','Original'),
    theme('theme-x','MIDNIGHT'), theme('theme-x',' Spruce '), theme('theme-x','Line\nBreak'), {...theme(),accent:'#abc'}]) {
    assert.throws(() => parseValue(envelope({themes:[entry]})), /Theme/i);
  }
  assert.throws(() => parseValue(envelope({themes:[theme(),theme('theme-2','OCÉAN')]})), /names.*distinct/i);
  assert.throws(() => parseValue(envelope({themes:[theme(),theme('theme-1','Different')]})), /IDs.*distinct/i);
  const thousand = Array.from({length:1000}, (_,i) => theme(`theme-${i}`,`Theme ${i}`));
  assert.equal(parseValue(envelope({themes:thousand})).themes.length, 1000);
  assert.throws(() => parseValue(envelope({themes:[...thousand,theme('overflow','Overflow')]})), /1,000/);
});

test('UI accepts only supported enums and selected themes present in this session', () => {
  for (const ui of [null, [], 'details']) assert.throws(() => parseValue(envelope({ui})), /UI settings/i);
  for (const [key,value] of [['editorTab','admin'], ['previewView','print'], ['imageScale','4'], ['imageScale',8],
    ['imageBackground','#ffffff'], ['selectedThemeId','unknown'], ['themeName','X'.repeat(41)], ['themeName',{}]]) {
    assert.throws(() => parseValue(envelope({ui:{[key]:value}})), /UI|theme/i);
  }
  for (const selectedThemeId of ['', 'preset-original', 'preset-midnight', 'preset-spruce', 'theme-1']) {
    assert.equal(parseValue(envelope({themes:[theme()],ui:{selectedThemeId}})).ui.selectedThemeId, selectedThemeId);
  }
});

test('UTF-8 size limit accepts exactly 1 MiB and rejects one byte or multibyte excess', () => {
  const value = envelope({padding:''}), small = JSON.stringify(value), room = 1024 * 1024 - Buffer.byteLength(small);
  value.padding = 'x'.repeat(room);
  const exact = JSON.stringify(value);
  assert.equal(Buffer.byteLength(exact), 1024 * 1024);
  assert.equal(codec.parse(exact).draft.nameLine1, core.defaults.nameLine1);
  assert.throws(() => codec.parse(exact + ' '), /too large.*1 MiB/i);
  value.padding = 'é'.repeat(Math.floor(room / 2) + 1);
  const unicode = JSON.stringify(value);
  assert.ok(unicode.length < 1024 * 1024);
  assert.throws(() => codec.parse(unicode), /too large/i);
});

test('merge keeps existing themes, deduplicates same name/colors, and maps selection', () => {
  const existing = [theme('existing')], incoming = [theme('incoming','OCÉAN')];
  const before = structuredClone({existing,incoming});
  const result = codec.mergeThemes(existing, incoming, 'incoming');
  assert.equal(result.added, 0);
  assert.equal(result.selectedThemeId, 'existing');
  assert.deepEqual(result.themes, existing);
  assert.deepEqual({existing,incoming}, before);
  result.themes[0].name = 'Changed';
  assert.equal(existing[0].name, 'Océan');
});

test('conflicting names or IDs receive unique imported names and IDs; reimport adds nothing', () => {
  const existing = [theme('same-id','Océan'), theme('theme-import-1','Already used')];
  const incoming = [theme('other-id','Océan','#000000'), theme('same-id','Different','#123456')];
  const merged = codec.mergeThemes(existing, incoming, 'other-id');
  assert.equal(merged.added, 2);
  assert.deepEqual(merged.themes.slice(0,2), existing);
  assert.equal(merged.themes[2].id, 'theme-import-2');
  assert.equal(merged.themes[2].name, 'Océan (imported)');
  assert.equal(merged.themes[3].name, 'Different (imported)');
  assert.equal(merged.selectedThemeId, merged.themes[2].id);
  const repeated = codec.mergeThemes(merged.themes, incoming, 'same-id');
  assert.equal(repeated.added, 0);
  assert.deepEqual(repeated.themes, merged.themes);
  assert.equal(repeated.selectedThemeId, merged.themes[3].id);
});

test('import suffixes remain distinct and fit the 40-character limit', () => {
  const name = 'A'.repeat(40), incoming = [theme('new',name,'#000000')];
  const existing = [theme('base',name),theme('conflict','A'.repeat(29) + ' (imported)')];
  const result = codec.mergeThemes(existing,incoming,'new');
  assert.equal(result.themes.at(-1).name, 'A'.repeat(27) + ' (imported 2)');
  assert.equal(result.themes.at(-1).name.length, 40);
  assert.equal(codec.mergeThemes(result.themes,incoming,'new').added, 0);
});

test('distinct long names sharing an import prefix survive one batch and repeat imports', () => {
  const nameA = 'A'.repeat(40), nameB = 'A'.repeat(29) + 'B'.repeat(11);
  const existing = [theme('existing-a',nameA,'#111111')];
  const incoming = [theme('new-a',nameA,'#222222'),theme('new-b',nameB,'#222222')];
  const first = codec.mergeThemes(existing,incoming,'new-b');
  assert.equal(first.added, 2);
  assert.equal(first.themes.length, 3);
  assert.equal(first.themes[1].name, 'A'.repeat(29) + ' (imported)');
  assert.equal(first.themes[2].name, nameB);
  assert.equal(first.selectedThemeId, first.themes[2].id);
  for (const order of [incoming,[...incoming].reverse()]) {
    for (const [selected,target] of [['new-a',first.themes[1].id],['new-b',first.themes[2].id]]) {
      const again = codec.mergeThemes(first.themes,order,selected);
      assert.equal(again.added, 0);
      assert.deepEqual(again.themes, first.themes);
      assert.equal(again.selectedThemeId, target);
    }
  }
});

test('two conflicting long names never reuse one existing truncated alias', () => {
  const nameA = 'A'.repeat(40), nameB = 'A'.repeat(29) + 'B'.repeat(11);
  const existing = [theme('existing-a',nameA,'#111111'),theme('existing-b',nameB,'#111111')];
  const incoming = [theme('new-a',nameA,'#222222'),theme('new-b',nameB,'#222222')];
  const first = codec.mergeThemes(existing,incoming,'new-b');
  assert.equal(first.added, 2);
  assert.equal(new Set(first.themes.map(entry => entry.name)).size, 4);
  assert.equal(first.themes[2].importedFromName, nameA);
  assert.equal(first.themes[3].importedFromName, nameB);
  for (const order of [incoming,[...incoming].reverse()]) {
    for (const [selected,target] of [['new-a',first.themes[2].id],['new-b',first.themes[3].id]]) {
      const again = codec.mergeThemes(first.themes,order,selected);
      assert.equal(again.added, 0);
      assert.deepEqual(again.themes, first.themes);
      assert.equal(again.selectedThemeId, target);
    }
  }
});

test('separate imports of distinct long names cannot share a truncated identity', () => {
  const nameA = 'A'.repeat(40), nameB = 'A'.repeat(29) + 'B'.repeat(11);
  const existing = [theme('original',nameA,'#111111')];
  const incomingA = [theme('new-a',nameA,'#222222')], incomingB = [theme('new-b',nameB,'#222222')];
  const first = codec.mergeThemes(existing,incomingA,'new-a');
  const second = codec.mergeThemes(first.themes,incomingB,'new-b');
  assert.equal(second.added, 1);
  assert.equal(second.themes.length, 3);
  assert.equal(second.themes[2].name, nameB);
  assert.equal(second.selectedThemeId, second.themes[2].id);
  assert.equal(codec.mergeThemes(second.themes,incomingA,'new-a').selectedThemeId, first.selectedThemeId);
  assert.equal(codec.mergeThemes(second.themes,incomingB,'new-b').selectedThemeId, second.selectedThemeId);
});

test('session files preserve original import identity and reject malformed provenance', () => {
  const incoming = [theme('new','A'.repeat(40),'#222222')];
  const merged = codec.mergeThemes([theme('original','A'.repeat(40),'#111111')],incoming,'new');
  const restored = codec.parse(codec.serialize({draft:draft(),themes:merged.themes,ui:{selectedThemeId:merged.selectedThemeId}}));
  assert.deepEqual(restored.themes, merged.themes);
  assert.equal(restored.themes[1].importedFromName, incoming[0].name);
  const repeated = codec.mergeThemes(restored.themes,incoming,'new');
  assert.equal(repeated.added, 0);
  assert.equal(repeated.selectedThemeId, merged.selectedThemeId);
  for (const importedFromName of ['', ' ', 'A'.repeat(41), 'Line\nBreak', 1, {}, [], null]) {
    assert.throws(() => parseValue(envelope({themes:[{...theme(),importedFromName}]})), /imported theme name/i);
  }
});

test('legacy truncated aliases without provenance cannot swallow another name', () => {
  const existing = [theme('old-alias','A'.repeat(29) + ' (imported)','#222222')];
  const incoming = [theme('new','A'.repeat(29) + 'B'.repeat(11),'#222222')];
  const merged = codec.mergeThemes(existing,incoming,'new');
  assert.equal(merged.added, 1);
  assert.equal(merged.themes.length, 2);
  assert.equal(merged.selectedThemeId, 'new');
});

test('matching displayed aliases from separate session exports keep different original identities', () => {
  const displayName = 'A'.repeat(29) + ' (imported)';
  const originalA = 'A'.repeat(40), originalB = 'A'.repeat(29) + 'B'.repeat(11);
  const exportedA = codec.serialize({draft:draft(),themes:[{...theme('session-a',displayName,'#222222'),importedFromName:originalA}]});
  const exportedB = codec.serialize({draft:draft(),themes:[{...theme('session-b',displayName,'#222222'),importedFromName:originalB}]});
  const libraryA = codec.parse(exportedA).themes, libraryB = codec.parse(exportedB).themes;
  for (const [existing,incoming] of [[libraryA,libraryB],[libraryB,libraryA]]) {
    const merged = codec.mergeThemes(existing,incoming,incoming[0].id);
    assert.equal(merged.added, 1);
    assert.equal(merged.themes.length, 2);
    assert.equal(merged.themes[0].importedFromName, existing[0].importedFromName);
    assert.equal(merged.themes[1].importedFromName, incoming[0].importedFromName);
    assert.equal(merged.selectedThemeId, merged.themes[1].id);
    assert.notEqual(merged.selectedThemeId, existing[0].id);
    const repeated = codec.mergeThemes(merged.themes,incoming,incoming[0].id);
    assert.equal(repeated.added, 0);
    assert.equal(repeated.selectedThemeId, merged.selectedThemeId);
  }
});

test('theme identity uses the full source name in every display/provenance permutation', () => {
  const cases = [
    {leftName:'Ocean', rightName:'OCEAN', expectedAdded:0},
    {leftName:'Ocean', rightName:'Ocean (imported)', rightSource:'Ocean', expectedAdded:0},
    {leftName:'Ocean (imported)', leftSource:'Ocean', rightName:'Ocean', expectedAdded:0},
    {leftName:'First alias', leftSource:'Ocean', rightName:'Second alias', rightSource:'OCEAN', expectedAdded:0},
    {leftName:'Shared alias', leftSource:'Ocean', rightName:'Shared alias', rightSource:'Forest', expectedAdded:1},
    {leftName:'Shared alias', leftSource:'Ocean', rightName:'Shared alias', expectedAdded:1},
    {leftName:'Shared alias', rightName:'Shared alias', rightSource:'Ocean', expectedAdded:1},
  ];
  for (const {leftName,leftSource,rightName,rightSource,expectedAdded} of cases) {
    const left = {...theme('left',leftName),...(leftSource ? {importedFromName:leftSource} : {})};
    const right = {...theme('right',rightName),...(rightSource ? {importedFromName:rightSource} : {})};
    const merged = codec.mergeThemes([left],[right],'right');
    assert.equal(merged.added, expectedAdded, JSON.stringify({left,right}));
    assert.equal(merged.selectedThemeId, expectedAdded ? merged.themes[1].id : 'left');
    assert.equal(codec.mergeThemes(merged.themes,[right],'right').selectedThemeId, merged.selectedThemeId);
  }
});

test('merge validates input libraries, preserves preset selection, and enforces post-merge cap', () => {
  assert.equal(codec.mergeThemes([],[], 'preset-spruce').selectedThemeId, 'preset-spruce');
  assert.equal(codec.mergeThemes([],[]).selectedThemeId, '');
  assert.throws(() => codec.mergeThemes([],[], 'missing'), /selected theme/i);
  assert.throws(() => codec.mergeThemes([theme(),theme()],[]), /distinct/i);
  const full = Array.from({length:1000},(_,i)=>theme(`theme-${i}`,`Theme ${i}`));
  assert.equal(codec.mergeThemes(full,[theme('same','Theme 0')]).added, 0);
  assert.throws(() => codec.mergeThemes(full,[theme('new','New')]), /exceed.*1,000/i);
  assert.equal(full.length, 1000);
});
