// Readable AI change summaries. The module loads without a DOM; the dialog
// itself is exercised in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ai from '../ai-extension-core.js';
import core from '../signature-core.js';

const window = {SignatureCore:core, SignatureAI:ai};
vm.runInNewContext(readFileSync(new URL('../ai-extension-controls.js', import.meta.url), 'utf8'), {window});
const controls = window.SignatureAIControls;
const formatChoices = {nameLayout:['template','single','wrap'], singleArrangement:['auto','rows','columns'],
  contactLayout:['template','stacked','inline'], contactFont:['template','sans','mono'], footerVisible:['show','hide'],
  contactSeparator:['none','bar','dot','slash','dash'], websiteVisible:['show','hide'], emailVisible:['show','hide'],
  phoneVisible:['show','hide'], linkedinVisible:['show','hide'], locationVisible:['show','hide']};
const sizeKeys = ['nameFontSize','titleFontSize','subtitleFontSize','contactFontSize','footerFontSize'];
const spacingKeys = ['lineSpacing','textSpacing','contactSpacing','sectionSpacing'];

test('every field an AI response may change has a distinct readable label', () => {
  assert.equal(typeof controls.attach, 'function');
  const keys = [...new Set(Object.values(ai.sectionKeys).flat())];
  for (const key of [...Object.keys(formatChoices), ...sizeKeys, ...spacingKeys, 'contentPadding']) assert.ok(keys.includes(key), key + ' is proposable');
  for (const key of keys) assert.match(controls.fieldLabels[key] || '', /^[A-Z][^<>]{2,}$/, key);
  const labels = keys.map(key => controls.fieldLabels[key]);
  assert.equal(new Set(labels).size, labels.length, 'labels are distinct');
  assert.ok(Object.isFrozen(controls.fieldLabels));
});

test('template values are described as template choices, never as 0 px or -1 px', () => {
  for (const key of sizeKeys) {
    assert.equal(controls.describeChange(key, 0), 'Template size', key);
    assert.equal(controls.describeChange(key, 12), '12 px', key);
  }
  assert.equal(controls.describeChange('contentPadding', -1), 'Template padding');
  assert.equal(controls.describeChange('contentPadding', 0), '0 px');
  assert.equal(controls.describeChange('contentPadding', 16), '16 px');
  for (const key of spacingKeys) assert.equal(controls.describeChange(key, 65), '65%', key);
  for (const [key, values] of Object.entries(formatChoices)) {
    const described = values.map(value => controls.describeChange(key, value));
    assert.equal(new Set(described).size, values.length, key + ' choices are distinguishable');
    for (const [index, text] of described.entries()) assert.notEqual(text, values[index], key + ' ' + values[index] + ' is described in words');
  }
  assert.match(controls.describeChange('footerVisible', 'hide'), /tags kept/i);
  for (const [value, mark] of [['bar','|'],['dot','·'],['slash','/'],['dash','–']]) assert.ok(controls.describeChange('contactSeparator', value).includes(mark), value);
  for (const key of ['websiteVisible','emailVisible','phoneVisible','linkedinVisible','locationVisible']) {
    assert.match(controls.describeChange(key, 'hide'), /hidden.*kept/i, key);
    assert.match(controls.fieldLabels[key], /visibility$/, key);
  }
  assert.equal(controls.describeChange('cardFormat', 'single'), 'Single card');
  assert.equal(controls.describeChange('width', 360), '360 px');
});
