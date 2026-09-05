/* Session-only history for flat editor drafts. No validation or persistence. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EditorHistory = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function copy(draft) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      throw new TypeError('A history snapshot must be a flat draft object.');
    }
    return Object.assign({}, draft);
  }

  function equal(a, b) {
    var keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(function (key) {
      return Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key]);
    });
  }

  function create(options) {
    var limit = options && options.limit !== undefined ? options.limit : 100;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('History limit must be a positive whole number.');
    }
    var undoStack = [], redoStack = [], lastGroup = null, lastTime = null;

    function breakGroup() { lastGroup = null; lastTime = null; }
    function push(stack, draft) {
      stack.push(draft);
      if (stack.length > limit) stack.shift();
    }

    return Object.freeze({
      // Omit group for a discrete edit. time is an optional millisecond clock
      // value; typing joins the previous edit only within the last 1000 ms.
      record: function (before, after, metadata) {
        var previous = copy(before), next = copy(after);
        if (equal(previous, next)) return false;
        metadata = metadata || {};
        var group = typeof metadata.group === 'string' && metadata.group.length ? metadata.group : null;
        var time = Number.isFinite(metadata.time) ? metadata.time : Date.now();
        var merge = group !== null && group === lastGroup && undoStack.length > 0 &&
          lastTime !== null && time >= lastTime && time - lastTime <= 1000;
        redoStack.length = 0;
        if (!merge) push(undoStack, previous);
        lastGroup = group;
        lastTime = group === null ? null : time;
        return true;
      },
      undo: function (current) {
        breakGroup();
        if (!undoStack.length) return null;
        var present = copy(current), target = undoStack.pop();
        push(redoStack, present);
        return copy(target);
      },
      redo: function (current) {
        breakGroup();
        if (!redoStack.length) return null;
        var present = copy(current), target = redoStack.pop();
        push(undoStack, present);
        return copy(target);
      },
      breakGroup: breakGroup,
      get canUndo() { return undoStack.length > 0; },
      get canRedo() { return redoStack.length > 0; }
    });
  }

  return Object.freeze({ create: create });
}));
