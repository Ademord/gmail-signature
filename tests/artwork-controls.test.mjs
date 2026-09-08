// Focused event-order checks use the real controller, recipe API and renderer.
// This small DOM surface does not claim browser layout or pointer hit-testing QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import core from '../signature-core.js';
import artwork from '../artwork-core.js';

const source=readFileSync(new URL('../artwork-controls.js',import.meta.url),'utf8');
const blank={palette:['#123456','#abcdef'],rows:['....','....','....','....']};
const copy=value=>JSON.parse(JSON.stringify(value));
function harness(recipe=blank){
  const nodes=new Map(),frames=new Map(),patches=[],errors=[];
  let nextFrame=0,draft={...core.defaults,pattern:'custom',customPattern:JSON.stringify(recipe)};
  const document={activeElement:null,events:new Map()};
  class Element {
    constructor(tag='div'){
      this.tagName=tag.toUpperCase();this.children=[];this.events=new Map();this.attrs=new Map();this._html='';
      this.dataset=new Proxy({}, {set(target,key,value){target[key]=String(value);return true;}});
      this.style={setProperty(key,value){this[key]=String(value);}};
      this.value='';this.disabled=false;this.open=false;this.isConnected=true;this.clientWidth=500;this.scrollWidth=500;this.scrollLeft=0;
      this.captures=new Set();
    }
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    set innerHTML(html){
      this._html=html;this.children=[];
      // Only the controller's static dialog template contributes IDs. Grid rows
      // and cells are subsequently created by its actual buildGrid function.
      for(const [,tag,id] of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)){
        const node=new Element(tag);node.id=id;this.append(node);
      }
    }
    get innerHTML(){return this._html;}
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    replaceChildren(...children){this._html='';this.children=[];this.append(...children);}
    setAttribute(name,value){this.attrs.set(name,String(value));}getAttribute(name){return this.attrs.get(name)??null;}removeAttribute(name){this.attrs.delete(name);}
    addEventListener(type,listener){this.events.set(type,[...(this.events.get(type)||[]),listener]);}
    removeEventListener(type,listener){this.events.set(type,(this.events.get(type)||[]).filter(value=>value!==listener));}
    dispatch(type,extras={}){for(const listener of this.events.get(type)||[])listener({target:this,preventDefault(){},stopPropagation(){},...extras});}
    click(){if(!this.disabled)this.dispatch('click',{detail:0});}
    querySelectorAll(selector){
      assert.equal(selector,'[data-cell]');const result=[];
      const walk=node=>{for(const child of node.children){if(child.dataset.cell!==undefined)result.push(child);walk(child);}};
      walk(this);return result;
    }
    querySelector(selector){
      if(selector.startsWith('#'))return nodes.get(selector.slice(1))||null;
      if(selector==='colgroup')return this._html.includes('<colgroup>')?{}:null;
      if(selector==='[tabindex="0"]')return this.querySelectorAll('[data-cell]').find(cell=>cell.tabIndex===0)||null;
      throw new Error('Unexpected selector '+selector);
    }
    closest(selector){
      const key=selector==='[data-cell]'?'cell':selector==='[data-ink]'?'ink':selector==='[data-edit-artwork]'?'editArtwork':null;
      assert.ok(key,'Unexpected closest selector '+selector);
      for(let node=this;node;node=node.parent)if(node.dataset[key]!==undefined)return node;
      return null;
    }
    focus(){document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;this.dispatch('close');}
    getBoundingClientRect(){return {left:0,top:0,right:100,bottom:100,width:100,height:100};}
    setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
    scrollIntoView(){}remove(){this.isConnected=false;}
  }
  document.body=new Element('body');document.createElement=tag=>new Element(tag);
  document.addEventListener=Element.prototype.addEventListener;document.removeEventListener=Element.prototype.removeEventListener;
  const context={window:{SignatureArtwork:artwork,SignatureCore:core},document,
    requestAnimationFrame(callback){const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame(id){frames.delete(id);}};
  vm.runInNewContext(source,context,{filename:'artwork-controls.js'});
  const controls=context.window.SignatureArtworkControls.attach({getDraft:()=>({...draft}),applyChanges(patch){patches.push(copy(patch));draft={...draft,...patch};},onError:message=>errors.push(message)});
  const node=id=>{assert.ok(nodes.has(id),'Controller creates #'+id);return nodes.get(id);};
  return {node,patches,errors,controls,click:id=>node(id).click(),
    flush(){for(const [id,callback] of [...frames]){frames.delete(id);callback();}},
    cells:()=>node('art-grid').querySelectorAll('[data-cell]'),
    activate(index,detail=0){node('art-grid').dispatch('click',{target:this.cells()[index],detail});},
    input(id,value){const element=node(id);element.focus();element.value=value;element.dispatch('input');},
    selectStudy(id){node('art-study').value=id;node('art-study').dispatch('change');},
    get draft(){return copy(draft);}};
}

test('a click-only grid activation paints once, supports undo/redo, and ignores the physical click fallback',()=>{
  const app=harness();app.controls.open();app.flush();assert.deepEqual(app.errors,[]);
  app.activate(5,1);assert.equal(app.cells()[5].dataset.transparent,'true');assert.equal(app.node('art-undo').disabled,true);
  app.activate(5);app.flush();
  assert.equal(app.cells()[5].dataset.transparent,'false');assert.match(app.cells()[5].getAttribute('aria-label'),/Row 2, column 2: ink 1/);
  assert.equal(app.cells().filter(cell=>cell.tabIndex===0).length,1);assert.equal(app.cells()[5].tabIndex,0);
  app.click('art-undo');app.flush();assert.equal(app.cells()[5].dataset.transparent,'true');assert.equal(app.node('art-undo').disabled,true);
  app.click('art-redo');app.flush();assert.equal(app.cells()[5].dataset.transparent,'false');
  app.click('art-apply');
  assert.equal(app.patches.length,1);assert.deepEqual(core.parseCustomPattern(app.patches[0].customPattern),{...blank,rows:['....','.0..','....','....']});
});

test('an imported 8-ink 384-cell grid cannot silently become a variation until a named study is chosen',()=>{
  const recipe={palette:['#123456','#abcdef','#315b8c','#ba6345','#ada52a','#37593b','#795296','#d5bd9a'],rows:Array.from({length:32},(_,y)=>String(Math.floor(y/4)).repeat(12))};
  const app=harness(recipe);app.controls.open();app.flush();
  assert.equal(app.node('art-study').value,'');assert.equal(app.node('art-variation').disabled,true);
  assert.equal(app.cells().length,384);assert.equal(app.node('art-inks').children.length,8);
  app.node('art-variation').dispatch('click');app.flush();app.click('art-apply');
  assert.equal(app.patches.length,1);assert.equal(app.patches[0].customPattern,JSON.stringify(recipe));
  app.controls.open();app.flush();app.selectStudy('cutforms');app.flush();
  assert.equal(app.node('art-variation').disabled,false);assert.equal(app.node('art-study').value,'cutforms');
  app.click('art-variation');app.flush();app.click('art-apply');
  assert.equal(app.patches.length,2);assert.deepEqual(core.parseCustomPattern(app.patches[1].customPattern),artwork.createStudy('cutforms',1));
});

test('invalid hex remains a blocking edit through click painting, pointer painting and mirroring',()=>{
  const app=harness();app.controls.open();app.flush();
  app.input('art-hex','#12');
  // Apply revalidates synchronously even before the scheduled preview runs.
  app.click('art-apply');assert.equal(app.patches.length,0);app.flush();
  assert.equal(app.node('art-hex').getAttribute('aria-invalid'),'true');assert.equal(app.node('art-apply').disabled,true);
  app.activate(5);app.flush();
  const grid=app.node('art-grid');grid.dispatch('pointerdown',{button:0,pointerId:7,clientX:10,clientY:10});grid.dispatch('pointerup',{pointerId:7});app.flush();
  app.click('art-mirror-h');app.flush();app.click('art-mirror-v');app.flush();
  assert.equal(app.node('art-hex').value,'#12');assert.equal(app.node('art-hex').getAttribute('aria-invalid'),'true');
  assert.equal(app.node('art-apply').disabled,true);assert.equal(app.node('art-preview-stage').hidden,true);
  app.node('art-apply').dispatch('click');assert.equal(app.patches.length,0,'A stale or synthetic Apply cannot bypass invalid text');
  app.input('art-hex','#ff8899');app.flush();assert.equal(app.node('art-apply').disabled,false);
  app.click('art-apply');assert.equal(app.patches.length,1);
  const applied=core.parseCustomPattern(app.patches[0].customPattern);
  assert.equal(applied.palette[0],'#ff8899');assert.equal(applied.rows.join('').replaceAll('.',''),'00');
});
