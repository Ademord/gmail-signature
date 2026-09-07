import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ai from '../ai-extension-core.js';
import core from '../signature-core.js';

const sections = ['design','artwork','layout','colors','details','icons','photo'];
const photo = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
const draft = overrides => ({...core.defaults,...overrides});
const envelope = (section,changes,extras={}) => JSON.stringify({format:'signature-ai',version:1,section,name:'A thoughtful variation',changes,...extras});
const parse = (section,changes,options={}) => ai.parseResponse(envelope(section,changes),{section,draft:core.defaults,...options});
const customPattern = {palette:['#B8A1EA','#F5E5A2'],rows:['....00..','....00..','........','..11....','..11....','........','......00','......00']};
const customLayout = {composition:'signal',font:'serif',align:'center'};

test('every requested section has a usable manually editable example and email-safe preview',()=>{
  assert.deepEqual(Object.keys(ai.sections),sections);
  for(const section of sections){
    const result=ai.createProposal(ai.exampleResponse(section),{section,draft:core.defaults});
    const html=core.render(result.candidate,{preview:true,assetBase:'./sig'});
    assert.ok(html.startsWith('<table'));
    assert.ok(html.length<10000);
    assert.doesNotMatch(html,/<script|<svg|<style|onerror=|javascript:|position:|display:grid/);
    assert.ok(Object.keys(ai.applyProposal(result,core.defaults)).length>0);
  }
  assert.throws(()=>ai.exampleResponse('missing'),/available AI section/);
});

test('default prompts never reveal identity, contacts, image bases, photos or hidden custom strings',()=>{
  const privateDraft=draft({nameLine1:'SecretFirstName',nameLine2:'SecretLastName',title:'PRIVATE_ROLE_837',subtitle:'PRIVATE_SUBTITLE_917',tags:'PRIVATE_TAGS_917',website:'https://private-website.example.com/',websiteLabel:'PRIVATE_SITE_LABEL',email:'secret-person@private-email.example.com',phone:'+41 98 765 43 21',linkedin:'https://www.linkedin.com/in/private-profile-837',location:'PRIVATE_LOCATION_837',portraitData:photo,portraitUrl:'https://private-photo.example.com/face.jpg',imageBase:'https://private-assets.example.com/icons',customLayout:'{"secret":"PRIVATE_RECIPE_837"}',customPattern:'{"secret":"PRIVATE_ART_837"}'});
  const privateValues=['SecretFirstName','SecretLastName','PRIVATE_','private-website','secret-person','98 765','private-profile','private-photo','private-assets',photo];
  for(const section of sections){
    const prompt=ai.buildPrompt(section,privateDraft,{brief:'Try a muted palette'});
    for(const value of privateValues) assert.ok(!prompt.includes(value),`${section} exposed ${value.slice(0,40)}`);
    assert.match(prompt,/Try a muted palette/);
  }
  const opted=ai.buildPrompt('details',privateDraft,{includeDetails:true});
  assert.match(opted,/SecretFirstName/);assert.match(opted,/secret-person/);
  assert.ok(!opted.includes(photo));assert.doesNotMatch(opted,/private-photo|private-assets/);
  assert.doesNotMatch(ai.buildPrompt('colors',privateDraft,{includeDetails:true}),/SecretFirstName|secret-person/);
});

test('valid saved custom recipes are represented as objects without leaking unrelated draft fields',()=>{
  const prompt=ai.buildPrompt('design',draft({design:'custom',customLayout:JSON.stringify(customLayout),pattern:'custom',customPattern:JSON.stringify(customPattern),nameLine1:'PrivateIdentity'}));
  assert.match(prompt,/"customLayout":\{"composition":"signal","font":"serif","align":"center"\}/);
  assert.match(prompt,/"customPattern":\{"palette":\["#b8a1ea","#f5e5a2"\]/);
  assert.doesNotMatch(prompt,/PrivateIdentity/);
  for(const needed of ['384','10,000','circle|rounded|square','280–420','40–96'])assert.ok(prompt.includes(needed));
});

test('details require explicit opt-in for names and contacts while fictional role editing remains available',()=>{
  assert.deepEqual(parse('details',{title:'Designer',tags:'ART · DESIGN'}).changes,{title:'Designer',tags:'ART · DESIGN'});
  for(const includeDetails of [false,undefined,'true',1])assert.throws(()=>parse('details',{email:'hello@example.com'},{includeDetails}),/Unsupported changes field/);
  const changed=parse('details',{email:'hello@example.com',nameLine1:'Sam'},{includeDetails:true});
  assert.equal(changed.changes.email,'hello@example.com');
  assert.throws(()=>parse('details',{website:'javascript:alert(1)'},{includeDetails:true}),/public HTTP/);
  assert.throws(()=>parse('details',{phone:'NOT_A_PHONE'},{includeDetails:true}),/digits/);
  assert.throws(()=>parse('details',{title:'<script>alert(1)</script>'}),/markup/);
  assert.throws(()=>parse('details',{title:'A\nB'}),/single line/);
});

test('an AI response cannot cross section boundaries or supply executable/custom asset fields',()=>{
  const banned={portraitData:photo,portraitUrl:'https://example.com/photo.jpg',imageBase:'https://example.com/icons',css:'body{}',html:'<script>x</script>',src:'https://example.com',onload:'alert(1)',nameLine1:'Replaced'};
  for(const section of ['design','artwork','layout','colors','icons','photo'])for(const [key,value]of Object.entries(banned))assert.throws(()=>parse(section,{[key]:value}),/Unsupported changes field/,`${section}.${key}`);
  assert.throws(()=>parse('colors',{design:'signal'}),/Unsupported changes field/);
  assert.throws(()=>parse('photo',{accent:'#ffffff'}),/Unsupported changes field/);
  assert.throws(()=>parse('icons',{website:'example.com'}),/Unsupported changes field/);
  assert.throws(()=>ai.parseResponse(envelope('layout',{layout:'stacked'}),{section:'colors',draft:core.defaults}),/another section/);
});

test('envelope parsing rejects unknown keys, malformed wrappers, oversize UTF-8 and prototype pollution',()=>{
  const valid=envelope('colors',{accent:'#112233'});
  assert.equal(ai.parseResponse('```json\n'+valid+'\n```',{section:'colors'}).changes.accent,'#112233');
  assert.equal(ai.parseResponse('```\n'+valid+'\n```',{section:'colors'}).changes.accent,'#112233');
  for(const value of ['Here is your JSON: '+valid,valid+'\nthanks','```js\n'+valid+'\n```','null','[]','{}','not json'])assert.throws(()=>ai.parseResponse(value,{section:'colors'}));
  for(const extras of [{version:2},{version:'1'},{format:'other'},{unknown:true},{name:'<img>'},{name:''},{name:'x'.repeat(81)}])assert.throws(()=>ai.parseResponse(envelope('colors',{accent:'#112233'},extras),{section:'colors'}));
  for(const key of ['__proto__','prototype','constructor']){
    const text=valid.replace('"changes":{','"changes":{"'+key+'":{"polluted":true},');
    assert.throws(()=>ai.parseResponse(text,{section:'colors'}),/unsupported property/);
  }
  assert.equal({}.polluted,undefined);
  assert.throws(()=>ai.parseResponse(envelope('colors',{accent:'#112233'},{name:'🌟'.repeat(17000)}),{section:'colors'}),/64 KB/);
  assert.throws(()=>parse('colors',{}),/no changes/);
});

test('fields are validated without number coercion, truncation or unsupported enum fallbacks',()=>{
  for(const width of ['321',true,279,421,300.5,null,[],{}])assert.throws(()=>parse('layout',{width}),/whole number/);
  for(const height of [179,321])assert.throws(()=>parse('layout',{height}),/whole number/);
  for(const portraitSize of [39,97,'64'])assert.throws(()=>parse('photo',{portraitSize}),/whole number/);
  for(const accent of ['red','#abc','url(https://example.com)','#123456;display:none',{},null])assert.throws(()=>parse('colors',{accent}));
  for(const design of ['toString','__proto__','moonlight','https://example.com'])assert.throws(()=>parse('layout',{design}),/available value/);
  for(const portraitShape of ['diamond','Circle'])assert.throws(()=>parse('photo',{portraitShape}),/available value/);
  assert.deepEqual(parse('colors',{accent:'#AABBCC'}).changes,{accent:'#aabbcc'});
  assert.throws(()=>parse('details',{title:'W'.repeat(65)}),/too long/);
});

test('custom recipes are parsed strictly and stored in session-compatible JSON strings',()=>{
  const p=parse('design',{design:'custom',customLayout,pattern:'custom',customPattern});
  assert.equal(typeof p.changes.customPattern,'string');assert.equal(typeof p.changes.customLayout,'string');
  assert.deepEqual(JSON.parse(p.changes.customPattern),{...customPattern,palette:['#b8a1ea','#f5e5a2']});
  assert.deepEqual(JSON.parse(p.changes.customLayout),customLayout);
  const html=core.render({...core.defaults,...p.changes});
  assert.ok(html.length<10000);assert.match(html,/#b8a1ea/);assert.match(html,/#f5e5a2/);
  assert.throws(()=>parse('artwork',{pattern:'custom',customPattern:JSON.stringify(customPattern)}),/must be an object/);
  assert.throws(()=>parse('artwork',{customPattern}),/also set pattern/);
  assert.throws(()=>parse('layout',{customLayout}),/also set design/);
  assert.throws(()=>parse('layout',{design:'custom',customLayout:{...customLayout,css:'display:grid'}}),/required recipe fields/);
  assert.throws(()=>parse('artwork',{pattern:'custom',customPattern:{...customPattern,rows:['0000','00','0000','0000']}}),/rows|equal-width/);
  assert.throws(()=>parse('artwork',{pattern:'custom',customPattern:{...customPattern,palette:['#ffffff'],rows:['7777','7777','7777','7777']}}),/palette digits/);
});

test('invalid merged fit or dense email artwork is rejected before a proposal can alter the draft',()=>{
  const before=draft({width:420,height:320,nameLine1:'WWWWWWWWWWWW'}),saved=JSON.stringify(before);
  assert.throws(()=>ai.createProposal(envelope('layout',{width:280}),{section:'layout',draft:before}),/Shorten|readable/);
  assert.equal(JSON.stringify(before),saved);
  const dense={palette:['#ffeedd','#112244'],rows:Array.from({length:24},(_,i)=>(i%2?'10':'01').repeat(8))};
  assert.throws(()=>parse('artwork',{pattern:'custom',customPattern:dense}),/10,000|simpler|artwork|simplify|detailed/i);
});

test('previews preserve identity and private photos and apply only one explicit patch',()=>{
  const original=draft({nameLine1:'Sam',portraitData:photo,portraitUrl:'',email:'sam@example.com'}),saved=JSON.stringify(original);
  const proposal=ai.createProposal(envelope('photo',{portraitShape:'rounded',portraitSize:56}),{section:'photo',draft:original});
  assert.equal(JSON.stringify(original),saved);
  assert.equal(proposal.candidate.portraitData,photo);assert.equal(proposal.candidate.email,original.email);
  const html=core.render(proposal.candidate,{preview:true,assetBase:'./sig'});assert.match(html,/data:image\/png;base64/);
  const patch=ai.applyProposal(proposal,original);assert.deepEqual(patch,{portraitShape:'rounded',portraitSize:56});
  assert.equal(JSON.stringify(original),saved,'core never mutates caller data');
  assert.ok(Object.isFrozen(proposal)&&Object.isFrozen(proposal.changes)&&Object.isFrozen(proposal.candidate));
  assert.throws(()=>{proposal.changes.portraitSize=90;},TypeError);
});

test('unpreviewed, forged and stale proposals cannot apply; harmless property order does not invalidate',()=>{
  const original=draft(),proposal=ai.createProposal(envelope('colors',{accent:'#112233'}),{section:'colors',draft:original});
  assert.throws(()=>ai.applyProposal({...proposal},original),/Preview the response/);
  for(const changed of [{nameLine1:'New name'},{accent:'#223344'},{portraitData:photo},{width:322}])assert.throws(()=>ai.applyProposal(proposal,{...original,...changed}),/changed since this preview/);
  assert.deepEqual(ai.applyProposal(proposal,Object.fromEntries(Object.entries(original).reverse())),{accent:'#112233'});
  const refreshed=ai.createProposal(envelope('colors',{accent:'#112233'}),{section:'colors',draft:{...original,nameLine1:'New name'}});
  assert.deepEqual(ai.applyProposal(refreshed,{...original,nameLine1:'New name'}),{accent:'#112233'});
});
