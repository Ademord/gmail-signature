import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../signature-core.js';

const values = overrides => ({...core.defaults,...overrides});
const ids = core.designs.map(design => design.id);
const customLayout = JSON.stringify({composition:'prism',font:'serif',align:'center'});
// The user's labels: Bar |, Dot ·, Slash /, Dash –.
const glyphs = {bar:'|',dot:'·',slash:'/',dash:'–'};
const visibilityKeys = ['websiteVisible','emailVisible','phoneVisible','linkedinVisible','locationVisible'];
const contacts = {
  website:{href:'https://example.com/',text:'Portfolio site',icon:'icon-web',plain:'Portfolio site: https://example.com/'},
  email:{href:'mailto:hello@example.com',text:'hello@example.com',icon:'icon-mail',plain:'hello@example.com'},
  phone:{href:'tel:+41000000000',text:'+41 00 000 00 00',icon:'icon-phone',plain:'+41 00 000 00 00'},
  linkedin:{href:'https://www.linkedin.com/',text:'linkedin.com',icon:'icon-linkedin',plain:'https://www.linkedin.com/'},
  location:{text:'Zurich, Switzerland',icon:'icon-pin',plain:'Zurich, Switzerland'}
};
const attributes = source => Object.fromEntries([...source.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1],match[2]]));
const innermostTables = html => [...html.matchAll(/<table\b([^>]*)>((?:(?!<table\b)[\s\S])*?)<\/table>/g)].map(match => ({attrs:attributes(match[1]),inner:match[2]}));
// Narrow cells may break a contact at a space or inside a word, so compare
// visible text with line breaks and whitespace removed.
const compact = text => text.replace(/\s+/g,'');
const visibleText = html => compact(html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&'));
// Inline contact lines are one-row tables holding links or the location.
function inlineRows(html) {
  return innermostTables(html).filter(table => (table.inner.match(/<tr>/g) || []).length === 1 && /href="|>Zurich|>Somewhere/.test(table.inner)).map(table => ({
    width:Number(table.attrs.width),
    cells:[...table.inner.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)].map(match => {
      const attrs = attributes(match[1]),content = match[2];
      return {width:Number(attrs.width),content,kind:attrs['aria-hidden'] === 'true' ? 'separator' : /<img\b/.test(content) ? 'icon' : content === '&nbsp;' ? 'gap' : 'text'};
    })
  }));
}
function checkRow(row, glyph, label) {
  const kinds = row.cells.map(cell => cell.kind),items = kinds.filter(kind => kind === 'text').length,marks = row.cells.filter(cell => cell.kind === 'separator');
  assert.equal(row.cells.reduce((sum,cell) => sum + cell.width,0),row.width,label + ' measured cells fill the row');
  assert.equal(marks.length,glyph ? items - 1 : 0,label + ' one separator between each pair of items');
  assert.notEqual(kinds[0],'separator',label + ' no leading separator');
  assert.notEqual(kinds.at(-1),'separator',label + ' no trailing separator');
  kinds.forEach((kind,i) => {
    if (kind !== 'separator') return;
    assert.equal(kinds[i - 1],'text',label);assert.ok(['icon','text'].includes(kinds[i + 1]),label);
  });
  for (const mark of marks) {assert.equal(mark.content,glyph,label);assert.ok(!/<a\b/.test(mark.content),label + ' separator is unlinked');}
  if (glyph) assert.ok(!kinds.includes('gap'),label + ' the separator cell replaces the plain gap');
}
const firstItemWidth = row => {let width = 0;for (const cell of row.cells) {width += cell.width;if (cell.kind === 'text') return width;}return width;};

test('contact presentation defaults are frozen, separate and extend the saved fields to 67', () => {
  assert.deepEqual({...core.contactDefaults},{contactSeparator:'none',websiteVisible:'show',emailVisible:'show',phoneVisible:'show',linkedinVisible:'show',locationVisible:'show'});
  assert.ok(Object.isFrozen(core.contactDefaults));
  assert.equal(Object.keys(core.defaults).length,67);
  assert.equal(Object.keys(core.typographyDefaults).length,15);
  for (const [key,value] of Object.entries(core.contactDefaults)) {
    assert.equal(core.defaults[key],value,key);
    assert.ok(!Object.hasOwn(core.typographyDefaults,key),key + ' is not a text-size setting');
    // Compact styles the separator (contract v3); visibility is always preserved.
    if (key === 'contactSeparator') assert.equal(core.compactPreset[key],'bar','only the compact reference preset adds bars');
    else assert.ok(!Object.hasOwn(core.compactPreset,key),key + ' is preserved by the compact action');
  }
  assert.equal(core.contactDefaults.contactSeparator,'none','the saved default stays neutral');
});

test('separator and visibility values normalize and validate exact choices', () => {
  const legacy = {...core.defaults};for (const key of Object.keys(core.contactDefaults)) delete legacy[key];
  assert.deepEqual(Object.fromEntries(Object.keys(core.contactDefaults).map(key => [key,core.normalize(legacy)[key]])),{...core.contactDefaults});
  assert.equal(core.render(legacy),core.render(core.defaults),'absent fields keep the legacy markup');
  const n = core.normalize({contactSeparator:' dot ',phoneVisible:'hide'});
  assert.equal(n.contactSeparator,'dot');assert.equal(n.phoneVisible,'hide');
  for (const value of ['','Bar','|','·','pipe','__proto__','toString',1,true]) {
    const v = values({contactSeparator:value});
    assert.match(core.validate(v).contactSeparator,/None, Bar, Dot, Slash or Dash/,String(value));
    assert.throws(() => core.render(v),error => Boolean(error.errors.contactSeparator));
  }
  for (const key of visibilityKeys) for (const value of ['','HIDE','hidden','visible',0,false,'toString']) {
    assert.match(core.validate(values({[key]:value}))[key],/show or hide/,key + '=' + value);
  }
  for (const contactSeparator of ['none','bar','dot','slash','dash']) assert.equal(core.validate(values({contactSeparator})).contactSeparator,undefined);
  const draft = core.dimensions({cardFormat:'single',contactLayout:'inline',contactSeparator:'toString',phoneVisible:'bogus'});
  assert.ok(Number.isInteger(draft.width) && Number.isInteger(draft.height),'invalid drafts stay measurable');
  assert.deepEqual(draft,core.dimensions({cardFormat:'single',contactLayout:'inline'}),'unknown choices measure like none/show');
  for (const key of visibilityKeys) for (const value of ['show','hide']) assert.equal(core.validate(values({[key]:value}))[key],undefined);
});

test('hiding a contact removes it from every render path and plain text without erasing it', () => {
  for (const design of ids) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back']) for (const contactLayout of ['template','inline']) {
    const base = values({design,layout,cardFormat,contactLayout,height:260,email:'hello@example.com',websiteLabel:'Portfolio site'}),label = [design,layout,cardFormat,contactLayout].join(':');
    assert.deepEqual(core.validate(base),{},label);
    const shown = core.render(base),plain = core.plainText(base);
    for (const [key,contact] of Object.entries(contacts)) {
      const hidden = {...base,[key + 'Visible']:'hide'},errors = core.validate(hidden);
      assert.deepEqual(errors,{},label + ' hide ' + key);
      const html = core.render(hidden),text = visibleText(html),hiddenPlain = core.plainText(hidden);
      if (contact.href) assert.ok(!html.includes('href="' + contact.href + '"'),label + ' ' + key + ' link hidden');
      assert.ok(!text.includes(compact(contact.text)),label + ' ' + key + ' text hidden');
      assert.ok(!html.includes(contact.icon),label + ' ' + key + ' icon hidden');
      assert.ok(plain.includes(contact.plain) && !hiddenPlain.includes(contact.plain),label + ' ' + key + ' plain text');
      for (const [other,shownContact] of Object.entries(contacts)) if (other !== key) {
        if (shownContact.href) assert.equal(html.split('href="' + shownContact.href + '"').length - 1,1,label + ' keeps ' + other);
        assert.ok(text.includes(compact(shownContact.text)),label + ' keeps ' + other + ' text');
      }
      const stored = core.normalize(hidden);
      for (const field of [key,key + 'Icon',...(key === 'website' ? ['websiteLabel'] : [])]) assert.equal(stored[field],base[field],label + ' keeps saved ' + field);
      assert.equal(core.render({...hidden,[key + 'Visible']:'show'}),shown,label + ' showing again restores the exact markup');
    }
    const none = Object.fromEntries(visibilityKeys.map(key => [key,'hide'])),html = core.render({...base,...none});
    assert.doesNotMatch(html,/href=|icon-/,label + ' all contacts hidden');
    assert.match(html,/Avery/,label);
  }
});

test('separators never change stacked or template contact lists', () => {
  for (const design of [...ids,'custom']) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back']) for (const contactLayout of ['template','stacked']) {
    // Signal's stacked list needs more than the default 208 px canvas. Start
    // from a valid unseparated fixture so this isolates separator neutrality.
    const v = values({design,layout,cardFormat,contactLayout,height:320,customLayout:design === 'custom' ? customLayout : ''});
    assert.deepEqual(core.validate(v),{},[design,layout,cardFormat,contactLayout].join(':'));
    const html = core.render(v);
    for (const contactSeparator of Object.keys(glyphs)) assert.equal(core.render({...v,contactSeparator}),html,[design,layout,cardFormat,contactLayout,contactSeparator].join(':'));
  }
});

test('compact rows place the chosen separator only between the items of the row', () => {
  const preset = values(core.compactPreset);
  assert.equal(inlineRows(core.render({...preset,linkedinVisible:'hide'}))[0].cells.filter(cell => cell.kind === 'separator' && cell.content === '|').length,2,'the preset itself uses bars');
  for (const design of [...ids,'custom']) for (const [contactSeparator,glyph] of Object.entries(glyphs)) {
    // Reference contacts: website, phone and location visible; LinkedIn hidden but saved.
    const v = values({...core.compactPreset,design,customLayout:design === 'custom' ? customLayout : '',contactSeparator,linkedinVisible:'hide'}),label = design + ':' + contactSeparator;
    assert.deepEqual(core.validate(v),{},label);
    const html = core.render(v),rows = inlineRows(html);
    assert.equal(rows.length,1,label + ' three reference contacts share one row');
    checkRow(rows[0],glyph,label);
    assert.equal(rows[0].cells.filter(cell => cell.kind === 'separator').length,2,label);
    for (const [,anchor] of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) assert.ok(!anchor.includes(glyph),label + ' links keep only their own text');
    assert.equal(core.plainText(v),core.plainText({...v,contactSeparator:'none'}),label + ' plain text has no separators');
    assert.equal(core.dimensions(v).width,560,label);
    const oneLeft = {...v,websiteVisible:'hide',phoneVisible:'hide'},single = inlineRows(core.render(oneLeft));
    assert.equal(single.length,1);checkRow(single[0],glyph,label + ' one visible item');
    assert.equal(single[0].cells.filter(cell => cell.kind === 'separator').length,0,label + ' no orphan separator');
    // With LinkedIn shown, four items may need another row: 560 px − 2 × 24 px insets − Signal frame or Studio rail.
    const room = 512 - (design === 'signal' ? 8 : design === 'studio' ? 14 : 0),four = {...v,linkedinVisible:'show'};
    assert.deepEqual(core.validate(four),{},label + ' four contacts');
    const wrapped = inlineRows(core.render(four));
    assert.equal(wrapped.reduce((sum,row) => sum + row.cells.filter(cell => cell.kind === 'text').length,0),4,label + ' every item once');
    const joint = rows[0].cells.find(cell => cell.kind === 'separator').width;
    for (const row of wrapped) {checkRow(row,glyph,label + ' four contacts');assert.ok(row.width <= room,label + ' row fits');}
    for (let i = 1; i < wrapped.length; i++) assert.ok(wrapped[i - 1].width + joint + firstItemWidth(wrapped[i]) > room,label + ' wraps only when needed');
  }
});

test('wrapped inline rows are measured with their separators and never start or end with one', () => {
  // Single paired card, 420 px wide, template 22 px padding: 2 × 420 − 2 × 22 = 796 px for contacts.
  const room = 796;
  const dense = values({cardFormat:'single',layout:'paired',singleArrangement:'rows',width:420,contactLayout:'inline',
    websiteLabel:'Portfolio, Research, Design and Products',email:'long.email.address.for.contact@example.com',location:'Somewhere in a very long region of Switzerland'});
  for (const [contactSeparator,glyph] of Object.entries({none:'',...glyphs})) for (const hide of [[],['emailVisible'],['phoneVisible','linkedinVisible']]) {
    const v = {...dense,contactSeparator,...Object.fromEntries(hide.map(key => [key,'hide']))},label = contactSeparator + ' hide:' + hide.join(',');
    assert.deepEqual(core.validate(v),{},label);
    const html = core.render(v),rows = inlineRows(html);
    const visible = Object.keys(contacts).filter(key => !hide.includes(key + 'Visible')).length;
    assert.equal(rows.reduce((sum,row) => sum + row.cells.filter(cell => cell.kind === 'text').length,0),visible,label + ' every visible item appears once');
    if (!hide.length) assert.ok(rows.length >= 2,label + ' five long items wrap');
    for (const row of rows) {checkRow(row,glyph,label);assert.ok(row.width <= room,label + ' row fits');}
    const joint = (rows.flatMap(row => row.cells).find(cell => cell.kind === (glyph ? 'separator' : 'gap')) || {}).width;
    // Greedy packing: the first item of each later row could not have followed the previous row.
    if (joint) for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].width + joint + firstItemWidth(rows[i]) > room,label + ' row ' + i + ' wrapped only when needed');
    for (const text of ['long.email.address.for.contact@example.com</a>','Somewhere in a very long region of Switzerland</td>'])
      if (html.includes(text.split('<')[0])) assert.ok(html.includes('>' + text),label + ' items are never split across rows');
  }
  const narrow = values({cardFormat:'single',layout:'stacked',width:280,contactLayout:'inline',contactSeparator:'bar',location:'Somewhere in a very long region of Switzerland'});
  assert.deepEqual(core.validate(narrow),{});
  const rows = inlineRows(core.render(narrow));
  for (const row of rows) checkRow(row,'|','narrow');
  const own = rows.find(row => row.cells.some(cell => cell.content.includes('Somewhere in a very long region of<br>Switzerland')));
  assert.ok(own,'the over-wide location wraps inside its own cell');
  assert.equal(own.cells.filter(cell => cell.kind === 'text').length,1,'and occupies its row alone, without a separator');
});

test('every template and format keeps separators between visible inline items or reports a keyed error', () => {
  let rendered = 0;
  for (const design of [...ids,'custom']) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back'])
    for (const contactSeparator of ['none',...Object.keys(glyphs)]) for (const hide of [[],['websiteVisible','phoneVisible'],visibilityKeys]) {
      const v = values({design,layout,cardFormat,contactLayout:'inline',contactSeparator,email:'hello@example.com',customLayout:design === 'custom' ? customLayout : '',
        ...Object.fromEntries(hide.map(key => [key,'hide']))});
      const label = [design,layout,cardFormat,contactSeparator,hide.length].join(':'),errors = core.validate(v);
      if (Object.keys(errors).length) {
        for (const key of Object.keys(errors)) assert.ok(Object.hasOwn(core.defaults,key),label + ' ' + key);
        assert.throws(() => core.render(v),label);
        continue;
      }
      rendered++;
      const html = core.render(v),size = core.dimensions(v);
      assert.match(html,new RegExp('^<table[^>]+width="' + size.width + '" height="' + size.height + '"'),label);
      assert.ok(html.length < 10000,label);
      for (const row of inlineRows(html)) checkRow(row,glyphs[contactSeparator] || '',label);
      for (const key of hide) {const contact = contacts[key.replace('Visible','')];if (contact.href) assert.ok(!html.includes(contact.href),label + ' ' + key);}
    }
  assert.ok(rendered > 300,'most combinations render: ' + rendered);
});
