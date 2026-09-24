// Selective session import for the text, spacing and contact presentation controls. The
// expected field groups are fixed here, independently of session-data.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import core from '../signature-core.js';
import codec from '../session-data.js';

const photo = name => 'data:image/png;base64,' + readFileSync(new URL('../sig/' + name, import.meta.url)).toString('base64');
const formatDefaults = {nameLayout:'template', nameFontSize:0, titleFontSize:0, subtitleFontSize:0, contactFontSize:0, footerFontSize:0,
  lineSpacing:100, textSpacing:100, contactSpacing:100, sectionSpacing:100, contentPadding:-1,
  singleArrangement:'auto', contactLayout:'template', contactFont:'template', footerVisible:'show',
  contactSeparator:'none', websiteVisible:'show', emailVisible:'show', phoneVisible:'show', linkedinVisible:'show', locationVisible:'show'};
const formatKeys = Object.keys(formatDefaults);
const information = ['nameLine1','nameLine2','title','subtitle','website','websiteLabel','email','phone','linkedin','location','tags','portraitData','portraitUrl'];
const session = draft => ({draft:{...core.defaults, ...draft}, themes:[], ui:{editorTab:'details'}});
// The fixtures differ on every text, spacing and contact presentation field, and
// each field leaves its template default in at least one of them (two-value
// show/hide fields are hidden in one fixture and shown in the other).
const currentFormat = {nameLayout:'wrap', nameFontSize:30, titleFontSize:14, subtitleFontSize:9, contactFontSize:10, footerFontSize:12,
  lineSpacing:140, textSpacing:150, contactSpacing:40, sectionSpacing:120, contentPadding:24,
  singleArrangement:'columns', contactLayout:'stacked', contactFont:'mono', footerVisible:'show',
  contactSeparator:'bar', websiteVisible:'hide', emailVisible:'show', phoneVisible:'hide', linkedinVisible:'show', locationVisible:'show'};
const incomingFormat = {nameLayout:'single', nameFontSize:22, titleFontSize:11, subtitleFontSize:11, contactFontSize:12, footerFontSize:10,
  lineSpacing:110, textSpacing:65, contactSpacing:90, sectionSpacing:70, contentPadding:16,
  singleArrangement:'rows', contactLayout:'inline', contactFont:'sans', footerVisible:'hide',
  contactSeparator:'dot', websiteVisible:'show', emailVisible:'hide', phoneVisible:'show', linkedinVisible:'hide', locationVisible:'hide'};
const current = session({nameLine1:'Casey', nameLine2:'Rivera', title:'Illustrator', tags:'DRAW · PAINT', portraitData:photo('icon-web.png'),
  portraitUrl:'https://example.com/casey.png', cardFormat:'single', layout:'paired', width:420, height:320, ...currentFormat});
const incoming = session({nameLine1:'Jordan', nameLine2:'Lee', title:'Engineer', tags:'BUILD · SHIP', portraitData:photo('icon-pin.png'),
  portraitUrl:'https://example.org/jordan.png', cardFormat:'single', layout:'paired', width:400, height:180, ...incomingFormat});

test('the Information and Design groups partition every field and give all text and spacing controls to Design', () => {
  assert.deepEqual([...codec.informationFields].sort(), [...information].sort());
  for (const key of formatKeys) assert.ok(codec.designFields.includes(key), key);
  const all = [...codec.informationFields, ...codec.designFields];
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual([...all].sort(), Object.keys(core.defaults).sort());
});

test('each text, spacing and contact presentation field follows Design on full and design imports and never on information-only imports', () => {
  for (const key of formatKeys) {
    assert.ok(incomingFormat[key] !== formatDefaults[key] || currentFormat[key] !== formatDefaults[key], 'fixtures exercise ' + key);
    assert.notEqual(incomingFormat[key], currentFormat[key], 'fixtures differ on ' + key);
  }
  const before = structuredClone({current, incoming});
  for (const selection of [{information:true,design:false},{information:false,design:true},{information:true,design:true}]) {
    const result = codec.selectParts(incoming, current, selection), label = JSON.stringify(selection);
    for (const key of formatKeys) assert.equal(result.draft[key], (selection.design ? incoming : current).draft[key], label + ' ' + key);
    for (const key of information) assert.equal(result.draft[key], (selection.information ? incoming : current).draft[key], label + ' ' + key);
    const expected = {...core.normalize(current.draft)};
    for (const key of selection.information ? information : []) expected[key] = incoming.draft[key];
    for (const key of selection.design ? codec.designFields : []) expected[key] = incoming.draft[key];
    assert.deepEqual(result.draft, expected, label + ' changes no other field');
    assert.deepEqual(codec.parse(codec.serialize(result)), result, label + ' round-trips');
  }
  assert.deepEqual({current, incoming}, before);
});

test('older incoming sessions reset text and spacing to the template only when Design is chosen', () => {
  const legacy = session({nameLine1:'Jordan'});
  for (const key of formatKeys) delete legacy.draft[key];
  const design = codec.selectParts(legacy, current, {information:false, design:true});
  assert.deepEqual(Object.fromEntries(formatKeys.map(key => [key, design.draft[key]])), formatDefaults);
  assert.equal(design.draft.nameLine1, 'Casey');
  assert.equal(design.draft.portraitData, current.draft.portraitData);
  const info = codec.selectParts(legacy, current, {information:true, design:false});
  assert.deepEqual(Object.fromEntries(formatKeys.map(key => [key, info.draft[key]])), currentFormat);
  assert.equal(info.draft.nameLine1, 'Jordan');
});

test('malformed text and spacing values fail selective import consistently', () => {
  for (const [key, value] of [['nameFontSize',11],['titleFontSize',30],['lineSpacing',79],['contentPadding',-2],['textSpacing','65'],['contactLayout','grid'],['footerVisible',false],
    ['contactSeparator','|'],['contactSeparator','Dot'],['websiteVisible','hidden'],['phoneVisible',true],['locationVisible',null]]) {
    const bad = session({...incomingFormat, [key]:value});
    for (const selection of [{information:true,design:false},{information:false,design:true}]) {
      assert.throws(() => codec.selectParts(bad, current, selection), new RegExp(key), key + ' in the incoming file');
    }
    // An invalid current Design value survives only when Design is kept, so it is reported then.
    const broken = session({...currentFormat, [key]:value});
    assert.throws(() => codec.selectParts(incoming, broken, {information:true, design:false}), new RegExp(key));
    assert.equal(codec.selectParts(incoming, broken, {information:false, design:true}).draft[key], incomingFormat[key]);
  }
});
