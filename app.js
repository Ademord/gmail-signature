/* Browser-only editor. All exported markup comes from SignatureCore. */
(() => {
  'use strict';
  const core = window.SignatureCore;
  const $ = (id) => document.getElementById(id);
  const form = $('editor-form');
  const iconKeys = ['websiteIcon', 'emailIcon', 'phoneIcon', 'linkedinIcon', 'locationIcon'];
  for (const key of iconKeys) {
    for (const [value, label] of Object.entries(core.icons)) {
      const option = document.createElement('option'); option.value = value; option.textContent = label;
      $(key).append(option);
    }
  }
  function syncIcons() {
    for (const key of iconKeys) {
      const value = $(key).value, hidden = value === 'none' || !Object.hasOwn(core.icons, value);
      $(key + '-preview').hidden = hidden;
      $(key + '-none').hidden = !hidden;
      if (!hidden) $(key + '-preview').src = 'sig/icon-' + value + '.png';
    }
  }
  const storageKey = 'signature-studio:draft:v1';
  const themeStorageKey = 'signature-studio:themes:v1';
  const colorKeys = ['frontBackground', 'backBackground', 'accent'];
  const hexColor = /^#[0-9a-f]{6}$/i;
  const presets = [
    { id: 'preset-original', name: 'Original', frontBackground: '#f3f0ea', backBackground: '#1c1c1c', accent: '#c8362a' },
    { id: 'preset-midnight', name: 'Midnight', frontBackground: '#172333', backBackground: '#edf1f5', accent: '#d66942' },
    { id: 'preset-spruce', name: 'Spruce', frontBackground: '#edf2ea', backBackground: '#1d392f', accent: '#a64435' }
  ];
  let themes = [], selectedThemeId = '', pendingSessionPersistence = false;
  const themeNotice = (message, error = false) => {
    $('theme-notice').textContent = message;
    $('theme-notice').dataset.error = String(error);
  };
  try {
    const raw = localStorage.getItem(themeStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.themes)) throw new Error('Invalid themes');
      const usedIds = new Set(presets.map(theme => theme.id));
      const usedNames = new Set(presets.map(theme => theme.name.toLowerCase()));
      for (const entry of parsed.themes) {
        if (!entry || typeof entry !== 'object' || !/^[a-z\d-]{1,80}$/i.test(entry.id) ||
          typeof entry.name !== 'string' || !entry.name.trim() || entry.name.trim().length > 40 ||
          colorKeys.some(key => typeof entry[key] !== 'string' || !hexColor.test(entry[key])) ||
          usedIds.has(entry.id) || usedNames.has(entry.name.trim().toLowerCase())) continue;
        usedIds.add(entry.id); usedNames.add(entry.name.trim().toLowerCase());
        const saved = { id: entry.id, name: entry.name.trim(), ...Object.fromEntries(colorKeys.map(key => [key, entry[key].toLowerCase()])) };
        if (typeof entry.importedFromName === 'string' && entry.importedFromName.trim() &&
          entry.importedFromName.trim().length <= 40 && !/[\u0000-\u001f\u007f]/.test(entry.importedFromName)) {
          saved.importedFromName = entry.importedFromName.trim();
        }
        themes.push(saved);
      }
    }
  } catch { themeNotice('Saved themes could not be loaded. Your signature draft is still available.', true); }
  const status = $('status');
  const previewCopy = document.createElement('button');
  previewCopy.id = 'copy-preview';
  previewCopy.type = 'button';
  previewCopy.className = 'button button-primary';
  previewCopy.textContent = 'Copy signature';
  document.querySelector('.preview-actions > div').prepend(previewCopy);
  const imageButton = document.createElement('button');
  imageButton.id = 'export-image'; imageButton.type = 'button'; imageButton.className = 'button button-secondary image-export-button';
  imageButton.innerHTML = '<svg viewBox="0 0 18 18" width="17" height="17" fill="none" aria-hidden="true"><rect x="2" y="2.5" width="14" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3"/><circle cx="6" cy="6.5" r="1.2" stroke="currentColor" stroke-width="1.2"/><path d="m3 14 4-4 2.5 2 3-4 2.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Export image</span><span class="format-badge">HD</span>';
  document.querySelector('.preview-actions > div').append(imageButton);
  let draft = { ...core.defaults }, lastValid = null, view = 'card', activeTab = 'details', undoDraft = null;
  const editHistory = window.EditorHistory.create();
  function syncHistory() {
    $('undo-change').disabled = !editHistory.canUndo;
    $('redo-change').disabled = !editHistory.canRedo;
  }
  function recordEdit(before, group) {
    editHistory.record(before, draft, { group }); syncHistory();
  }
  function travelHistory(direction) {
    const restored = editHistory[direction](draft);
    if (!restored) return;
    draft = restored; preserveUnreadableDraft = false;
    fill(); render(); save(); syncHistory();
    if (!Object.keys(core.validate(draft)).length) announce(direction === 'undo' ? 'Change undone.' : 'Change redone.');
  }
  $('undo-change').addEventListener('click', () => travelHistory('undo'));
  $('redo-change').addEventListener('click', () => travelHistory('redo'));
  let startupMessage = '', preserveUnreadableDraft = false;
  const announce = (message, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
  };
  const decode = (value) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
  const encode = (value) => btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)), c => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid draft');
      const normalized = core.normalize(parsed);
      draft = normalized;
      if (Object.keys(core.validate(normalized)).length) startupMessage = 'Your saved draft needs an adjustment. Check the highlighted field.';
    }
  } catch { preserveUnreadableDraft = true; startupMessage = 'The saved draft could not be read and has been left in storage. Edit the example to start a new draft.'; }
  function loadLink(remember = false) {
    if (!location.hash.startsWith('#v=')) return false;
    try {
      if (location.hash.length > 16000) throw new Error('Link too long');
      const imported = decode(location.hash.slice(3));
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Invalid draft');
      const normalized = core.normalize(imported);
      if (Object.keys(core.validate(normalized)).length) throw new Error('Invalid draft');
      const before = { ...draft }; draft = normalized;
      if (remember) recordEdit(before);
      preserveUnreadableDraft = false;
      startupMessage = 'Draft loaded from the link.';
    } catch { startupMessage = 'That draft link is invalid. Your current draft is still here.'; }
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  }
  loadLink();
  const palette = () => Object.fromEntries(colorKeys.map(key => [key, String(draft[key]).toLowerCase()]));
  const themeById = id => [...presets, ...themes].find(theme => theme.id === id);
  const matchesColors = theme => colorKeys.every(key => theme[key] === String(draft[key]).toLowerCase());
  function syncColors() {
    for (const key of colorKeys) {
      const value = String(draft[key]);
      $(key + '-hex').value = value.toUpperCase();
      if (hexColor.test(value)) $(key).value = value;
    }
  }
  function syncThemeState() {
    const selected = themeById(selectedThemeId);
    const editable = themes.some(theme => theme.id === selectedThemeId);
    $('update-theme').disabled = !editable;
    $('delete-theme').disabled = !editable;
    $('theme-state').textContent = selected ? (matchesColors(selected) ? selected.name : selected.name + ' · Modified') : 'Custom colors';
  }
  function renderThemeMenu(id) {
    selectedThemeId = id === undefined ? ([...themes, ...presets].find(matchesColors)?.id || '') : id;
    const select = $('theme-select');
    select.innerHTML = '';
    const option = (value, text) => { const item = document.createElement('option'); item.value = value; item.textContent = text; return item; };
    select.append(option('', 'Custom colors'));
    for (const theme of presets) select.append(option(theme.id, theme.name));
    if (themes.length) {
      const group = document.createElement('optgroup'); group.label = 'Saved themes';
      for (const theme of themes) group.append(option(theme.id, theme.name));
      select.append(group);
    }
    select.value = selectedThemeId;
    $('theme-name').value = themes.find(theme => theme.id === selectedThemeId)?.name || '';
    syncThemeState();
  }
  function commitThemes(next) {
    try {
      localStorage.setItem(themeStorageKey, JSON.stringify({ version: 1, themes: next }));
      themes = next;
      return true;
    } catch {
      themeNotice('Theme not saved. Browser storage is unavailable. Copy a draft link to keep these colors.', true);
      return false;
    }
  }
  function saveTheme(update) {
    const current = palette();
    if (colorKeys.some(key => !hexColor.test(current[key]))) {
      themeNotice('Enter a valid six-digit hex code for each color.', true);
      return;
    }
    const existing = update ? themes.find(theme => theme.id === selectedThemeId) : null;
    if (update && !existing) return;
    const name = $('theme-name').value.trim();
    const duplicate = [...presets, ...themes].some(theme => theme.id !== existing?.id && theme.name.toLowerCase() === name.toLowerCase());
    if (!name || name.length > 40 || duplicate) {
      $('theme-name').setAttribute('aria-invalid', 'true');
      themeNotice(duplicate ? 'That name is already used. Choose another name, or update the selected theme.' : 'Give the theme a name of 1–40 characters.', true);
      $('theme-name').focus();
      return;
    }
    const entry = { id: existing?.id || 'theme-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8), name, ...current };
    const next = existing ? themes.map(theme => theme.id === existing.id ? entry : theme) : [...themes, entry];
    if (!commitThemes(next)) return;
    $('theme-name').setAttribute('aria-invalid', 'false');
    renderThemeMenu(entry.id);
    themeNotice((existing ? 'Updated ' : 'Saved ') + name + '.');
  }
  $('theme-select').addEventListener('change', () => {
    selectedThemeId = $('theme-select').value;
    const selected = themeById(selectedThemeId);
    if (selected) {
      const before = { ...draft };
      Object.assign(draft, Object.fromEntries(colorKeys.map(key => [key, selected[key]])));
      recordEdit(before);
      syncColors(); render(); save();
    }
    $('theme-name').value = themes.find(theme => theme.id === selectedThemeId)?.name || '';
    $('theme-name').setAttribute('aria-invalid', 'false');
    syncThemeState(); themeNotice('');
  });
  $('save-theme').addEventListener('click', () => saveTheme(false));
  $('update-theme').addEventListener('click', () => saveTheme(true));
  $('delete-theme').addEventListener('click', () => {
    const deleted = themes.find(theme => theme.id === selectedThemeId);
    if (!deleted) return;
    const previous = themes;
    if (!commitThemes(themes.filter(theme => theme.id !== deleted.id))) return;
    renderThemeMenu('');
    themeNotice('Deleted ' + deleted.name + '. ');
    const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'text-button'; undo.textContent = 'Undo';
    undo.addEventListener('click', () => {
      if (!commitThemes(previous)) return;
      renderThemeMenu(deleted.id); themeNotice('Restored ' + deleted.name + '.');
    });
    $('theme-notice').append(undo);
  });
  function fill() {
    for (const key of Object.keys(core.defaults)) {
      const input = form.elements.namedItem(key);
      if (input) {
        input.value = draft[key];
        if (core.limits?.[key]) input.maxLength = core.limits[key];
      }
    }
    $('height-range').value = draft.height;
    syncColors(); syncIcons(); renderThemeMenu();
  }
  function save() {
    const note = document.querySelector('.rail-footer > span');
    if (preserveUnreadableDraft) {
      $('save-status').textContent = 'Existing draft could not be read';
      note.textContent = 'Example not saved. Existing draft left in storage.';
      note.classList.add('storage-warning');
      return;
    }
    if (Object.keys(core.validate(draft)).length) {
      $('save-status').textContent = 'Unsaved changes — check the highlighted field';
      note.textContent = 'Changes not saved. Check the highlighted field.';
      note.classList.add('storage-warning');
      return;
    }
    try {
      if (pendingSessionPersistence) localStorage.setItem(themeStorageKey, JSON.stringify({ version: 1, themes }));
      localStorage.setItem(storageKey, JSON.stringify(draft));
      pendingSessionPersistence = false;
      $('save-status').textContent = 'Saved in this browser';
      note.textContent = 'Draft saved in this browser.';
      note.classList.remove('storage-warning');
    } catch {
      $('save-status').textContent = 'Storage unavailable — download to keep a copy';
      note.textContent = 'Not saved. Download HTML to keep a copy.';
      note.classList.add('storage-warning');
      note.setAttribute('role', 'status');
    }
  }
  function setTab(name) {
    activeTab = name;
    document.querySelectorAll('[data-editor-tab]').forEach(button => {
      const active = button.dataset.editorTab === name;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-editor-panel]').forEach(panel => { panel.hidden = panel.dataset.editorPanel !== name; });
  }
  function validate(focus = false) {
    const errors = core.validate(draft);
    for (const key of Object.keys(core.defaults)) {
      const input = form.elements.namedItem(key);
      if (!input) continue;
      const message = errors[key] || '';
      input.setCustomValidity(message);
      input.setAttribute('aria-invalid', String(Boolean(message)));
      const hexInput = $(key + '-hex');
      if (hexInput) {
        hexInput.setCustomValidity(message);
        hexInput.setAttribute('aria-invalid', String(Boolean(message)));
      }
      let hint = $('error-' + key);
      if (message && !hint) {
        hint = document.createElement('small');
        hint.id = 'error-' + key;
        hint.className = 'field-error';
        input.parentElement.append(hint);
        input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), hint.id].filter(Boolean).join(' '));
        if (hexInput) hexInput.setAttribute('aria-describedby', hint.id);
      }
      if (hint) { hint.textContent = message; hint.hidden = !message; }
    }
    const keys = Object.keys(errors);
    $('copy-signature').setAttribute('aria-disabled', String(keys.length > 0));
    previewCopy.setAttribute('aria-disabled', String(keys.length > 0));
    if (focus && keys.length) {
      const input = form.elements.namedItem(keys[0]);
      if (input) {
        const panel = input.closest('[data-editor-panel]');
        if (panel) setTab(panel.dataset.editorPanel);
        input.closest('details')?.setAttribute('open', '');
        ($(keys[0] + '-hex') || input).focus();
      }
      announce(errors[keys[0]], true);
    }
    return keys.length === 0;
  }
  function fitPreview() {
    if (!lastValid) return;
    const width = lastValid.layout === 'stacked' ? lastValid.width : lastValid.width * 2 + 20;
    const height = lastValid.layout === 'stacked' ? lastValid.height * 2 + 20 : lastValid.height;
    const viewport = $('preview-viewport');
    const style = getComputedStyle(viewport);
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const emailPadding = view === 'email' ? (innerWidth <= 740 ? 24 : 40) : 0;
    const inner = viewport.clientWidth - padding;
    const available = Math.max(1, (view === 'email' ? Math.min(780, inner) : inner) - emailPadding);
    const scale = Math.min(1, available / width);
    $('signature-preview').style.width = width + 'px';
    $('signature-preview').style.transform = `scale(${scale})`;
    $('signature-preview').style.transformOrigin = 'top left';
    $('preview-sizer').style.width = (view === 'email' ? available : width * scale) + 'px';
    $('preview-sizer').style.height = (height * scale) + 'px';
    $('dimension-label').textContent = `${width} × ${height} px`;
    $('scale-label').textContent = scale < 0.995 ? `Fit · ${Math.round(scale * 100)}%` : 'Actual size · 100%';
    const column = document.querySelector('.preview-column');
    column.classList.toggle('is-tall', column.scrollHeight > innerHeight - 56);
  }
  function render() {
    if (!validate()) {
      announce('Fix the highlighted field to update the preview.', true);
      return;
    }
    try {
      lastValid = core.normalize(draft);
      const defaultAssets = lastValid.imageBase === core.defaults.imageBase;
      $('signature-preview').innerHTML = core.render(lastValid, defaultAssets ? { assetBase: './sig' } : {});
      $('signature-preview').querySelectorAll('a').forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
      const emailName = $('email-sender');
      if (emailName) emailName.textContent = [lastValid.nameLine1, lastValid.nameLine2].filter(Boolean).join(' ');
      fitPreview();
      if (status.dataset.error === 'true') announce('Preview updated.');
    } catch (error) { announce('This content does not fit. Check the fields or increase the card size.', true); }
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', event => {
    const input = event.target;
    const before = { ...draft };
    announce('');
    if (input.dataset.colorField) {
      const key = input.dataset.colorField;
      if (!colorKeys.includes(key)) return;
      draft[key] = input.value.toLowerCase();
      if (hexColor.test(draft[key])) $(key).value = draft[key];
    } else if (input.id === 'height-range') {
      draft.height = Number(input.value);
      form.elements.namedItem('height').value = input.value;
    } else if (Object.hasOwn(core.defaults, input.name)) {
      draft[input.name] = ['width', 'height'].includes(input.name) ? (input.value === '' ? '' : Number(input.value)) : input.value;
      if (input.name === 'height') $('height-range').value = input.value;
      if (colorKeys.includes(input.name)) $(input.name + '-hex').value = input.value.toUpperCase();
    } else return;
    preserveUnreadableDraft = false;
    recordEdit(before, input.tagName === 'SELECT' ? undefined : (input.dataset.colorField || (input.id === 'height-range' ? 'height' : input.name)));
    if (iconKeys.includes(input.name)) syncIcons();
    render(); save(); syncThemeState();
  });
  form.addEventListener('change', () => editHistory.breakGroup());
  form.addEventListener('focusout', () => editHistory.breakGroup());
  document.querySelectorAll('[data-editor-tab]').forEach(button => {
    button.addEventListener('click', () => setTab(button.dataset.editorTab));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...document.querySelectorAll('[data-editor-tab]')];
      const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(tabs.indexOf(button) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      setTab(next.dataset.editorTab); next.focus();
    });
  });
  function setView(name) {
    view = name;
    document.querySelectorAll('[data-view]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.view === view)); b.classList.toggle('is-active', b.dataset.view === view); });
    document.querySelector('[data-preview-view]').dataset.previewView = view;
    $('email-context').hidden = view !== 'email';
    fitPreview();
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  function legacyCopy(html, text) {
    const active = document.activeElement;
    const holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.style.cssText = 'position:fixed;left:-10000px;top:0';
    if (html) holder.innerHTML = html; else holder.textContent = text;
    document.body.append(holder);
    const selection = getSelection();
    const oldRanges = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange());
    const range = document.createRange(); range.selectNodeContents(holder);
    selection.removeAllRanges(); selection.addRange(range);
    const listener = event => {
      if (!event.clipboardData) return;
      event.preventDefault(); event.clipboardData.setData('text/plain', text);
      if (html) event.clipboardData.setData('text/html', html);
    };
    document.addEventListener('copy', listener);
    let copied = false;
    try { copied = document.execCommand('copy') === true; } catch {}
    finally {
      document.removeEventListener('copy', listener); holder.remove(); selection.removeAllRanges();
      for (const savedRange of oldRanges) { try { selection.addRange(savedRange); } catch {} }
      active?.focus({ preventScroll: true });
    }
    return copied;
  }
  async function copyContent(html, text) {
    try {
      if (html && navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      } else if (!html && navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw new Error('Use fallback');
      return true;
    } catch { return legacyCopy(html, text); }
  }
  async function copySignature() {
    if (!validate(true)) return;
    const html = core.render(draft), text = core.plainText(draft);
    if (await copyContent(html, text)) announce('Signature copied. Paste it into Gmail’s signature settings.');
    else {
      // Manual selection must copy the same public URLs as the normal export.
      $('signature-preview').innerHTML = html;
      const selection = getSelection(), range = document.createRange(); range.selectNodeContents($('signature-preview')); selection.removeAllRanges(); selection.addRange(range);
      announce('Clipboard access was blocked. The signature is selected: press Ctrl+C (⌘C on Mac), or download HTML.', true);
    }
  }
  $('copy-signature').addEventListener('click', copySignature);
  previewCopy.addEventListener('click', copySignature);
  $('download-html').addEventListener('click', () => {
    if (!validate(true)) return;
    const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email signature</title><body>' + core.render(draft) + '</body></html>';
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'my-signature.html'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Download requested. Open my-signature.html from your downloads to select and copy it.');
  });
  $('share-link').title = 'Copy a link containing all the details in this draft. Anyone with the link can read them.';
  $('share-link').addEventListener('click', async () => {
    if (!validate(true)) return;
    const link = new URL(location.href); link.hash = 'v=' + encode(core.normalize(draft));
    if (await copyContent(null, link.href)) announce('Draft link copied. It contains your details; share it only with people you choose.');
    else announce('Clipboard access was blocked. Download HTML to keep a copy.', true);
  });
  $('reset-draft').addEventListener('click', () => {
    preserveUnreadableDraft = false;
    undoDraft = { ...draft }; draft = { ...core.defaults }; recordEdit(undoDraft); fill(); render(); save();
    announce('Example restored. ');
    const undo = document.createElement('button'); undo.type = 'button'; undo.textContent = 'Undo'; undo.className = 'text-button';
    undo.addEventListener('click', () => { travelHistory('undo'); undoDraft = null; });
    status.append(undo);
  });
  $('install-help').addEventListener('click', () => $('help-dialog').showModal());
  $('help-dialog').querySelectorAll('[data-close-dialog], .dialog-close, #close-help').forEach(button => button.addEventListener('click', () => $('help-dialog').close()));
  new ResizeObserver(fitPreview).observe($('preview-viewport'));
  addEventListener('hashchange', () => {
    if (!loadLink(true)) return;
    fill(); render(); save(); announce(startupMessage);
  });
  window.SignatureImage.attach({ getDraft: () => ({ ...draft }), validate: () => validate(true) });
  function getSession() {
    return { draft: { ...draft }, themes: themes.map(theme => ({ ...theme })), ui: {
      editorTab: activeTab, previewView: view, imageScale: Number($('image-scale').value), imageBackground: $('image-background').value,
      selectedThemeId, themeName: $('theme-name').value
    } };
  }
  function restoreSession(session) {
    const merged = window.SignatureSession.mergeThemes(themes, session.themes, session.ui.selectedThemeId);
    const before = { ...draft }, previousStorage = new Map();
    let stored = false;
    try {
      for (const key of [themeStorageKey, storageKey]) previousStorage.set(key, localStorage.getItem(key));
      localStorage.setItem(themeStorageKey, JSON.stringify({ version: 1, themes: merged.themes }));
      localStorage.setItem(storageKey, JSON.stringify(session.draft));
      stored = true;
    } catch {
      for (const [key, value] of previousStorage) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch {}
      }
    }
    draft = { ...session.draft }; themes = merged.themes; pendingSessionPersistence = !stored;
    preserveUnreadableDraft = false; recordEdit(before);
    fill(); renderThemeMenu(merged.selectedThemeId);
    $('theme-name').value = session.ui.themeName;
    $('image-scale').value = session.ui.imageScale; $('image-background').value = session.ui.imageBackground;
    setTab(session.ui.editorTab); setView(session.ui.previewView); render();
    const note = document.querySelector('.rail-footer > span');
    $('save-status').textContent = stored ? 'Saved in this browser' : 'Session restored for this tab only';
    note.textContent = stored ? 'Draft saved in this browser.' : 'Not saved. Export data to keep this session.';
    note.classList.toggle('storage-warning', !stored);
    themeNotice('');
    announce(stored ? 'Session restored. Added ' + merged.added + ' saved theme' + (merged.added === 1 ? '.' : 's.') : 'Session restored for this tab. Browser storage is unavailable; export data to keep it.', !stored);
  }
  window.SessionControls.attach({ getSession, restore: restoreSession, copy: text => copyContent(null, text), onError: message => { validate(true); announce(message, true); } });
  fill(); render(); save(); syncHistory();
  if (startupMessage) announce(startupMessage);
})();
