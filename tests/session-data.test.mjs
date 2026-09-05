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

test('browser global and CommonJS API operate without DOM or storage', () => {
  const window = {SignatureCore:core};
  vm.runInNewContext(readFileSync(new URL('../session-data.js', import.meta.url), 'utf8'), {window, TextEncoder, URL});
  assert.equal(typeof window.SignatureSession.serialize, 'function');
  assert.equal(typeof window.SignatureSession.mergeThemes, 'function');
  const result = window.SignatureSession.parse(window.SignatureSession.serialize({draft:draft()}));
  assert.equal(result.draft.nameLine1, core.defaults.nameLine1);
});

test('Unicode drafts, saved themes, and UI round-trip through pretty versioned JSON', () => {
  const input = {draft:draft({nameLine1:'Zoë', nameLine2:'Mörgán'}), themes:[theme()], ui:{editorTab:'colors', previewView:'email', imageScale:6, imageBackground:'white', selectedThemeId:'theme-1', themeName:'Crème 東京'}};
  const text = codec.serialize(input), raw = JSON.parse(text);
  assert.match(text, /\n  "format":/);
  assert.equal(raw.format, 'signature-editor-session');
  assert.equal(raw.version, 1);
  assert.equal(new Date(raw.exportedAt).toISOString(), raw.exportedAt);
  assert.deepEqual(codec.parse(text), input);
});

test('bare legacy drafts gain missing core fields and default UI without importing themes', () => {
  const result = parseValue({nameLine1:'Avery', title:'Engineer'});
  assert.equal(result.draft.title, 'Engineer');
  assert.equal(result.draft.frontBackground, core.defaults.frontBackground);
  assert.equal(result.draft.websiteIcon, core.defaults.websiteIcon);
  assert.deepEqual(result.themes, []);
  assert.deepEqual(result.ui, {editorTab:'details', previewView:'card', imageScale:4, imageBackground:'transparent', selectedThemeId:'', themeName:''});
  assert.equal(codec.parse('\uFEFF' + JSON.stringify(draft())).draft.nameLine1, core.defaults.nameLine1);
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
