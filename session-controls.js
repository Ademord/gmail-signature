/* Session-file controls. Parsing and restoration happen before any data changes. */
(function () {
  'use strict';
  window.SessionControls = Object.freeze({ attach: function (settings) {
    const $ = id => document.getElementById(id), codec = window.SignatureSession;
    const dialog = $('session-dialog');
    let mode = 'export', parsed = null, revision = 0;
    const selection = () => ({information:$('session-import-information').checked,design:$('session-import-design').checked});
    function inspect() {
      parsed = null; $('session-restore').disabled = true;
      $('session-notice').dataset.error = 'false';
      if (!$('session-json').value.trim()) { $('session-notice').textContent = 'Choose a JSON file or paste your backup below.'; return; }
      try {
        const imported = codec.parsePasted($('session-json').value), parts = selection();
        parsed = codec.selectParts(imported.session,settings.getSession(),parts);
        const label = parts.information && parts.design ? 'Information and design ready to import.' : parts.information ? 'Information ready. Your current design and saved themes will stay.' : 'Design ready. Your current information and photo will stay.';
        $('session-notice').textContent = label + (imported.repairs.length ? ' Cleaned copied text: ' + imported.repairs.join(' ') : '');
        $('session-restore').disabled = false;
      } catch (error) { $('session-notice').textContent = error.message; $('session-notice').dataset.error = 'true'; }
    }
    function open(nextMode) {
      let text = '';
      if (nextMode === 'export') {
        try { text = codec.serialize(settings.getSession()); }
        catch (error) { settings.onError(error.message); return; }
      }
      ++revision; mode = nextMode; parsed = null;
      $('session-title').textContent = mode === 'export' ? 'Export session' : 'Import session';
      $('session-description').textContent = mode === 'export' ? 'Save your signature, themes, and view settings in one JSON file.' : 'Choose what to bring in. Everything else stays as it is.';
      $('session-import-parts').hidden = mode !== 'import';
      $('session-import-information').checked = true; $('session-import-design').checked = true;
      $('session-file-field').hidden = mode !== 'import';
      $('session-download').hidden = mode !== 'export';
      $('session-copy').hidden = mode !== 'export';
      $('session-restore').hidden = mode !== 'import';
      $('session-json').readOnly = mode === 'export';
      $('session-json').value = text; $('session-file').value = '';
      $('session-restore').disabled = true;
      if (mode === 'import') inspect();
      else { $('session-notice').textContent = 'Ready to save. Use Import data to restore this file later.'; $('session-notice').dataset.error = 'false'; }
      dialog.showModal();
    }
    $('export-data').addEventListener('click', () => open('export'));
    $('import-data').addEventListener('click', () => open('import'));
    $('close-session').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { ++revision; parsed = null; });
    $('session-json').addEventListener('input', () => { ++revision; if (mode === 'import') inspect(); });
    for (const id of ['session-import-information','session-import-design']) $(id).addEventListener('change', () => { if (mode === 'import') inspect(); });
    $('session-file').addEventListener('change', async () => {
      const request = ++revision, file = $('session-file').files[0];
      if (!file) return;
      parsed = null; $('session-restore').disabled = true;
      try {
        if (file.size > 1024 * 1024) throw new Error('Choose a session JSON file smaller than 1 MB.');
        const text = await file.text();
        if (request !== revision || !dialog.open) return;
        $('session-json').value = text; inspect();
      } catch (error) {
        if (request !== revision || !dialog.open) return;
        $('session-json').value = ''; $('session-notice').textContent = error.message || 'The file could not be read.'; $('session-notice').dataset.error = 'true';
      }
    });
    $('session-copy').addEventListener('click', async () => {
      const copied = await settings.copy($('session-json').value);
      $('session-notice').textContent = copied ? 'Session JSON copied.' : 'Clipboard access was blocked. Select the JSON below and copy it.';
      if (!copied) { $('session-json').focus(); $('session-json').select(); }
    });
    $('session-download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([$('session-json').value], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url;
      link.download = 'signature-session-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      $('session-notice').textContent = 'JSON download requested. Copy JSON is also available.';
    });
    $('session-restore').addEventListener('click', () => {
      if (!parsed || mode !== 'import') return;
      try { settings.restore(codec.selectParts(codec.parsePasted($('session-json').value).session,settings.getSession(),selection())); dialog.close(); }
      catch (error) { $('session-notice').textContent = error.message; $('session-notice').dataset.error = 'true'; }
    });
  } });
}());
