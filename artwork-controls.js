(function () {
  'use strict';
  window.SignatureArtworkControls = Object.freeze({attach(settings) {
    const api = window.SignatureArtwork, core = window.SignatureCore;
    const dialog = document.createElement('dialog');
    dialog.id = 'artwork-dialog'; dialog.className = 'art-dialog'; dialog.setAttribute('aria-labelledby','art-title');
    dialog.innerHTML = `<header class="art-header"><div><p class="art-eyebrow">Shape studio</p><h2 id="art-title">Make the artwork yours</h2></div><button type="button" class="text-button" id="art-close" aria-label="Close artwork editor">Close</button></header>
      <p id="art-intro" class="art-intro"></p>
      <div class="art-body"><section class="art-editor" aria-labelledby="art-edit-heading"><div class="art-study-bar"><div><label for="art-study" id="art-edit-heading">Starting study</label><select id="art-study"></select></div><button type="button" class="button button-secondary" id="art-variation">New variation</button></div>
      <p class="art-study-description" id="art-study-description"></p>
      <div class="art-workbench"><div class="art-grid-column"><div class="art-grid-scroll" id="art-grid-scroll"><div id="art-grid" class="art-grid" role="grid" aria-label="Editable artwork grid" aria-describedby="art-grid-help"></div></div><div class="art-grid-pan" id="art-grid-pan" hidden><button type="button" id="art-pan-left" aria-label="Show earlier artwork columns">←</button><span>View columns</span><button type="button" id="art-pan-right" aria-label="Show later artwork columns">→</button></div><p class="art-grid-caption" id="art-grid-caption"></p></div>
      <div class="art-tools"><h3>Paint with</h3><div id="art-inks" class="art-inks" role="group" aria-label="Select an ink"></div><button type="button" id="art-eraser" class="art-eraser" aria-pressed="false"><span aria-hidden="true">◇</span> Eraser</button>
      <div class="art-color-editor" id="art-color-editor"><label for="art-color" id="art-color-label">Ink 1 color</label><div class="art-color-fields"><input type="color" id="art-color" aria-label="Choose ink 1 color"><input type="text" id="art-hex" aria-label="Ink 1 hex color" maxlength="7" spellcheck="false" autocomplete="off" placeholder="#2348c7"></div></div>
      <div class="art-transform"><h3>Transform</h3><button type="button" class="button button-secondary" id="art-mirror-h">Mirror left / right</button><button type="button" class="button button-secondary" id="art-mirror-v">Mirror top / bottom</button></div>
      <div class="art-history"><button type="button" class="button button-secondary" id="art-undo" disabled>Undo</button><button type="button" class="button button-secondary" id="art-redo" disabled>Redo</button></div><button type="button" class="text-button art-reset" id="art-reset">Reset to opening study</button></div></div>
      <p id="art-grid-help" class="art-grid-help">Drag to paint. With the grid focused, use arrow keys to move, Space or Enter to paint, and Delete to erase.</p></section>
      <section class="art-preview-column" aria-labelledby="art-preview-heading"><div class="art-preview-heading"><h3 id="art-preview-heading">In your signature</h3><span>Live preview</span></div><div class="art-preview-shell"><div id="art-preview-stage" class="art-preview-stage"><div id="art-preview" class="art-preview"></div></div><p id="art-preview-empty" class="art-preview-empty" hidden>Resolve the message below to see this version.</p></div><p id="art-space-note" class="art-space-note" hidden>This photo and layout leave no room to show the artwork. Your editable study is kept; it will appear when space is available.</p><p class="art-preview-note">Your text, layout and photo stay as they are. Changes appear in the main editor when you apply.</p></section></div>
      <footer class="art-footer"><div class="art-feedback"><p id="art-status" role="status" aria-live="polite"></p><p id="art-budget" class="art-budget"></p></div><div class="art-footer-actions"><button type="button" class="button button-secondary" id="art-cancel">Cancel</button><button type="button" class="button button-primary" id="art-apply" disabled>Apply artwork</button></div></footer>`;
    document.body.append(dialog);
    const $ = id => dialog.querySelector('#' + id), grid = $('art-grid');
    let base = null, state = null, original = null, proposal = null, opener = null;
    let undo = [], redo = [], selectedInk = '0', focusedCell = 0, stroke = null, colorEdit = null, invalidHex = false, frame = null, destroyed = false;
    const snapshot = () => ({recipe:api.clone(state.recipe),studyId:state.studyId,seed:state.seed});
    const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
    function notice(message, error = false) { $('art-status').textContent = message; $('art-status').dataset.error = String(error); }
    function record(before) {
      if (same(before,snapshot())) return;
      undo.push(before); if (undo.length > 80) undo.shift(); redo = [];
    }
    function commitColor() {
      if (!colorEdit) return;
      const before = colorEdit; colorEdit = null; record(before); updateHistory();
    }
    function finishStroke() {
      if (!stroke) return;
      const previous = stroke; stroke = null;
      if (grid.hasPointerCapture(previous.id)) grid.releasePointerCapture(previous.id);
      record(previous.before); updateHistory();
    }
    function updateHistory() { $('art-undo').disabled = !undo.length; $('art-redo').disabled = !redo.length; }
    function setFocus(index, focus = false) {
      const cells = grid.querySelectorAll('[data-cell]');
      focusedCell = Math.max(0,Math.min(cells.length - 1,index));
      cells.forEach((cell,i) => { cell.tabIndex = i === focusedCell ? 0 : -1; });
      if (focus && cells[focusedCell]) cells[focusedCell].focus({preventScroll:true});
    }
    function buildGrid() {
      const {rows} = state.recipe, cols = rows[0].length;
      grid.style.setProperty('--art-cols',cols); grid.setAttribute('aria-rowcount',rows.length); grid.setAttribute('aria-colcount',cols);
      grid.replaceChildren(...rows.map((row,y) => {
        const element = document.createElement('div'); element.className = 'art-grid-row'; element.setAttribute('role','row');
        for (let x = 0; x < cols; x++) {
          const button = document.createElement('button'); button.type = 'button'; button.dataset.cell = String(y * cols + x); button.setAttribute('role','gridcell'); button.setAttribute('aria-rowindex',y + 1); button.setAttribute('aria-colindex',x + 1); element.append(button);
        }
        return element;
      }));
      $('art-grid-caption').textContent = cols + ' × ' + rows.length + ' cells · transparent gaps';
      setFocus(focusedCell);
    }
    function updateGrid() {
      const {rows,palette} = state.recipe, cols = rows[0].length;
      grid.querySelectorAll('[data-cell]').forEach((cell,index) => {
        const y = Math.floor(index / cols), x = index % cols, ink = rows[y][x];
        cell.style.backgroundColor = ink === '.' ? '' : palette[Number(ink)];
        cell.dataset.transparent = String(ink === '.');
        cell.setAttribute('aria-label','Row ' + (y + 1) + ', column ' + (x + 1) + ': ' + (ink === '.' ? 'transparent' : 'ink ' + (Number(ink) + 1) + ', ' + palette[Number(ink)]));
      });
      updatePan();
    }
    function updatePan() {
      const viewport = $('art-grid-scroll'), overflow = viewport.scrollWidth - viewport.clientWidth;
      $('art-grid-pan').hidden = overflow < 2;
      $('art-pan-left').disabled = viewport.scrollLeft < 1;
      $('art-pan-right').disabled = viewport.scrollLeft >= overflow - 1;
    }
    function updatePalette() {
      const colors = state.recipe.palette;
      if (selectedInk !== '.' && Number(selectedInk) >= colors.length) selectedInk = '0';
      if ($('art-inks').children.length !== colors.length) $('art-inks').replaceChildren(...colors.map((color,index) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'art-ink'; button.dataset.ink = index; button.innerHTML = '<span aria-hidden="true"></span><b>' + (index + 1) + '</b>'; return button;
      }));
      Array.from($('art-inks').children).forEach((button,index) => {
        button.style.setProperty('--art-ink',colors[index]); button.setAttribute('aria-label','Paint with ink ' + (index + 1) + ', ' + colors[index]); button.setAttribute('aria-pressed',String(selectedInk === String(index)));
      });
      $('art-eraser').setAttribute('aria-pressed',String(selectedInk === '.'));
      $('art-color-editor').hidden = selectedInk === '.';
      if (selectedInk !== '.') {
        const number = Number(selectedInk) + 1, color = colors[Number(selectedInk)];
        $('art-color-label').textContent = 'Ink ' + number + ' color'; $('art-color').setAttribute('aria-label','Choose ink ' + number + ' color'); $('art-hex').setAttribute('aria-label','Ink ' + number + ' hex color');
        if (document.activeElement !== $('art-color')) $('art-color').value = color;
        if (document.activeElement !== $('art-hex') && !invalidHex) $('art-hex').value = color;
      }
    }
    function fitPreview() {
      if (!proposal || !dialog.open) return;
      const draft = proposal.candidate, width = draft.layout === 'paired' ? draft.width * 2 + 20 : draft.width, height = draft.layout === 'paired' ? draft.height : draft.height * 2 + 20;
      const scale = Math.min(1,Math.max(1,$('art-preview-stage').clientWidth) / width);
      $('art-preview').style.width = width + 'px'; $('art-preview').style.height = height + 'px'; $('art-preview').style.transform = 'scale(' + scale + ')'; $('art-preview-stage').style.height = height * scale + 'px';
    }
    function preview() {
      frame = null; if (!dialog.open || !state) return;
      proposal = null; $('art-apply').disabled = true;
      if (invalidHex) {
        $('art-preview').replaceChildren(); $('art-preview-stage').hidden = true; $('art-preview-empty').hidden = false; $('art-space-note').hidden = true;
        $('art-budget').textContent = 'Complete the color to update the preview';
        notice('Finish the ink color with # and six hexadecimal digits.',true); return;
      }
      try {
        const next = api.createProposal(state.recipe,base);
        // An outside edit must never be overwritten by a dialog left open.
        api.applyProposal(next,settings.getDraft());
        const html = core.render(next.candidate,{preview:true,assetBase:'./sig'});
        proposal = next; $('art-preview').innerHTML = html; $('art-preview-stage').hidden = false; $('art-preview-empty').hidden = true;
        $('art-space-note').hidden = !!$('art-preview').querySelector('colgroup');
        $('art-budget').textContent = next.characters.toLocaleString() + ' / 10,000 HTML characters';
        $('art-budget').dataset.near = String(next.characters >= 9500);
        $('art-apply').disabled = false;
        notice(next.characters >= 9500 ? 'Close to the email size limit. Keep the remaining marks simple.' : 'Ready to apply. You can undo the result in the main editor.');
        fitPreview();
      } catch (error) {
        $('art-preview').replaceChildren(); $('art-preview-stage').hidden = true; $('art-preview-empty').hidden = false; $('art-space-note').hidden = true;
        $('art-budget').textContent = /10,000|too long|simplify/i.test(error.message || '') ? 'Email size limit: fewer than 10,000 HTML characters' : 'Preview unavailable';
        notice(error.message || 'This artwork could not be previewed.',true);
      }
    }
    function schedulePreview() { if (frame !== null) cancelAnimationFrame(frame); frame = requestAnimationFrame(preview); }
    function refresh(rebuild = false) {
      if (rebuild || grid.children.length !== state.recipe.rows.length || Number(grid.getAttribute('aria-colcount')) !== state.recipe.rows[0].length) buildGrid();
      updateGrid(); updatePalette(); updateHistory();
      $('art-study').value = state.studyId;
      $('art-study-description').textContent = (api.studies.find(item => item.id === state.studyId) || {description:'Your saved grid, with every ink and cell preserved. Choose a starting study for new variations.'}).description;
      $('art-variation').disabled = !state.studyId;
      $('art-hex').setAttribute('aria-invalid',String(invalidHex));
      schedulePreview();
    }
    function change(next, replacePalette = false) {
      finishStroke(); commitColor(); const before = snapshot(); state = next; if (replacePalette) invalidHex = false; record(before); refresh(true);
    }
    function restore(next) { state = {recipe:api.clone(next.recipe),studyId:next.studyId,seed:next.seed}; invalidHex = false; refresh(true); }
    function moveHistory(direction) {
      finishStroke(); commitColor(); invalidHex = false;
      const source = direction === 'undo' ? undo : redo, target = direction === 'undo' ? redo : undo;
      if (!source.length) { refresh(); return; }
      target.push(snapshot()); restore(source.pop());
    }
    function chooseInk(ink) { finishStroke(); commitColor(); invalidHex = false; selectedInk = ink; updatePalette(); $('art-hex').removeAttribute('aria-invalid'); schedulePreview(); }
    function open() {
      if (destroyed || dialog.open) return;
      try {
        opener = document.activeElement; base = {...settings.getDraft()}; const loaded = api.fromDraft(base);
        state = {recipe:loaded.recipe,studyId:loaded.studyId,seed:0}; original = snapshot(); undo = []; redo = []; selectedInk = '0'; focusedCell = 0; invalidHex = false; proposal = null;
        $('art-study').replaceChildren(...[{id:'',name:'Your current artwork'},...api.studies].map(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; option.disabled = item.id === ''; return option; }));
        $('art-intro').textContent = loaded.isCustom ? 'Edit your saved side detail, one ink or shape at a time. Nothing changes until you apply.' : 'Draw a new side detail from editable shapes. Apply replaces the current artwork with this smaller motif. To move or resize a full-canvas study, use Artwork placement in Design.';
        $('art-reset').textContent = loaded.isCustom ? 'Reset to opening artwork' : 'Reset to opening study';
        dialog.showModal(); refresh(true); $('art-study').focus();
      } catch (error) { if (settings.onError) settings.onError(error.message || 'The artwork editor could not open.'); }
    }
    function cleanup() {
      finishStroke(); commitColor(); if (frame !== null) cancelAnimationFrame(frame); frame = null; proposal = null;
      if (opener && opener.isConnected) opener.focus();
    }
    function cellAt(event) {
      const rect = grid.getBoundingClientRect(), viewport = $('art-grid-scroll').getBoundingClientRect();
      if (event.clientX < viewport.left || event.clientX >= viewport.right || event.clientY < viewport.top || event.clientY >= viewport.bottom) return null;
      const cols = state.recipe.rows[0].length, rows = state.recipe.rows.length;
      const x = Math.floor((event.clientX - rect.left) / (rect.width / cols)), y = Math.floor((event.clientY - rect.top) / (rect.height / rows));
      return x >= 0 && y >= 0 && x < cols && y < rows ? {x,y} : null;
    }
    grid.addEventListener('pointerdown',event => {
      if (!dialog.open || event.button !== 0 || stroke) return;
      const cell = cellAt(event); if (!cell) return;
      event.preventDefault(); commitColor(); stroke = {id:event.pointerId,before:snapshot(),last:cell,ink:selectedInk};
      grid.setPointerCapture(event.pointerId); setFocus(cell.y * state.recipe.rows[0].length + cell.x,true);
      state.recipe = api.paint(state.recipe,cell.x,cell.y,stroke.ink); refresh();
    });
    grid.addEventListener('pointermove',event => {
      if (!stroke || stroke.id !== event.pointerId) return;
      const cell = cellAt(event);
      if (!cell) { stroke.last = null; return; }
      if (same(cell,stroke.last)) return;
      state.recipe = stroke.last ? api.paintLine(state.recipe,stroke.last,cell,stroke.ink) : api.paint(state.recipe,cell.x,cell.y,stroke.ink);
      stroke.last = cell; setFocus(cell.y * state.recipe.rows[0].length + cell.x); refresh();
    });
    for (const event of ['pointerup','pointercancel','lostpointercapture']) grid.addEventListener(event,value => { if (stroke && stroke.id === value.pointerId) finishStroke(); });
    grid.addEventListener('focusin',event => { const button = event.target.closest('[data-cell]'); if (button) setFocus(Number(button.dataset.cell)); });
    grid.addEventListener('keydown',event => {
      const cols = state.recipe.rows[0].length, count = cols * state.recipe.rows.length;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) {
        event.preventDefault(); const row = Math.floor(focusedCell / cols);
        const next = event.key === 'ArrowLeft' ? Math.max(row * cols,focusedCell - 1) : event.key === 'ArrowRight' ? Math.min((row + 1) * cols - 1,focusedCell + 1) : event.key === 'ArrowUp' ? (focusedCell >= cols ? focusedCell - cols : focusedCell) : event.key === 'ArrowDown' ? (focusedCell + cols < count ? focusedCell + cols : focusedCell) : event.key === 'Home' ? (event.ctrlKey ? 0 : row * cols) : (event.ctrlKey ? count - 1 : (row + 1) * cols - 1);
        setFocus(next,true); grid.querySelector('[tabindex="0"]').scrollIntoView({block:'nearest',inline:'nearest'}); return;
      }
      if ([' ','Enter','Delete','Backspace'].includes(event.key)) {
        event.preventDefault(); const before = snapshot(); state.recipe = api.paint(state.recipe,focusedCell % cols,Math.floor(focusedCell / cols),['Delete','Backspace'].includes(event.key) ? '.' : selectedInk); record(before); refresh();
      }
    });
    grid.addEventListener('click',event => {
      // Assistive technology activates grid cells without a pointer sequence.
      // Physical painting is handled by pointerdown; keydown cancels its default.
      const cell = event.target.closest('[data-cell]');
      if (!cell || event.detail !== 0) return;
      finishStroke(); commitColor(); setFocus(Number(cell.dataset.cell));
      const cols = state.recipe.rows[0].length, before = snapshot();
      state.recipe = api.paint(state.recipe,focusedCell % cols,Math.floor(focusedCell / cols),selectedInk); record(before); refresh();
    });
    dialog.addEventListener('keydown',event => {
      if ((event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())) {
        event.stopPropagation();
        if (event.target === $('art-hex')) return;
        event.preventDefault(); moveHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
      }
    });
    $('art-inks').addEventListener('click',event => { const button = event.target.closest('[data-ink]'); if (button) chooseInk(button.dataset.ink); });
    $('art-eraser').addEventListener('click',() => chooseInk('.'));
    $('art-grid-scroll').addEventListener('scroll',updatePan);
    $('art-pan-left').addEventListener('click',() => { $('art-grid-scroll').scrollLeft -= 96; updatePan(); });
    $('art-pan-right').addEventListener('click',() => { $('art-grid-scroll').scrollLeft += 96; updatePan(); });
    for (const id of ['art-color','art-hex']) {
      $(id).addEventListener('focus',() => { if (!colorEdit) colorEdit = snapshot(); });
      $(id).addEventListener('input',() => {
        if (selectedInk === '.') return;
        if (!colorEdit) colorEdit = snapshot();
        const value = $(id).value.trim(); invalidHex = !/^#[0-9a-f]{6}$/i.test(value);
        if (!invalidHex) {
          state.recipe = api.setColor(state.recipe,Number(selectedInk),value);
          $(id === 'art-color' ? 'art-hex' : 'art-color').value = value;
        }
        refresh();
      });
      $(id).addEventListener('change',commitColor); $(id).addEventListener('blur',commitColor);
    }
    $('art-study').addEventListener('change',() => { const id = $('art-study').value; if (id) change({recipe:api.createStudy(id,0),studyId:id,seed:0},true); });
    $('art-variation').addEventListener('click',() => {
      if (!state.studyId) return;
      const id = state.studyId, seed = state.seed + 1, recipe = api.createStudy(id,seed);
      if (state.recipe.palette.length >= recipe.palette.length) recipe.palette = state.recipe.palette.slice();
      change({recipe:recipe,studyId:id,seed:seed});
    });
    $('art-mirror-h').addEventListener('click',() => change({...state,recipe:api.mirror(state.recipe,'horizontal')}));
    $('art-mirror-v').addEventListener('click',() => change({...state,recipe:api.mirror(state.recipe,'vertical')}));
    $('art-reset').addEventListener('click',() => change({recipe:api.clone(original.recipe),studyId:original.studyId,seed:original.seed},true));
    $('art-undo').addEventListener('click',() => moveHistory('undo')); $('art-redo').addEventListener('click',() => moveHistory('redo'));
    for (const id of ['art-close','art-cancel']) $(id).addEventListener('click',() => dialog.close());
    dialog.addEventListener('close',cleanup);
    $('art-apply').addEventListener('click',() => {
      finishStroke(); commitColor(); if (frame !== null) cancelAnimationFrame(frame); preview();
      if (!proposal) return;
      try { settings.applyChanges(api.applyProposal(proposal,settings.getDraft())); dialog.close(); }
      catch (error) { $('art-apply').disabled = true; notice(error.message || 'The artwork could not be applied.',true); }
    });
    const launch = event => { const button = event.target.closest('[data-edit-artwork]'); if (button) { event.preventDefault(); open(); } };
    document.addEventListener('click',launch);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { fitPreview(); if (state) updatePan(); }) : null;
    if (observer) { observer.observe($('art-preview-stage')); observer.observe($('art-grid-scroll')); }
    return Object.freeze({open,destroy() { destroyed = true; document.removeEventListener('click',launch); if (observer) observer.disconnect(); if (dialog.open) dialog.close(); cleanup(); dialog.remove(); }});
  }});
}());
