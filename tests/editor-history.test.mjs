import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { create } = require('../editor-history.js');
const draft = name => ({ name, width: 321, height: 208 });

test('history is usable through CommonJS and the browser global without storage', () => {
  const window = {};
  vm.runInNewContext(readFileSync(new URL('../editor-history.js', import.meta.url), 'utf8'), { window });
  assert.equal(typeof window.EditorHistory.create, 'function');
  const history = window.EditorHistory.create();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.equal(history.undo(draft('A')), null);
  assert.equal(history.redo(draft('A')), null);
});

test('consecutive typing coalesces within 1000 ms of each preceding keystroke', () => {
  const history = create();
  history.record(draft(''), draft('A'), { group: 'name', time: 0 });
  history.record(draft('A'), draft('Av'), { group: 'name', time: 1000 });
  history.record(draft('Av'), draft('Ave'), { group: 'name', time: 1900 });
  assert.deepEqual(history.undo(draft('Ave')), draft(''));
  assert.equal(history.canUndo, false);
  assert.deepEqual(history.redo(draft('')), draft('Ave'));
  assert.equal(history.canRedo, false);
});

test('a typing pause, changed field, or backward clock starts another step', () => {
  const history = create();
  history.record(draft('A'), draft('B'), { group: 'name', time: 0 });
  history.record(draft('B'), draft('C'), { group: 'name', time: 1001 });
  history.record(draft('C'), draft('D'), { group: 'title', time: 1002 });
  history.record(draft('D'), draft('E'), { group: 'title', time: 1000 });
  let current = draft('E');
  for (const name of ['D', 'C', 'B', 'A']) {
    current = history.undo(current);
    assert.deepEqual(current, draft(name));
  }
  assert.equal(history.canUndo, false);
});

test('discrete changes and explicit breakGroup isolate neighboring typing', () => {
  const history = create();
  history.record(draft('A'), draft('B'), { group: 'name', time: 10 });
  history.record(draft('B'), draft('C'), { time: 20 });
  history.record(draft('C'), draft('D'), { group: 'name', time: 30 });
  history.breakGroup();
  history.record(draft('D'), draft('E'), { group: 'name', time: 40 });
  history.record(draft('E'), draft('F'), { group: '', time: 50 });
  let current = draft('F');
  for (const name of ['E', 'D', 'C', 'B', 'A']) {
    current = history.undo(current);
    assert.deepEqual(current, draft(name));
  }
});

test('no-op records create no steps and preserve redo after undo', () => {
  const history = create();
  assert.equal(history.record(draft('A'), draft('A')), false);
  assert.equal(history.canUndo, false);
  assert.equal(history.record(draft('A'), draft('B')), true);
  assert.deepEqual(history.undo(draft('B')), draft('A'));
  assert.equal(history.record(draft('A'), draft('A')), false);
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.redo(draft('A')), draft('B'));
});

test('new edits after undo discard the abandoned redo branch and break typing', () => {
  const history = create();
  history.record(draft('A'), draft('B'), { group: 'name', time: 0 });
  history.breakGroup();
  history.record(draft('B'), draft('C'), { group: 'name', time: 10 });
  assert.deepEqual(history.undo(draft('C')), draft('B'));
  history.record(draft('B'), draft('D'), { group: 'name', time: 20 });
  assert.equal(history.canRedo, false);
  assert.equal(history.redo(draft('D')), null);
  assert.deepEqual(history.undo(draft('D')), draft('B'));
  assert.deepEqual(history.undo(draft('B')), draft('A'));
});

test('redo also closes the prior typing group', () => {
  const history = create();
  history.record(draft('A'), draft('B'), { group: 'name', time: 0 });
  assert.deepEqual(history.undo(draft('B')), draft('A'));
  assert.deepEqual(history.redo(draft('A')), draft('B'));
  history.record(draft('B'), draft('C'), { group: 'name', time: 1 });
  assert.deepEqual(history.undo(draft('C')), draft('B'));
  assert.deepEqual(history.undo(draft('B')), draft('A'));
});

test('the default cap retains exactly the latest 100 discrete undo steps', () => {
  const history = create();
  for (let i = 0; i < 125; i++) history.record(draft(i), draft(i + 1));
  let current = draft(125), count = 0;
  while (history.canUndo) { current = history.undo(current); count++; }
  assert.equal(count, 100);
  assert.deepEqual(current, draft(25));
  count = 0;
  while (history.canRedo) { current = history.redo(current); count++; }
  assert.equal(count, 100);
  assert.deepEqual(current, draft(125));
});

test('a configured cap evicts oldest steps without losing redo order', () => {
  const history = create({ limit: 2 });
  for (let i = 0; i < 3; i++) history.record(draft(i), draft(i + 1));
  assert.deepEqual(history.undo(draft(3)), draft(2));
  assert.deepEqual(history.undo(draft(2)), draft(1));
  assert.equal(history.undo(draft(1)), null);
  assert.deepEqual(history.redo(draft(1)), draft(2));
  assert.deepEqual(history.redo(draft(2)), draft(3));
  assert.equal(history.redo(draft(3)), null);
});

test('caller mutations cannot alias stored or returned snapshots', () => {
  const history = create(), before = draft('A'), after = draft('B');
  history.record(before, after);
  before.name = 'changed before';
  after.name = 'changed after';
  const current = draft('B'), restored = history.undo(current);
  current.name = 'changed current';
  assert.deepEqual(restored, draft('A'));
  restored.name = 'changed returned object';
  const redoCurrent = draft('A');
  assert.deepEqual(history.redo(redoCurrent), draft('B'));
  redoCurrent.name = 'changed redo current';
  assert.deepEqual(history.undo(draft('B')), draft('A'));
});

test('invalid typed drafts survive exactly without normalization or serialization', () => {
  const history = create();
  const invalid = { name: '', width: '', height: '1e', website: 'javascript:', color: 'broken', value: NaN, missing: undefined };
  const valid = draft('A');
  history.record(invalid, valid);
  assert.deepEqual(history.undo(valid), invalid);
  assert.deepEqual(history.redo(invalid), valid);
  assert.equal(history.record(invalid, { ...invalid }), false); // NaN and undefined must also compare as unchanged.
});

test('invalid limits fail explicitly instead of silently disabling history', () => {
  for (const limit of [0, -1, 1.5, Infinity, '100']) assert.throws(() => create({ limit }), RangeError);
});
