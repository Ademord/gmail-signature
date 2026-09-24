// AI proposals for the compact text and spacing controls. Field names, ranges
// and defaults are fixed here from the compact editor contract (v1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ai from '../ai-extension-core.js';
import core from '../signature-core.js';
import session from '../session-data.js';
import history from '../editor-history.js';

const photo = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png', import.meta.url)).toString('base64');
const draft = overrides => ({...core.defaults, ...overrides});
const envelope = (section, changes) => JSON.stringify({format:'signature-ai', version:1, section, name:'Compact variation', changes});
const parse = (section, changes, options = {}) => ai.parseResponse(envelope(section, changes), {section, draft:core.defaults, ...options});
const formatDefaults = {nameLayout:'template', nameFontSize:0, titleFontSize:0, subtitleFontSize:0, contactFontSize:0, footerFontSize:0,
  lineSpacing:100, textSpacing:100, contactSpacing:100, sectionSpacing:100, contentPadding:-1,
  singleArrangement:'auto', contactLayout:'template', contactFont:'template', footerVisible:'show',
  contactSeparator:'none', websiteVisible:'show', emailVisible:'show', phoneVisible:'show', linkedinVisible:'show', locationVisible:'show'};
const formatKeys = Object.keys(formatDefaults);
const visibilityKeys = ['websiteVisible','emailVisible','phoneVisible','linkedinVisible','locationVisible'];
const formatValid = {nameLayout:['template','single','wrap'], nameFontSize:[0,12,22,40], titleFontSize:[0,8,11,24], subtitleFontSize:[0,8,11,24],
  contactFontSize:[0,8,12,24], footerFontSize:[0,8,10,24], lineSpacing:[80,100,200], textSpacing:[0,65,200], contactSpacing:[0,100,200],
  sectionSpacing:[0,70,200], contentPadding:[-1,0,16,48], singleArrangement:['auto','rows','columns'], contactLayout:['template','stacked','inline'],
  contactFont:['template','sans','mono'], footerVisible:['show','hide'], contactSeparator:['none','bar','dot','slash','dash'],
  ...Object.fromEntries(visibilityKeys.map(key => [key, ['show','hide']]))};
const smallSize = [1,7,-1,25,11.5,'11',null,false,[],{}];
const visibilityInvalid = ['','Hide','SHOW','hidden','visible',true,false,0,1,null,[],{}];
const formatInvalid = {nameLayout:['','Single','auto','inline',0,true,null,[],{}], nameFontSize:[1,11,-1,41,22.5,'22',null,true,[],{}],
  titleFontSize:smallSize, subtitleFontSize:smallSize, contactFontSize:smallSize, footerFontSize:smallSize,
  lineSpacing:[0,79,201,100.5,'100',null,true,[],{}], textSpacing:[-1,201,65.5,'65',null,true,[],{}], contactSpacing:[-1,201,99.5,'100',null,false,[],{}],
  sectionSpacing:[-1,201,70.5,'70',null,true,[],{}], contentPadding:[-2,49,16.5,'16','-1',null,true,[],{}],
  singleArrangement:['','Rows','template','stacked',1,false,null,[],{}], contactLayout:['','Inline','auto','rows',0,true,null,[],{}],
  contactFont:['','Sans','serif','Arial',0,null,[],{}], footerVisible:['','Hide','hidden',true,false,0,null,[],{}],
  contactSeparator:['','None','Bar','|','·','/','–','comma',0,true,null,[],{}], ...Object.fromEntries(visibilityKeys.map(key => [key, visibilityInvalid]))};
// Every field differs from its default, so each one alone makes a preview stale.
const compactAll = {nameLayout:'single', nameFontSize:22, titleFontSize:11, subtitleFontSize:11, contactFontSize:12, footerFontSize:10,
  lineSpacing:110, textSpacing:65, contactSpacing:90, sectionSpacing:70, contentPadding:16,
  singleArrangement:'rows', contactLayout:'inline', contactFont:'sans', footerVisible:'hide',
  contactSeparator:'dot', websiteVisible:'hide', emailVisible:'hide', phoneVisible:'hide', linkedinVisible:'hide', locationVisible:'hide'};
const identityKeys = ['nameLine1','nameLine2','title','subtitle','website','websiteLabel','email','phone','linkedin','location','tags','portraitData','portraitUrl','imageBase'];
const privateDraft = draft({nameLine1:'SecretFirst', nameLine2:'SecretLast', title:'PRIVATE_ROLE_512', subtitle:'PRIVATE_SUB_512', tags:'PRIVATE_TAGS_512',
  website:'https://private-site-512.example.com/', websiteLabel:'PRIVATE_LABEL_512', email:'secret512@example.com', phone:'+41 55 512 51 25',
  linkedin:'https://www.linkedin.com/in/private512', location:'PRIVATE_CITY_512', portraitData:photo, portraitUrl:'https://example.com/private-photo-512.png',
  imageBase:'https://example.com/private-assets-512', width:420, height:320});

test('only Layout and Design scopes include every text and spacing field; Details stays information only', () => {
  assert.deepEqual(Object.keys(ai.sections), ['design','artwork','layout','colors','details','icons','photo']);
  for (const section of ['layout','design']) for (const key of formatKeys) assert.ok(ai.sectionKeys[section].includes(key), section + ' ' + key);
  for (const section of ['artwork','colors','details','icons','photo']) for (const key of formatKeys) {
    assert.ok(!ai.sectionKeys[section].includes(key), section + ' ' + key);
    assert.throws(() => parse(section, {[key]:formatValid[key][1]}), new RegExp('Unsupported changes field: ' + key), section + ' ' + key);
  }
  for (const key of formatKeys) assert.throws(() => parse('details', {[key]:formatValid[key][1]}, {includeDetails:true}), /Unsupported changes field/);
});

test('each valid text and spacing value previews, keeps identity and photo, and applies as exactly one patch', () => {
  const current = draft({cardFormat:'single', width:420, height:320, email:'sam@example.com', portraitData:photo, portraitUrl:'https://example.com/profile.png'});
  for (const section of ['layout','design']) for (const [key, values] of Object.entries(formatValid)) for (const value of values) {
    const label = section + ' ' + key + '=' + value, before = JSON.stringify(current);
    const proposal = ai.createProposal(envelope(section, {[key]:value}), {section, draft:current});
    assert.ok(Object.is(proposal.candidate[key], value), label);
    for (const identity of identityKeys) assert.equal(proposal.candidate[identity], current[identity], label + ' keeps ' + identity);
    assert.deepEqual(ai.applyProposal(proposal, current), {[key]:value}, label);
    assert.equal(JSON.stringify(current), before, label + ' has no side effect');
  }
});

test('malformed text and spacing values are rejected without coercion, clamping or enum fallback', () => {
  for (const section of ['layout','design']) for (const [key, values] of Object.entries(formatInvalid)) for (const value of values) {
    assert.throws(() => parse(section, {[key]:value}), new RegExp(key), section + ' ' + key + '=' + JSON.stringify(value));
  }
  assert.throws(() => parse('layout', {nameFontSize:11}), /nameFontSize must be 0 \(template size\) or a whole number from 12 to 40/);
  for (const key of ['titleFontSize','subtitleFontSize','contactFontSize','footerFontSize']) assert.throws(() => parse('layout', {[key]:7}), new RegExp(key + ' must be 0 \\(template size\\) or a whole number from 8 to 24'));
  assert.throws(() => parse('layout', {lineSpacing:79}), /lineSpacing must be a whole number from 80 to 200/);
  for (const key of ['textSpacing','contactSpacing','sectionSpacing']) assert.throws(() => parse('layout', {[key]:201}), new RegExp(key + ' must be a whole number from 0 to 200'));
  assert.throws(() => parse('layout', {contentPadding:49}), /contentPadding must be a whole number from -1 \(template padding\) to 48/);
  for (const key of ['nameLayout','singleArrangement','contactLayout','contactFont','footerVisible','contactSeparator',...visibilityKeys]) assert.throws(() => parse('layout', {[key]:'unknown'}), new RegExp('available value for ' + key));
  for (const key of ['contactSeparator',...visibilityKeys]) assert.throws(() => parse('design', {[key]:false}), new RegExp(key + ' must be text'));
});

test('hiding contacts through AI keeps their details, and Details wording cannot hide or reveal them', () => {
  const current = draft({website:'https://example.com/work', websiteLabel:'Selected work', email:'sam@example.com', phone:'+41 22 123 45 67',
    contactLayout:'inline', portraitData:photo, portraitUrl:'https://example.com/profile.png'});
  const changes = {contactSeparator:'slash', websiteVisible:'hide', phoneVisible:'hide'};
  for (const section of ['layout','design']) {
    const proposal = ai.createProposal(envelope(section, changes), {section, draft:current});
    for (const key of ['website','websiteLabel','websiteIcon','email','phone','phoneIcon','portraitData']) assert.equal(proposal.candidate[key], current[key], section + ' keeps ' + key);
    assert.deepEqual(ai.applyProposal(proposal, current), changes);
    const hidden = {...current, ...changes}, again = ai.createProposal(envelope(section, {websiteVisible:'show'}), {section, draft:hidden});
    assert.equal(again.candidate.website, current.website); assert.equal(again.candidate.websiteVisible, 'show');
    const prompt = ai.buildPrompt(section, hidden);
    assert.doesNotMatch(prompt, /example\.com\/work|Selected work|sam@example|123 45 67|base64/);
    for (const needed of ['none|bar|dot|slash|dash','only between visible contacts','stored text, label, icon and link stay unchanged']) assert.ok(prompt.includes(needed), section + ': ' + needed);
  }
  for (const includeDetails of [false,true]) for (const key of ['contactSeparator',...visibilityKeys]) {
    assert.throws(() => parse('details', {[key]:formatValid[key][1]}, {includeDetails}), new RegExp('Unsupported changes field: ' + key));
  }
});

test('Layout and Design prompts document the controls, their template values and current settings without private data', () => {
  const current = draft({...privateDraft, ...compactAll});
  for (const section of ['layout','design']) {
    const prompt = ai.buildPrompt(section, current, {brief:'Make it compact'});
    const settings = JSON.parse(prompt.match(/^Current settings: (\{.*\})\.$/m)[1]);
    for (const key of formatKeys) {
      assert.match(prompt, new RegExp('Allowed changes: [^\\n]*\\b' + key + '\\b'), section + ' allows ' + key);
      assert.equal(settings[key], compactAll[key], section + ' shows current ' + key);
    }
    for (const needed of ['template|single|wrap','12–40 pixels','8–24 pixels','80–200 percent','0–200 percent','-1 (template padding)','0–48 pixels',
      'auto|rows|columns','template|stacked|inline','template|sans|mono','show|hide','never zero pixels','keeping the tags text stored']) assert.ok(prompt.includes(needed), section + ': ' + needed);
    for (const key of identityKeys) assert.ok(!prompt.includes(current[key]), section + ' leaks ' + key);
    assert.doesNotMatch(prompt, /SecretFirst|PRIVATE_|secret512|private-photo|private-assets|base64/);
    const defaults = JSON.parse(ai.buildPrompt(section, core.defaults).match(/^Current settings: (\{.*\})\.$/m)[1]);
    for (const key of formatKeys) assert.equal(defaults[key], formatDefaults[key], section + ' shows template ' + key);
  }
  for (const section of ['artwork','colors','details','icons','photo']) assert.doesNotMatch(ai.buildPrompt(section, current), /nameFontSize|contactLayout|footerVisible|contactSeparator|websiteVisible/, section);
});

test('the compact starting point suggested in the prompt is a valid proposal that keeps identity and photo', () => {
  for (const section of ['layout','design']) {
    const match = ai.buildPrompt(section, core.defaults).match(/A compact starting point[^:]*: (\{[^\n]*?\})\. Content/);
    assert.ok(match, section + ' prompt includes the compact example');
    const changes = JSON.parse(match[1]);
    for (const [key, value] of Object.entries({nameLayout:'single', contactLayout:'inline', footerVisible:'hide', cardFormat:'single'})) assert.equal(changes[key], value, key);
    const current = draft({nameLine1:'Sam', portraitData:photo, portraitUrl:'https://example.com/sam.png'});
    const proposal = ai.createProposal(envelope(section, changes), {section, draft:current});
    assert.equal(proposal.candidate.portraitData, photo); assert.equal(proposal.candidate.nameLine1, 'Sam'); assert.equal(proposal.candidate.tags, current.tags);
    assert.deepEqual(ai.applyProposal(proposal, current), changes);
  }
});

test('older drafts preview with template defaults and text or spacing edits make previews stale', () => {
  const legacy = draft(); for (const key of formatKeys) delete legacy[key];
  const before = structuredClone(legacy);
  const proposal = ai.createProposal(envelope('colors', {accent:'#123456'}), {section:'colors', draft:legacy});
  assert.deepEqual(Object.fromEntries(formatKeys.map(key => [key, proposal.candidate[key]])), formatDefaults);
  assert.equal(core.render(proposal.candidate), core.render({...legacy, accent:'#123456'}));
  assert.deepEqual(ai.applyProposal(proposal, {...legacy, ...formatDefaults}), {accent:'#123456'});
  for (const [key, value] of Object.entries(compactAll)) assert.throws(() => ai.applyProposal(proposal, {...legacy, [key]:value}), /changed since this preview/, key);
  assert.deepEqual(legacy, before);
});

test('an applied compact proposal survives undo, redo, session export and Design-only import', () => {
  const before = draft({...privateDraft, cardFormat:'single', layout:'paired', width:400, height:180});
  const proposal = ai.createProposal(envelope('layout', compactAll), {section:'layout', draft:before});
  const after = {...before, ...ai.applyProposal(proposal, before)};
  assert.deepEqual(after, proposal.candidate);
  const changes = history.create(); changes.record(before, after);
  assert.deepEqual(changes.undo(after), before); assert.deepEqual(changes.redo(before), after);
  const restored = session.parse(session.serialize({draft:after})).draft;
  assert.deepEqual(restored, after);
  assert.equal(core.render(restored), core.render(after));
  const other = draft({nameLine1:'Other'});
  const imported = session.selectParts({draft:restored, themes:[]}, {draft:other, themes:[]}, {information:false, design:true}).draft;
  for (const key of formatKeys) assert.equal(imported[key], compactAll[key], key);
  assert.equal(imported.nameLine1, 'Other'); assert.equal(imported.portraitData, '');
});
