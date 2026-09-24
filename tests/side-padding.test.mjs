import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../signature-core.js';
import image from '../signature-image.js';
import ai from '../ai-extension-core.js';

const compact = {...core.defaults,...core.compactPreset,pattern:'none',nameLine1:'Juan Francisco',nameLine2:'Ribera Laszkowski',
  title:'Forward Deployed Engineer · LumApps',subtitle:'AI Engineering & Platforms',website:'franciscoribera.ch',websiteLabel:'',
  phone:'+41 76 559 34 61',location:'Winterthur, Switzerland',email:'',linkedin:'',portraitUrl:'https://example.com/photo.jpg'};

test('trimming sides and width preserves the compact reference content and vertical geometry', () => {
  const narrow = {...compact,width:264,sidePadding:8};
  assert.deepEqual(core.validate(narrow),{});
  assert.deepEqual(core.dimensions(compact),{width:560,height:201});
  assert.deepEqual(core.dimensions(narrow),{width:528,height:201});
  const original = core.render(compact), trimmed = core.render(narrow);
  assert.match(original,/width="512" valign="top" style="padding:24px;vertical-align:top/);
  assert.match(trimmed,/width="512" valign="top" style="padding:24px 8px;vertical-align:top/);
  // Only the outer width and horizontal padding may differ when inner width is equal.
  assert.equal(trimmed.replaceAll('528','560').replace('padding:24px 8px;','padding:24px;'),original);
  assert.equal(core.plainText(narrow),core.plainText(compact));
  const scaled = core.renderEmail(narrow,{scale:75});
  assert.match(scaled,/width="396"/);
  assert.match(scaled,/padding:18px 6px/);
  assert.deepEqual(core.emailDimensions(narrow,75),{width:396,height:150.75});
  assert.equal(image.dimensions(narrow,4).width,2112);
});

test('zero side padding reaches the edges without changing vertical padding or photo', () => {
  const edge = {...compact,width:256,sidePadding:0};
  assert.deepEqual(core.validate(edge),{});
  assert.deepEqual(core.dimensions(edge),{width:512,height:201});
  assert.match(core.render(edge),/width="512" valign="top" style="padding:24px 0px/);
  assert.match(core.render(edge),/src="https:\/\/example.com\/photo.jpg" width="96" height="96"/);
});

test('side padding is optional, bounded and neutral by default in every format and template', () => {
  for (const design of core.designs.map(d=>d.id)) for(const layout of ['paired','stacked']) for(const cardFormat of ['auto','front-back','single']) {
    const base = {...core.defaults,design,layout,cardFormat,width:420,height:320,pattern:'none',nameLine1:'Avery',nameLine2:'',title:'',subtitle:'',
      website:'example.com',websiteLabel:'',phone:'',email:'',linkedin:'',location:'',tags:''};
    delete base.sidePadding;
    assert.equal(core.render(base),core.render({...base,sidePadding:-1}));
    for(const sidePadding of [0,8,48]) {
      const v = {...base,sidePadding};
      assert.deepEqual(core.validate(v),{},`${design}/${layout}/${cardFormat}/${sidePadding}`);
      const html = core.render(v);
      assert.doesNotMatch(html,/(?:width|height)="-\d|NaN/);
      assert.notEqual(html,core.render(base));
    }
  }
  for(const sidePadding of [-2,49,2.5,'',null,true,[],{}]) assert.ok(core.validate({...compact,sidePadding}).sidePadding);
});

test('only explicit horizontal Single cards can be narrower and keep content-fit checks', () => {
  const small = {...compact,nameLine1:'Avery',nameLine2:'',width:220,sidePadding:0};
  assert.equal(core.minimumWidth(small),220);
  assert.deepEqual(core.validate(small),{});
  assert.equal(core.normalize(small).width,220);
  assert.equal(core.dimensions(small).width,440);
  assert.ok(core.validate({...small,width:219}).width);
  for(const patch of [{cardFormat:'front-back'},{cardFormat:'auto'},{layout:'stacked'}]) {
    assert.equal(core.minimumWidth({...small,...patch}),280);
    assert.ok(core.validate({...small,...patch}).width);
  }
  assert.match(core.validate({...compact,width:220,sidePadding:48,nameFontSize:40}).nameFontSize,/needs .* available/);
  const envelope = changes => JSON.stringify({format:'signature-ai',version:1,section:'layout',name:'Trim sides',changes});
  const result = ai.createProposal(envelope({width:264,sidePadding:8}),{section:'layout',draft:compact});
  assert.equal(result.candidate.width,264);
  assert.equal(result.candidate.sidePadding,8);
  assert.throws(()=>ai.createProposal(envelope({width:264}),{section:'layout',draft:core.defaults}),/280/);
});
