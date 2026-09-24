import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import core from '../signature-core.js';
import image from '../signature-image.js';

const values = overrides => ({...core.defaults,...overrides});
const ids = core.designs.map(design => design.id);
const typographyKeys = ['nameLayout','nameFontSize','titleFontSize','subtitleFontSize','contactFontSize','footerFontSize','lineSpacing','textSpacing','contactSpacing','sectionSpacing','contentPadding','sidePadding','singleArrangement','contactLayout','contactFont','footerVisible'];
const numericKeys = ['nameFontSize','titleFontSize','subtitleFontSize','contactFontSize','footerFontSize','lineSpacing','textSpacing','contactSpacing','sectionSpacing','contentPadding','sidePadding'];
const withoutTypography = v => Object.fromEntries(Object.entries(v).filter(([key]) => !typographyKeys.includes(key)));
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1],match[2]]));
// Tables that contain no nested table: contact rows, inline contact lines and grid cells.
const innermostTables = html => [...html.matchAll(/<table\b([^>]*)>((?:(?!<table\b)[\s\S])*?)<\/table>/g)].map(match => ({attrs:attributes(match[1]),inner:match[2]}));
const visibleText = html => html.replace(/<br>/g,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const customLayout = JSON.stringify({composition:'prism',font:'serif',align:'center'});

test('typography defaults and the compact preset are frozen, complete and format-only', () => {
  assert.deepEqual(Object.keys(core.typographyDefaults),typographyKeys);
  assert.deepEqual({...core.typographyDefaults},{nameLayout:'template',nameFontSize:0,titleFontSize:0,subtitleFontSize:0,contactFontSize:0,footerFontSize:0,
    lineSpacing:100,textSpacing:100,contactSpacing:100,sectionSpacing:100,contentPadding:-1, sidePadding:-1,singleArrangement:'auto',contactLayout:'template',contactFont:'template',footerVisible:'show'});
  assert.ok(Object.isFrozen(core.typographyDefaults) && Object.isFrozen(core.compactPreset) && Object.isFrozen(core.defaults));
  for (const key of typographyKeys) assert.equal(core.defaults[key],core.typographyDefaults[key],key);
  // Contract v3 reference proportions: a 560 px card, 96 px photo display,
  // 13 px role/specialty/contacts and bar separators between inline contacts.
  assert.deepEqual({...core.compactPreset},{cardFormat:'single',layout:'paired',singleArrangement:'rows',width:280,height:180,contentPadding:24,sidePadding:-1,portraitSize:96,
    nameLayout:'single',nameFontSize:22,titleFontSize:13,subtitleFontSize:13,contactFontSize:13,contactFont:'sans',contactLayout:'inline',contactSeparator:'bar',
    lineSpacing:100,textSpacing:100,contactSpacing:100,sectionSpacing:150,footerVisible:'hide'});
  for (const key of Object.keys(core.compactPreset)) assert.ok(Object.hasOwn(core.defaults,key),key);
  // The preset styles the photo display size, never the photo itself, personal
  // details, colors, artwork or contact visibility.
  for (const key of ['nameLine1','nameLine2','title','subtitle','website','websiteLabel','email','phone','linkedin','location','tags','portraitData','portraitUrl','portraitShape',
    'accent','frontBackground','backBackground','design','pattern','customPattern','customLayout','artworkPlacement','artworkScale','artworkOpacity','artworkFade','motifScale','imageBase',
    'websiteVisible','emailVisible','phoneVisible','linkedinVisible','locationVisible'])
    assert.ok(!Object.hasOwn(core.compactPreset,key),key);
  assert.deepEqual(core.validate(values(core.compactPreset)),{});
});

test('absent format fields reproduce the template output byte for byte', () => {
  assert.equal(createHash('sha256').update(core.render(withoutTypography(core.defaults))).digest('hex'),'ff0a66d3dd3ab2eae0c6746710ab906c45a65acf505c5b140e40e6104262abc1');
  for (const design of ids) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back']) {
    const v = values({design,layout,cardFormat,portraitUrl:'https://example.com/portrait.jpg'});
    assert.equal(core.render(withoutTypography(v)),core.render(v),design + ':' + layout + ':' + cardFormat);
    assert.deepEqual(core.dimensions(withoutTypography(v)),core.dimensions(v));
  }
});

// Set SIGNATURE_BASELINE_CORE to a pre-change signature-core.js (for example
// `git show 7218643:signature-core.js`) to compare every template directly.
const baselinePath = process.env.SIGNATURE_BASELINE_CORE;
test('template defaults stay byte-identical to the baseline core', {skip:!baselinePath && 'SIGNATURE_BASELINE_CORE is not set'}, async () => {
  const sandbox = {URL,TextEncoder,TextDecoder,module:{exports:{}},console};
  vm.runInNewContext(await readFile(baselinePath,'utf8'),sandbox,{filename:'baseline-signature-core.js'});
  const baseline = sandbox.module.exports;
  const variants = [{},{portraitUrl:'https://example.com/portrait.jpg',portraitSize:96},{pattern:'gesture'},{pattern:'none'},{artworkPlacement:'background',pattern:'galaxy'},
    {width:280,height:180},{width:420,height:320},{email:'hello@example.com',websiteIcon:'none',phoneIcon:'none'},{title:'',subtitle:'',tags:''},{nameLine2:''},
    {nameLine1:'Jean Alexander',nameLine2:'Morgan Winterbourne',location:'Example City, Switzerland'},{cardGap:0,artworkFade:'radial',artworkOpacity:60}];
  // Compare every published baseline layout; Minimal is new and is checked against Original separately.
  for (const design of [...baseline.designs.map(d => d.id),'custom']) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back']) for (const variant of variants) {
    const v = {...baseline.defaults,design,layout,cardFormat,customLayout:design === 'custom' ? customLayout : '',...variant};
    const label = JSON.stringify({design,layout,cardFormat,...variant});
    // The baseline runs in a separate VM; compare plain data, not realm prototypes.
    assert.deepEqual(core.validate(v),{...baseline.validate(v)},label);
    assert.deepEqual(core.dimensions(v),{...baseline.dimensions(v)},label);
    if (Object.keys(baseline.validate(v)).length) continue;
    assert.equal(core.render(v),baseline.render(v),label);
    assert.equal(core.plainText(v),baseline.plainText(v),label);
  }
});

test('format controls normalize to bounded integers and round-trip through JSON', () => {
  const n = core.normalize({nameFontSize:'5',titleFontSize:30,subtitleFontSize:-4,contactFontSize:'12.4',footerFontSize:7,lineSpacing:10,textSpacing:999,
    contactSpacing:'-3',sectionSpacing:'70',contentPadding:-9,nameLayout:' single ',contactLayout:'inline'});
  assert.deepEqual(Object.fromEntries(numericKeys.map(key => [key,n[key]])),{nameFontSize:12,titleFontSize:24,subtitleFontSize:0,contactFontSize:12,footerFontSize:8,
    lineSpacing:80,textSpacing:200,contactSpacing:0,sectionSpacing:70,contentPadding:-1, sidePadding:-1});
  assert.equal(n.nameLayout,'single');assert.equal(n.contactLayout,'inline');
  assert.equal(core.normalize({contentPadding:60}).contentPadding,48);
  const legacy = core.normalize(withoutTypography(core.defaults));
  for (const key of typographyKeys) assert.equal(legacy[key],core.typographyDefaults[key],key);
  for (const key of numericKeys) assert.equal(typeof legacy[key],'number',key);
  const tuned = core.normalize(values(core.compactPreset));
  assert.deepEqual(core.normalize(JSON.parse(JSON.stringify(tuned))),tuned);
  // Incomplete or invalid drafts remain measurable while being edited.
  const size = core.dimensions({cardFormat:'single',nameLayout:'bogus',contactLayout:'bogus',singleArrangement:'bogus',contactFont:'bogus'});
  assert.ok(Number.isInteger(size.width) && Number.isInteger(size.height));
});

test('invalid format values are rejected on their own control with precise ranges', () => {
  const cases = {
    nameFontSize:[[11,5,41,12.5,-1,'',null,true,'abc'],/^Use 0 for the automatic size or a whole number from 12 to 40\.$/],
    titleFontSize:[[7,25,1,9.5],/^Use 0 for the template size or a whole number from 8 to 24\.$/],
    subtitleFontSize:[[7,25],/from 8 to 24/],contactFontSize:[[7,25],/from 8 to 24/],footerFontSize:[[7,25],/from 8 to 24/],
    lineSpacing:[[79,201,0,100.5,''],/^Enter a whole number from 80 to 200\.$/],
    textSpacing:[[-1,201],/from 0 to 200/],contactSpacing:[[-1,201],/from 0 to 200/],sectionSpacing:[[-1,201,{}],/from 0 to 200/],
    contentPadding:[[-2,49,1.5,''],/^Use -1 for the template padding or a whole number from 0 to 48\.$/]
  };
  for (const [key,[bad,message]] of Object.entries(cases)) for (const value of bad) {
    const v = values({[key]:value});
    assert.match(core.validate(v)[key],message,key + '=' + JSON.stringify(value));
    assert.throws(() => core.render(v),error => Boolean(error.errors[key]));
  }
  for (const key of ['nameLayout','singleArrangement','contactLayout','contactFont','footerVisible']) for (const value of ['','SINGLE','toString','__proto__',42,true]) {
    assert.equal(typeof core.validate(values({[key]:value}))[key],'string',key + '=' + value);
  }
  for (const [key,good] of [['nameFontSize',[0,12,40,'24']],['titleFontSize',[0,8,24]],['contactFontSize',[0,8,24]],['footerFontSize',[0,8,24]],['lineSpacing',[80,200]],
    ['textSpacing',[0,200]],['sectionSpacing',[0,200]],['contentPadding',[-1,0,48]]]) for (const value of good) {
    assert.equal(core.validate(values({[key]:value,cardFormat:'single',layout:'stacked',width:420}))[key],undefined,key + '=' + value);
  }
});

test('explicit text sizes reach the markup unchanged in every render path', () => {
  const tuned = {nameFontSize:18,titleFontSize:10,subtitleFontSize:10,contactFontSize:11};
  for (const design of ids) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back']) {
    const v = values({...tuned,design,layout,cardFormat}),label = design + ':' + layout + ':' + cardFormat;
    assert.deepEqual(core.validate(v),{},label);
    const html = core.render(v);
    assert.match(html,/font-size:18px;line-height:21px;font-weight:(?:400|600)/,label);
    assert.match(html,/font-size:10px;line-height:13px;font-weight:400;color:#[0-9a-f]{6};letter-spacing:0\.81px;white-space:nowrap">Software Engineer</,label);
    assert.match(html,/font-size:10px;line-height:14px;[^"]*">AI &amp; AUTOMATION</,label);
    assert.equal((html.match(/font-size:11px;line-height:15px/g) || []).length,4,label + ' sizes all four contacts');
    assert.doesNotMatch(html,/font-size:10\.5px/,label);
    assert.match(html,new RegExp('^<table[^>]+width="' + core.dimensions(v).width + '" height="' + core.dimensions(v).height + '"'),label);
  }
});

test('name layouts rearrange only the display and never rewrite saved manual breaks', () => {
  const base = values({cardFormat:'single',layout:'stacked'}),template = core.render(base);
  assert.match(template,/>Avery<br>Morgan<\/td>/);
  const single = {...base,nameLayout:'single'};
  assert.deepEqual(core.validate(single),{});
  assert.match(core.render(single),/>Avery Morgan<\/td>/);
  assert.equal(core.normalize(single).nameLine1,'Avery');assert.equal(core.normalize(single).nameLine2,'Morgan');
  assert.equal(core.plainText(single),core.plainText(base));
  assert.equal(core.render({...single,nameLayout:'template'}),template,'switching back restores the saved break');
  const names = {nameLine1:'Alexandria',nameLine2:'Montgomery-Smith'};
  const wrapped = values({cardFormat:'single',layout:'stacked',width:280,nameLayout:'wrap',nameFontSize:14,...names});
  assert.deepEqual(core.validate(wrapped),{});
  assert.match(core.render(wrapped),/font-size:14px;[^"]*">Alexandria<br>Montgomery-Smith<\/td>/);
  assert.equal(core.normalize(wrapped).nameLine2,'Montgomery-Smith');
  for (const design of ids) for (const cardFormat of ['auto','front-back']) {
    const v = values({design,cardFormat,nameLayout:'single'});
    assert.deepEqual(core.validate(v),{},design + ':' + cardFormat);
    assert.match(core.render(v),/>Avery Morgan<\/td>/,design + ':' + cardFormat);
  }
});

test('an explicit name size is never reduced; overflow names the responsible control', () => {
  const tooWide = values({cardFormat:'single',layout:'stacked',width:280,nameLayout:'single',nameFontSize:40,nameLine1:'Alexandria',nameLine2:'Montgomery-Smith'});
  const errors = core.validate(tooWide);
  assert.match(errors.nameFontSize,/^At 40 px the name needs \d+ px but 152 px is available\. Choose a smaller name size, Wrap name layout or a wider card\.$/);
  assert.ok(Number(errors.nameFontSize.match(/needs (\d+)/)[1]) > 152);
  assert.equal(errors.nameLine1,undefined);assert.equal(errors.nameLine2,undefined);
  assert.throws(() => core.render(tooWide),error => /^At 40 px/.test(error.errors.nameFontSize));
  assert.match(core.validate({...tooWide,nameLayout:'wrap'}).nameFontSize,/^At 40 px the longest name word needs 381 px but 152 px is available\. Choose a smaller name size or a wider card\.$/);
  const automatic = {...tooWide,nameFontSize:0};
  assert.match(core.validate(automatic).nameLayout,/Choose Wrap or Template name layout/);
  assert.match(core.validate({...automatic,nameLayout:'wrap'}).nameLine2,/Shorten the name lines/);
  assert.equal(core.validate(values({cardFormat:'single',nameFontSize:40})).nameFontSize,undefined,'a large size that fits is kept');
  assert.match(core.render(values({cardFormat:'single',nameFontSize:40})),/font-size:40px;line-height:45px/);
});

test('title, contact and footer overflow blame a chosen size only when the template size fits', () => {
  const narrow = {cardFormat:'single',layout:'stacked',width:280};
  const title = values({...narrow,title:'Forward Deployed Engineer · Acme Corp',titleFontSize:16});
  assert.match(core.validate(title).titleFontSize,/^At 16 px the title needs more than two lines here/);
  assert.equal(core.validate(title).title,undefined);
  assert.deepEqual(core.validate({...title,titleFontSize:0}),{});
  const email = values({...narrow,email:'a'.repeat(30) + '@example.com'});
  assert.deepEqual(core.validate(email),{});
  assert.match(core.validate({...email,contactFontSize:16}).contactFontSize,/^Email needs more than two lines at 16 px\. Choose a smaller contact size or a wider card\.$/);
  assert.equal(core.validate({...email,contactFontSize:16}).email,undefined);
  const wide = values({...narrow,email:'m'.repeat(40) + '@example.com'});
  assert.deepEqual(core.validate(wide),{});
  assert.match(core.validate({...wide,contactFont:'sans'}).contactFont,/^Email needs more than two lines in Sans/);
  assert.match(core.validate(values({...narrow,email:'m'.repeat(64) + '@example.com'})).email,/Shorten this text/,'text that never fits still blames the text');
  const tall = values({lineSpacing:200});
  assert.match(core.validate(tall).height,/reduce text sizes, spacing, padding or wrapped lines/);
  assert.equal(core.validate(tall).lineSpacing,undefined);
  const crowded = values({height:180,email:'hello@example.com',tags:'SOFTWARE · DATA · AI · PLATFORMS · MACHINE LEARNING · CLOUD'});
  assert.equal(core.validate(crowded).height,'Increase the card height or shorten the text to keep everything readable.','template message is unchanged');
  assert.deepEqual(core.validate({...crowded,contactSpacing:0}),{},'tighter contact spacing makes the fixed back face fit');
  assert.match(core.validate(values({footerFontSize:24,tags:'SOFTWARE · DATA · AI · PLATFORMS · ML'})).footerFontSize,/^At 24 px the footer needs more than two lines/);
  assert.match(core.validate(values({cardFormat:'single',layout:'stacked',width:280,singleArrangement:'columns'})).singleArrangement,/Choose Rows or Automatic/);
});

test('the compact preset reproduces the reference proportions on a fictional three-contact card', () => {
  const photo = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
  // Fictional stand-in for the private reference: three visible contacts, a
  // hidden but saved LinkedIn, background artwork and a retained cropped photo.
  const draft = values({nameLine1:'Morgan Alexander',nameLine2:'Whitfield',email:'',linkedinVisible:'hide',artworkPlacement:'background',
    portraitData:photo,portraitUrl:'https://example.com/portrait.jpg',portraitShape:'rounded',portraitSize:64});
  const v = {...draft,...core.compactPreset};
  assert.deepEqual(core.validate(v),{});
  const size = core.dimensions(v),html = core.render(v),ratio = size.width / size.height;
  // 24 px insets + 108 px identity (brand, one-line name, 13 px role and specialty) + 27 px section gap + 18 px contact row.
  assert.deepEqual(size,{width:560,height:201});
  assert.ok(ratio >= 2.7 && ratio <= 2.9,'reference aspect ' + ratio);
  assert.ok(size.height < core.dimensions(values({})).height,'shorter than the default card');
  assert.match(html,/^<table[^>]+width="560" height="201"/);
  assert.deepEqual(image.dimensions(v,4),{width:2240,height:804,logicalWidth:560,logicalHeight:201});
  assert.ok(html.includes('style="padding:24px;vertical-align:top"'),'equal 24 px insets');
  for (const height of [180,190,201]) assert.deepEqual(core.dimensions({...v,height}),size,'content, not the minimum height, sets the card height');
  assert.equal(core.dimensions({...v,height:202}).height,202);
  // The preset displays the photo at 96 px (about 17% of the width) and keeps its content, crop and shape.
  assert.equal(html.split('width="96" height="96" alt="Morgan Alexander Whitfield"').length - 1,1);
  assert.ok(96 / size.width > .16 && 96 / size.width < .18);
  assert.match(html,/src="https:\/\/example\.com\/portrait\.jpg"/);assert.match(html,/border-radius:12px/);
  assert.ok(core.render(v,{preview:true}).includes(photo),'preview and PNG keep the cropped photo');
  const stored = core.normalize(v);
  for (const key of ['portraitData','portraitUrl','portraitShape','linkedin','linkedinVisible','tags','email']) assert.equal(stored[key],draft[key],key);
  assert.equal(stored.portraitSize,96);
  assert.match(html,/font-size:22px;line-height:25px;[^"]*">Morgan Alexander Whitfield<\/td>/,'full name on one line');
  assert.match(html,/font-size:13px;line-height:16px;[^"]*letter-spacing:1\.05px;white-space:nowrap">Software Engineer</);
  assert.match(html,/font-size:13px;line-height:18px;[^"]*">AI &amp; AUTOMATION</);
  const row = innermostTables(html).find(table => table.inner.includes('href="https://example.com/"'));
  assert.ok(row);assert.equal(row.inner.match(/<tr>/g).length,1,'one contact row');
  for (const text of ['href="tel:+41000000000"','>Zurich, Switzerland<']) assert.ok(row.inner.includes(text),text);
  assert.equal((row.inner.match(/aria-hidden="true"[^>]*>\|<\/td>/g) || []).length,2,'two bar separators');
  assert.equal((html.match(/font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#[0-9a-f]{6};white-space:nowrap">/g) || []).length,3,'three 13 px contacts');
  assert.ok(!html.includes('linkedin.com') && !html.includes('SOFTWARE'),'hidden LinkedIn and footer stay out of the email');
  assert.ok(!core.plainText(v).includes('linkedin') && !core.plainText(v).includes('SOFTWARE'));
  assert.ok(html.length < 10000);
  // The public long-name fixture is wider than 400 px at 22 px: a keyed error, then it fits once the card widens.
  const long = {...v,nameLine1:'Jean Alexander',nameLine2:'Morgan Winterbourne'},errors = core.validate(long);
  assert.deepEqual(Object.keys(errors),['nameFontSize']);
  assert.match(errors.nameFontSize,/^At 22 px the name needs 416 px but 400 px is available\. Choose a smaller name size, Wrap name layout or a wider card\.$/);
  const widths = [];
  for (let width = 280; width <= 420; width++) if (!Object.keys(core.validate({...long,width})).length) widths.push(width);
  assert.ok(widths.length && widths[0] <= 300 && widths.at(-1) === 420,'widening recovers the fit: ' + widths[0]);
  const widened = {...long,width:widths[0]},wide = core.dimensions(widened);
  assert.equal(wide.height,201,'same height once the name fits');
  assert.ok(wide.width / wide.height >= 2.7 && wide.width / wide.height <= 2.9);
  assert.match(core.render(widened),/font-size:22px;line-height:25px;[^"]*">Jean Alexander Morgan Winterbourne<\/td>/);
});

test('the compact preset renders every template or reports a keyed fit error that widening resolves', () => {
  for (const design of [...ids,'custom']) for (const names of [{},{nameLine1:'Morgan Alexander',nameLine2:'Whitfield'},{nameLine1:'Jean Alexander',nameLine2:'Morgan Winterbourne'}])
    for (const portraitUrl of ['','https://example.com/portrait.jpg']) {
      const v = values({design,customLayout:design === 'custom' ? customLayout : '',...names,portraitUrl,...core.compactPreset});
      const label = [design,names.nameLine1 || 'default',portraitUrl ? 'photo' : 'no photo'].join(':'),errors = core.validate(v);
      // Short names fit every template; longer content may need the editor to widen the card.
      if (names.nameLine2 !== 'Morgan Winterbourne') assert.deepEqual(errors,{},label);
      else if (Object.keys(errors).length) assert.deepEqual(Object.keys(errors),['nameFontSize'],label);
      assert.deepEqual(core.validate({...v,width:420}),{},label + ' widened');
      if (Object.keys(errors).length) {assert.throws(() => core.render(v),label);continue;}
      const html = core.render(v),fullName = [v.nameLine1,v.nameLine2].join(' ');
      assert.equal(core.dimensions(v).width,560,label);
      assert.match(html,new RegExp('font-size:22px;line-height:25px;[^"]*">' + fullName + '</td>'),label + ' one-line name');
      assert.equal(html.split('alt="' + fullName + '"').length - 1,portraitUrl ? 1 : 0,label);
      for (const table of innermostTables(html)) {
        if (!/href="|>Zurich/.test(table.inner) || table.inner.match(/<tr>/g).length !== 1) continue;
        const items = (table.inner.match(/<a\b/g) || []).length + (table.inner.includes('Zurich, Switzerland') ? 1 : 0);
        assert.equal((table.inner.match(/aria-hidden="true"/g) || []).length,items - 1,label + ' separators only between items');
        assert.doesNotMatch(table.inner,/^<tr><td[^>]*aria-hidden|aria-hidden="true"[^>]*>[^<]*<\/td><\/tr>$/,label + ' no leading or trailing separator');
      }
    }
});

test('inline contacts pack whole items into measured rows and wrap only an item wider than a row', () => {
  const dense = values({cardFormat:'single',layout:'paired',singleArrangement:'rows',width:420,contactLayout:'inline',
    websiteLabel:'Portfolio · Research · Design · Products',email:'long.email.address.for.contact@example.com',location:'Somewhere in a very long region of Switzerland'});
  assert.deepEqual(core.validate(dense),{});
  const html = core.render(dense);
  const lines = innermostTables(html).filter(table => /href="|>Somewhere/.test(table.inner));
  assert.equal(lines.length,2,'five long items need exactly two measured rows at 796 px');
  for (const line of lines) {
    const width = Number(line.attrs.width),cells = [...line.inner.matchAll(/<td width="(\d+)"/g)].map(match => Number(match[1]));
    assert.equal(cells.reduce((sum,cell) => sum + cell,0),width,'declared cells fill the row table');
    assert.ok(width <= 796);
    assert.equal(line.inner.match(/<tr>/g).length,1);
  }
  for (const href of ['https://example.com/','mailto:long.email.address.for.contact@example.com','tel:+41000000000','https://www.linkedin.com/'])
    assert.equal(html.split('href="' + href + '"').length - 1,1,href);
  assert.ok(html.includes('>Portfolio · Research · Design · Products</a>'));
  assert.ok(html.includes('>long.email.address.for.contact@example.com</a>'));
  assert.ok(html.includes('>Somewhere in a very long region of Switzerland</td>'));
  const narrow = values({cardFormat:'single',layout:'stacked',width:280,contactLayout:'inline',location:'Somewhere in a very long region of Switzerland'});
  assert.deepEqual(core.validate(narrow),{});
  assert.ok(core.render(narrow).includes('>Somewhere in a very long region of<br>Switzerland</td>'),'an over-wide item wraps inside its own cell');
  const noIcons = values({cardFormat:'single',contactLayout:'inline',websiteIcon:'none',phoneIcon:'none',linkedinIcon:'none',locationIcon:'none'});
  const plain = core.render(noIcons);
  assert.doesNotMatch(plain,/icon-/);
  for (const href of ['https://example.com/','tel:+41000000000','https://www.linkedin.com/']) assert.ok(plain.includes('href="' + href + '"'),href);
});

test('spacing and padding controls change the measured single card by their exact amounts', () => {
  const base = values({cardFormat:'single',layout:'stacked'}),height = overrides => core.dimensions({...base,...overrides}).height;
  const h = height({});
  assert.ok(h > base.height,'the reference card is content-driven');
  assert.equal(height({sectionSpacing:200}) - h,30,'section gap 18→36 and footer gap 12→24');
  assert.equal(height({sectionSpacing:200,footerVisible:'hide'}) - height({footerVisible:'hide'}),18);
  assert.equal(h - height({contactSpacing:0}),18,'three 6 px contact gaps');
  assert.equal(h - height({textSpacing:0}),32,'brand 14, title 7 and subtitle 11 gaps');
  assert.equal(h - height({contentPadding:0}),44);
  assert.equal(height({contentPadding:48}) - h,52);
  assert.ok(height({lineSpacing:80}) < h && height({lineSpacing:200}) > h);
  const html = core.render(base),tight = core.render({...base,textSpacing:0});
  assert.match(html,/<td height="7" /);assert.doesNotMatch(tight,/<td height="7" |<td height="11" |<td height="0"/);
  for (const v of [{...base,textSpacing:0,contactSpacing:0,sectionSpacing:0},{...base,layout:'paired',contactSpacing:0,sectionSpacing:0}]) {
    assert.deepEqual(core.validate(v),{});assert.doesNotMatch(core.render(v),/height="0"|width="0"/);
  }
});

test('arrangement and contact layout choices apply only where meaningful', () => {
  for (const design of ids) {
    const tall = values({design,cardFormat:'single',layout:'stacked'}),wide = values({design,cardFormat:'single'});
    assert.equal(core.render({...tall,singleArrangement:'rows'}),core.render(tall),design + ' tall rows is the automatic arrangement');
    assert.equal(core.render({...wide,singleArrangement:'columns'}),core.render(wide),design + ' wide columns is the automatic arrangement');
    const rows = {...wide,singleArrangement:'rows'};
    assert.deepEqual(core.validate(rows),{},design);
    assert.notEqual(core.render(rows),core.render(wide),design);
    assert.equal(core.dimensions(rows).width,642,design);
    for (const cardFormat of ['auto','front-back']) {
      const other = values({design,cardFormat});
      assert.equal(core.render({...other,singleArrangement:'rows'}),core.render(other),design + ':' + cardFormat + ' ignores the single-card arrangement');
    }
    assert.equal(core.render({...wide,contactFont:'mono'}),core.render(wide),design + ' template contacts are monospaced');
  }
  for (const v of [values({}),values({cardFormat:'single'}),values({cardFormat:'single',layout:'stacked'})]) assert.equal(core.render({...v,contactLayout:'stacked'}),core.render(v));
  const contour = values({design:'contour',layout:'stacked'});
  assert.match(core.render(contour),/colspan="3"/,'tall Contour uses two contact columns');
  const stacked = core.render({...contour,contactLayout:'stacked'});
  assert.doesNotMatch(stacked,/colspan="3"/);assert.match(stacked,/colspan="1"/);
});

test('every template, format and control combination either renders consistently or explains a keyed error', () => {
  const knobs = [{},core.compactPreset,{contactLayout:'inline'},{contactLayout:'stacked',contactFont:'sans',contactFontSize:12},{nameLayout:'single'},{nameLayout:'wrap',nameFontSize:24},
    {footerVisible:'hide',lineSpacing:80,textSpacing:0,contactSpacing:0,sectionSpacing:0,contentPadding:0},
    {lineSpacing:130,textSpacing:150,titleFontSize:12,subtitleFontSize:12,footerFontSize:10,contentPadding:24}];
  const variants = [{},{title:'',subtitle:'',website:'',email:'',phone:'',linkedin:'',location:'',tags:''},
    {websiteIcon:'none',emailIcon:'none',phoneIcon:'none',linkedinIcon:'none',locationIcon:'none',email:'hello@example.com'},
    {portraitUrl:'https://example.com/portrait.jpg',portraitSize:96},{pattern:'gesture'},{nameLine1:'Jean Alexander',nameLine2:'Morgan Winterbourne'}];
  let rendered = 0;
  for (const design of [...ids,'custom']) for (const layout of ['paired','stacked']) for (const cardFormat of ['auto','single','front-back']) for (const [k,knob] of knobs.entries()) for (const [c,variant] of variants.entries()) {
    const v = values({design,layout,cardFormat,customLayout:design === 'custom' ? customLayout : '',...knob,...variant});
    const label = [design,layout,cardFormat,'knob' + k,'content' + c].join(':'),errors = core.validate(v);
    if ((k === 0 && c === 0) || (k === 1 && c < 4)) assert.deepEqual(errors,{},label);
    // The long public name may exceed a 560 px compact card: only its explicit name size is reported.
    if (k === 1 && c === 5 && Object.keys(errors).length) assert.deepEqual(Object.keys(errors),['nameFontSize'],label);
    if (Object.keys(errors).length) {
      for (const [key,message] of Object.entries(errors)) {assert.ok(Object.hasOwn(core.defaults,key),label + ' ' + key);assert.ok(typeof message === 'string' && message.length > 10,label);}
      assert.throws(() => core.render(v),error => Object.keys(error.errors).length > 0,label);
      continue;
    }
    rendered++;
    const html = core.render(v),size = core.dimensions(v),text = visibleText(html),name = [v.nameLine1,v.nameLine2].filter(Boolean).join(' ');
    assert.match(html,new RegExp('^<table[^>]+width="' + size.width + '" height="' + size.height + '"'),label);
    assert.doesNotMatch(html,/NaN|undefined|Infinity|width="-|height="-|padding:-/,label);
    assert.ok(html.length < 10000,label);
    for (const word of name.split(' ')) assert.ok(text.includes(word),label + ' ' + word);
    const hrefs = [v.website && 'https://example.com/',v.email && 'mailto:hello@example.com',v.phone && 'tel:+41000000000',v.linkedin && 'https://www.linkedin.com/'].filter(Boolean);
    for (const href of hrefs) assert.equal(html.split('href="' + href + '"').length - 1,1,label + ' ' + href);
    if (v.location) assert.ok(text.includes('Zurich, Switzerland'),label);
    if (v.tags) assert.equal(text.includes('SOFTWARE · DATA · AI'),v.footerVisible !== 'hide',label + ' footer');
    assert.equal(html.split('alt="' + name + '"').length - 1,v.portraitUrl ? 1 : 0,label + ' portrait');
    for (const table of innermostTables(html)) {
      if (!/href="|>Zurich/.test(table.inner) || table.inner.match(/<tr>/g).length !== 1) continue;
      const cells = [...table.inner.matchAll(/<td width="(\d+)"/g)].map(match => Number(match[1]));
      assert.equal(cells.reduce((sum,cell) => sum + cell,0),Number(table.attrs.width),label + ' contact cells fill their measured row');
    }
  }
  assert.ok(rendered > 1000,'most combinations render: ' + rendered);
});
