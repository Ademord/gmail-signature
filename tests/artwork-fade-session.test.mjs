import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../signature-core.js';
import session from '../session-data.js';
import ai from '../ai-extension-core.js';

const defaults={artworkFade:'none',artworkFadeAngle:90,artworkFadeDirection:'normal',artworkFadeX:50,artworkFadeY:50};
const changes={artworkFade:'radial',artworkFadeAngle:245,artworkFadeDirection:'reverse',artworkFadeX:18,artworkFadeY:82};
const initial={...core.defaults,artworkPlacement:'background',artworkOpacity:60};
const envelope=(patch,section='artwork')=>JSON.stringify({format:'signature-ai',version:1,section,name:'Directional fade',changes:patch});

test('pre-fade drafts migrate without changing markup and preserve fades through session files',()=>{
  const legacy={...initial};for(const key of Object.keys(defaults))delete legacy[key];
  const migrated=session.parse(JSON.stringify(legacy)).draft;
  for(const [key,value] of Object.entries(defaults))assert.equal(migrated[key],value);
  assert.equal(core.render(migrated),core.render(legacy));
  const customPattern=JSON.stringify({palette:['#334455'],rows:['00..','00..','....','....']});
  const draft={...initial,...changes,pattern:'custom',customPattern};
  const restored=session.parse(session.serialize({draft})).draft;
  assert.deepEqual(restored,draft);assert.equal(core.render(restored),core.render(draft));
});

test('fades belong to Design imports and never overwrite identity or photo fields',()=>{
  const current=session.parse(session.serialize({draft:{...initial,nameLine1:'Current',portraitUrl:'https://example.com/current.jpg'}}));
  const incoming=session.parse(session.serialize({draft:{...initial,...changes,nameLine1:'Incoming',portraitUrl:'https://example.com/incoming.jpg'}}));
  for(const design of [false,true]) {
    const restored=session.selectParts(incoming,current,{information:!design,design});
    for(const key of Object.keys(defaults)) {
      assert.ok(session.designFields.includes(key));
      assert.equal(restored.draft[key],(design?incoming:current).draft[key]);
    }
    for(const key of ['nameLine1','portraitUrl'])assert.equal(restored.draft[key],(design?current:incoming).draft[key]);
  }
});

test('AI artwork fades validate strictly and invalidate a preview if any fade setting changes',()=>{
  const proposal=ai.createProposal(envelope(changes),{section:'artwork',draft:initial});
  assert.deepEqual(ai.applyProposal(proposal,initial),changes);
  for(const [key,value] of Object.entries(changes)) {
    assert.throws(()=>ai.applyProposal(proposal,{...initial,[key]:value}),/changed since/);
    assert.throws(()=>ai.createProposal(envelope({[key]:value},'colors'),{section:'colors',draft:initial}),/Unsupported/);
  }
  for(const [key,min,max] of [['artworkFadeAngle',0,360],['artworkFadeX',0,100],['artworkFadeY',0,100]]) {
    for(const value of [min,max])assert.equal(ai.createProposal(envelope({[key]:value}),{section:'artwork',draft:initial}).candidate[key],value);
    for(const value of [min-1,max+1,1.5,'50',true,null]) {
      assert.throws(()=>ai.createProposal(envelope({[key]:value}),{section:'artwork',draft:initial}),/whole number/);
      assert.throws(()=>session.parse(JSON.stringify({...initial,[key]:value})));
    }
  }
  for(const [key,value] of [['artworkFade','conic'],['artworkFade','LINEAR'],['artworkFadeDirection','flipped'],['artworkFadeDirection',true]]) {
    assert.throws(()=>ai.createProposal(envelope({[key]:value}),{section:'artwork',draft:initial}));
    assert.throws(()=>session.parse(JSON.stringify({...initial,[key]:value})));
  }
});

test('AI prompts describe both fade types without including personal details or photo URLs',()=>{
  const prompt=ai.buildPrompt('artwork',{...initial,...changes,nameLine1:'PrivateSentinel',portraitUrl:'https://example.com/private-photo.jpg'});
  for(const key of Object.keys(defaults))assert.ok(prompt.includes(key),key);
  assert.match(prompt,/none\|linear\|radial/);assert.match(prompt,/0–360/);assert.match(prompt,/normal\|reverse/);
  assert.doesNotMatch(prompt,/PrivateSentinel|private-photo/);
});
