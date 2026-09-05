(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SignatureCore = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var defaults = Object.freeze({
    nameLine1: 'Avery', nameLine2: 'Morgan', title: 'Software Engineer',
    subtitle: 'AI & AUTOMATION', website: 'example.com', websiteLabel: 'example.com',
    email: '', phone: '+41 00 000 00 00', linkedin: 'https://www.linkedin.com/',
    location: 'Zurich, Switzerland', tags: 'SOFTWARE · DATA · AI',
    width: 321, height: 208, layout: 'paired', accent: '#c8362a',
    frontBackground: '#f3f0ea', backBackground: '#1c1c1c',
    websiteIcon: 'web', emailIcon: 'mail', phoneIcon: 'phone', linkedinIcon: 'linkedin', locationIcon: 'pin',
    imageBase: 'https://raw.githubusercontent.com/Ademord/gmail-signature/main/sig'
  });
  var limits = Object.freeze({nameLine1: 36, nameLine2: 36, title: 64, subtitle: 64,
    website: 1024, websiteLabel: 40, email: 80, phone: 32, linkedin: 512,
    location: 48, tags: 60, imageBase: 512});
  var cream = '#f3f0ea', black = '#1c1c1c';
  var sans = 'Arial,Helvetica,sans-serif', mono = "'Courier New',Courier,monospace";
  var roleMono = "'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace";
  var icons = Object.freeze({web:'Globe', mail:'Envelope', phone:'Phone', linkedin:'LinkedIn', pin:'Location pin', none:'None'});
  var contactKeys = ['website', 'email', 'phone', 'linkedin', 'location'];
  function escape(value) { return String(value).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  }); }
  function clean(value) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function dimension(value, fallback, min, max) {
    var number = value === undefined || value === null || value === '' ||
      (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') ? fallback : Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? Math.round(number) : fallback));
  }
  function normalize(values) {
    var input = values && typeof values === 'object' ? values : {}, result = {};
    Object.keys(defaults).forEach(function (key) {
      result[key] = input[key] === undefined ? defaults[key] : clean(input[key]);
    });
    result.width = dimension(input.width, defaults.width, 280, 420);
    result.height = dimension(input.height, defaults.height, 180, 320);
    ['accent', 'frontBackground', 'backBackground'].forEach(function (key) { result[key] = result[key].toLowerCase(); });
    result.imageBase = result.imageBase.replace(/\/+$/, '');
    return result;
  }
  function webURL(value) {
    if (!value || /[\s\\<>"'\u0000-\u001f\u007f]/.test(value)) return null;
    var candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : 'https://' + value;
    try {
      var url = new URL(candidate), host = url.hostname.toLowerCase().replace(/\.$/, '');
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
      if (!host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null;
      if (!/^[a-z\d.-]+$/.test(host) || host.split('.').some(function (part) {
        return !part || part.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(part);
      })) return null;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        var n = host.split('.').map(Number);
        if (n.some(function (x) { return x > 255; }) || n[0] === 0 || n[0] === 10 || n[0] === 127 || n[0] >= 224 ||
          (n[0] === 100 && n[1] >= 64 && n[1] <= 127) || (n[0] === 169 && n[1] === 254) ||
          (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168) ||
          (n[0] === 198 && (n[1] === 18 || n[1] === 19))) return null;
      }
      return url.href;
    } catch (_) { return null; }
  }
  function emailOK(value) {
    if (!/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(value)) return false;
    var parts = value.split('@');
    return parts[0].length <= 64 && value.indexOf('..') === -1 && value[0] !== '.' && value.indexOf('.@') === -1 &&
      parts[1].split('.').every(function (label) {
        return label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label);
      });
  }
  function phoneHref(value) { return 'tel:' + value.replace(/[^+\d]/g, ''); }
  function luminance(hex) {
    var rgb = [1, 3, 5].map(function (i) {
      var channel = parseInt(hex.slice(i, i + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  function contrast(a, b) {
    var first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }
  function readable(background, preferred) {
    if (contrast(background, preferred) >= 4.5) return preferred;
    return contrast(background, '#000000') >= contrast(background, '#ffffff') ? '#000000' : '#ffffff';
  }
  function iconFile(icon, background) {
    if (!Object.prototype.hasOwnProperty.call(icons, icon) || !/^#[0-9a-f]{6}$/i.test(background)) throw new TypeError('Use an available icon and six-digit background color.');
    return icon === 'none' ? '' : 'icon-' + icon + (contrast(background, cream) >= 3 ? '' : '-dark') + '.png';
  }
  // Arial bold advances plus a small allowance for rounding and fallback fonts.
  var glyphGroups = [[0.278, " .,/'Iijl"], [0.333, '!()-:;[]`ft'], [0.389, '*r'],
    [0.474, '"'], [0.5, 'z'], [0.556, '#$0123456789Jaceksvxy'],
    [0.584, '+<=>^~'], [0.611, '?FLTZbdghnopqu'], [0.667, 'EPSVXY'],
    [0.722, '&ABCDHKNRU'], [0.778, 'GOQw'], [0.833, 'M'], [0.889, '%m'],
    [0.944, 'W'], [0.975, '@'], [0.556, '_'], [0.333, '{}'], [0.28, '|\\']];
  function units(text, fixed) {
    return Array.from(text).reduce(function (sum, c) {
      if (fixed) return sum + (/[^\u0000-\u00ff]/.test(c) && c !== '·' ? 1 : 0.61);
      var base = c.normalize('NFD')[0], group = glyphGroups.find(function (entry) { return entry[1].indexOf(base) !== -1; });
      return sum + (group ? group[0] + 0.025 : 1.1);
    }, 0);
  }
  function wrap(text, width, font, fixed, spacing) {
    if (!text) return [];
    var lines = [], current = '';
    text.split(' ').forEach(function (word) {
      var next = current ? current + ' ' + word : word;
      if (units(next, fixed) * font + Array.from(next).length * (spacing || 0) <= width) { current = next; return; }
      if (current) { lines.push(current); current = ''; }
      Array.from(word).forEach(function (c) {
        if (current && units(current + c, fixed) * font + Array.from(current + c).length * (spacing || 0) > width) { lines.push(current); current = ''; }
        current += c;
      });
    });
    if (current) lines.push(current);
    return lines;
  }
  function linkLabel(value) {
    var safe = webURL(value);
    if (!safe) return '';
    var url = new URL(safe), host = url.hostname.replace(/^www\./, ''), label = host + url.pathname.replace(/\/$/, '');
    return label.length <= 34 ? label : host;
  }
  function plan(v) {
    var pad = Math.round(18 + (v.width - 280) * 0.1), top = v.height < 200 ? 18 : 22;
    var dotH = Math.min(v.height - 26, 182), dotW = Math.round(dotH * 76 / 182);
    var right = 11, gap = 10, textW = v.width - pad - right - gap - dotW;
    var nameFont = Math.min(24, 22 * v.width / 321), longest = Math.max(units(v.nameLine1), units(v.nameLine2), 1);
    nameFont = Math.min(nameFont, (textW - 2) / longest);
    var nameLine = Math.ceil(nameFont * 1.12), titleFont = 9, subFont = 9;
    var titleLines = wrap(v.title, textW, titleFont, true, 0.73);
    var subLines = wrap(v.subtitle, textW, subFont, true);
    var names = [v.nameLine1, v.nameLine2].filter(Boolean), square = v.height < 200 ? 15 : 17;
    var titleH = titleLines.length ? 7 + titleLines.length * 11 : 0;
    var subH = subLines.length ? 11 + subLines.length * 12 : 0;
    var frontSpace = v.height - 2 * top - square - names.length * nameLine - titleH - subH;
    var innerW = v.width - pad * 2, contactW = innerW - 39, contactFont = 10.5;
    var rows = [];
    function add(key, label, text, href) {
      if (text) rows.push({key:key, label:label, icon:v[key + 'Icon'], lines:wrap(text, contactW - 2, contactFont, true), href:href});
    }
    add('website', 'Website', v.website && (v.websiteLabel || linkLabel(v.website)), webURL(v.website));
    add('email', 'Email', v.email, 'mailto:' + encodeURIComponent(v.email).replace(/%40/g, '@'));
    add('phone', 'Phone', v.phone, phoneHref(v.phone));
    add('linkedin', 'LinkedIn', v.linkedin && linkLabel(v.linkedin), webURL(v.linkedin));
    add('location', 'Location', v.location, '');
    var tagLines = wrap(v.tags, innerW, 8.5, true);
    var rowGap = v.height < 200 ? 4 : 6;
    var contactH = rows.reduce(function (sum, row) { return sum + row.lines.length * 14; }, 0) + Math.max(0, rows.length - 1) * rowGap;
    var tagH = tagLines.length ? 12 + 1 + 8 + tagLines.length * 11 : 0;
    var backSpace = v.height - top * 2 - square - contactH - tagH;
    return {pad:pad,top:top,dotH:dotH,dotW:dotW,right:right,gap:gap,textW:textW,nameFont:nameFont,
      nameLine:nameLine,names:names,square:square,titleLines:titleLines,subLines:subLines,frontSpace:frontSpace,
      innerW:innerW,contactW:contactW,contactFont:contactFont,rows:rows,rowGap:rowGap,tagLines:tagLines,backSpace:backSpace};
  }
  function validate(values) {
    var v = normalize(values), errors = {};
    [['width',280,420],['height',180,320]].forEach(function (rule) {
      var raw = values && typeof values === 'object' ? values[rule[0]] : undefined;
      if (raw !== undefined && ((typeof raw !== 'number' && typeof raw !== 'string') ||
        String(raw).trim() === '' || !Number.isInteger(Number(raw)) || Number(raw) < rule[1] || Number(raw) > rule[2])) {
        errors[rule[0]] = 'Enter a whole number from ' + rule[1] + ' to ' + rule[2] + '.';
      }
    });
    Object.keys(limits).forEach(function (key) {
      if (v[key].length > limits[key]) errors[key] = 'Use ' + limits[key] + ' characters or fewer.';
    });
    if (!v.nameLine1) errors.nameLine1 = 'Enter a first name line.';
    contactKeys.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(icons, v[key + 'Icon'])) errors[key + 'Icon'] = 'Choose an available icon or None.';
    });
    ['accent', 'frontBackground', 'backBackground'].forEach(function (key) {
      if (!/^#[0-9a-f]{6}$/i.test(v[key])) errors[key] = 'Use a six-digit hex color, such as #c8362a.';
    });
    if (v.layout !== 'paired' && v.layout !== 'stacked') errors.layout = 'Choose paired or stacked.';
    ['website', 'linkedin', 'imageBase'].forEach(function (key) {
      if ((v[key] || key === 'imageBase') && !webURL(v[key])) errors[key] = 'Use a public HTTP or HTTPS URL.';
    });
    if (v.imageBase && /[?#]/.test(v.imageBase)) errors.imageBase = 'Use an image folder URL without a query or fragment.';
    if (v.email && !emailOK(v.email)) errors.email = 'Enter a valid email address.';
    if (v.phone && (!/^\+?[\d ()-]+$/.test(v.phone) || v.phone.replace(/\D/g, '').length < 5 || v.phone.replace(/\D/g, '').length > 20)) {
      errors.phone = 'Use 5–20 digits with an optional leading +, spaces, brackets, or hyphens.';
    }
    if (Object.keys(errors).length) return errors;
    var p = plan(v);
    if (p.nameFont < 17) errors[units(v.nameLine1) >= units(v.nameLine2) ? 'nameLine1' : 'nameLine2'] = 'Shorten the name lines or increase the card width for readable text.';
    if (p.titleLines.length > 2) errors.title = 'Shorten the title to fit two lines at this width.';
    if (p.subLines.length > 2) errors.subtitle = 'Shorten the subtitle to fit two lines at this width.';
    p.rows.forEach(function (row) { if (row.lines.length > 2) errors[row.key] = 'Shorten this text to fit two lines at this width.'; });
    if (p.tagLines.length > 2) errors.tags = 'Shorten the tags to fit two lines at this width.';
    if (p.frontSpace < 10 || p.backSpace < 10) errors.height = 'Increase the card height or shorten the text to keep everything readable.';
    if (!Object.keys(errors).length && renderUnchecked(v).length >= 10000) errors.website = 'Shorten the URLs to keep the HTML under 10,000 characters.';
    return errors;
  }
  function checked(values) {
    var errors = validate(values);
    if (Object.keys(errors).length) { var error = new TypeError('Invalid signature values.'); error.errors = errors; throw error; }
    return normalize(values);
  }
  function table(width, height, content, background) {
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="' + width + '"' +
      (height ? ' height="' + height + '"' : '') + ' style="border-collapse:collapse;table-layout:fixed;width:' + width + 'px;' +
      (height ? 'height:' + height + 'px;' : '') + (background ? 'background-color:' + background + ';' : '') + '">' + content + '</table>';
  }
  function spacer(height) { return '<tr><td height="' + height + '" style="padding:0;height:' + height + 'px;font-size:0;line-height:0">&nbsp;</td></tr>'; }
  function square(size, color) { return table(size, size, '<tr><td style="padding:0;background-color:' + color + ';font-size:0;line-height:0">&nbsp;</td></tr>'); }
  function textRow(lines, font, line, color, family, weight, spacing) {
    if (!lines.length) return '';
    return '<tr><td style="padding:0;font-family:' + family + ';font-size:' + font + 'px;line-height:' + line + 'px;font-weight:' + (weight || 400) + ';color:' + color + (spacing ? ';letter-spacing:' + spacing + 'px' : '') + ';white-space:nowrap">' + lines.map(escape).join('<br>') + '</td></tr>';
  }
  function blankCol(width) { return '<td width="' + width + '" style="padding:0;width:' + width + 'px;font-size:0;line-height:0">&nbsp;</td>'; }
  function renderUnchecked(v, options) {
    var p = plan(v), assetBase = webURL(v.imageBase).replace(/\/+$/, '');
    var frontText = readable(v.frontBackground, black), frontMuted = readable(v.frontBackground, '#5a5651');
    var backText = readable(v.backBackground, cream), backMuted = readable(v.backBackground, '#b5b0a8');
    var titleColor = readable(v.frontBackground, v.accent);
    if (options && options.assetBase !== undefined) {
      assetBase = clean(options.assetBase).replace(/\/+$/, '');
      if (/^\/\//.test(assetBase) || /(?:^|\/)\.\.(?:\/|$)/.test(assetBase.replace(/%2e/gi, '.')) ||
        (!/^(?:\.\/|\/)?[a-z\d_-]+(?:\/[a-z\d_-]+)*$/i.test(assetBase) && !webURL(assetBase))) {
        throw new TypeError('Use a safe relative or public asset folder URL without traversal.');
      }
      if (/[?#]/.test(assetBase)) throw new TypeError('Use an asset folder URL without a query or fragment.');
      if (webURL(assetBase)) assetBase = webURL(assetBase).replace(/\/+$/, '');
    }
    var frontRows = spacer(p.top) + '<tr><td style="padding:0">' + square(p.square, v.accent) + '</td></tr>' +
      spacer(Math.min(Math.round(v.height * 0.19), p.frontSpace)) + textRow(p.names, Math.floor(p.nameFont * 10) / 10, p.nameLine, frontText, sans, 600);
    if (p.titleLines.length) frontRows += spacer(7) + textRow(p.titleLines, 9, 11, titleColor, roleMono, 400, 0.73);
    if (p.subLines.length) frontRows += spacer(11) + textRow(p.subLines, 9, 12, frontMuted, mono);
    var dots = spacer(13) + '<tr><td style="padding:0;font-size:0;line-height:0"><img src="' + escape(assetBase + '/dots.png') +
      '" width="' + p.dotW + '" height="' + p.dotH + '" alt="" style="display:block;width:' + p.dotW + 'px;height:' + p.dotH + 'px;border:0"></td></tr>';
    var front = table(v.width, v.height, '<tr>' + blankCol(p.pad) + '<td width="' + p.textW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.textW, 0, frontRows) + '</td>' + blankCol(p.gap) + '<td width="' + p.dotW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.dotW, 0, dots) + '</td>' + blankCol(p.right) + '</tr>', v.frontBackground);
    var contacts = p.rows.map(function (row, i) {
      var bottom = i === p.rows.length - 1 ? 0 : p.rowGap, label = row.lines.map(escape).join('<br>');
      if (row.href) label = '<a href="' + escape(row.href) + '" style="color:' + backText + ';text-decoration:none">' + label + '</a>';
      var icon = row.icon === 'none' ? '' : '<img src="' + escape(assetBase + '/' + iconFile(row.icon, v.backBackground)) + '" width="14" height="14" alt="' + row.label + '" style="display:block;width:14px;height:14px;border:0">';
      return '<tr><td width="28" valign="top" style="padding:0 0 ' + bottom + 'px;font-size:0;line-height:0">' + icon +
        '</td><td width="1" style="padding:0;background-color:' + backMuted + ';font-size:0;line-height:0">&nbsp;</td>' + blankCol(10) +
        '<td width="' + p.contactW + '" valign="top" style="padding:0 0 ' + bottom + 'px;font-family:' + mono + ';font-size:' + p.contactFont +
        'px;line-height:14px;color:' + backText + ';white-space:nowrap">' + label + '</td></tr>';
    }).join('');
    var backRows = spacer(p.top) + '<tr><td style="padding:0">' + square(p.square, v.accent) + '</td></tr>';
    if (contacts) backRows += spacer(Math.min(21, p.backSpace)) + '<tr><td style="padding:0">' + table(p.innerW, 0, contacts) + '</td></tr>';
    if (p.tagLines.length) backRows += spacer(12) + '<tr><td height="1" style="padding:0;height:1px;background-color:' + v.accent + ';font-size:0;line-height:0">&nbsp;</td></tr>' +
      spacer(8) + textRow(p.tagLines, 8.5, 11, backMuted, mono);
    var back = table(v.width, v.height, '<tr>' + blankCol(p.pad) + '<td width="' + p.innerW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.innerW, 0, backRows) + '</td>' + blankCol(p.pad) + '</tr>', v.backBackground);
    var cell = function (html) { return '<td valign="top" style="padding:0;vertical-align:top">' + html + '</td>'; };
    var output = v.layout === 'stacked' ? table(v.width, v.height * 2 + 20, '<tr>' + cell(front) + '</tr>' + spacer(20) + '<tr>' + cell(back) + '</tr>') :
      table(v.width * 2 + 20, v.height, '<tr>' + cell(front) + blankCol(20) + cell(back) + '</tr>');
    return output;
  }
  function render(values, options) {
    var output = renderUnchecked(checked(values), options);
    if (output.length >= 10000) { var error = new TypeError('The signature HTML is too long. Shorten the website or image URL.'); error.errors = {website:'Shorten the URL to keep the HTML under 10,000 characters.'}; throw error; }
    return output;
  }
  function plainText(values) {
    var v = checked(values), lines = [[v.nameLine1, v.nameLine2].filter(Boolean).join(' '), v.title, v.subtitle];
    if (v.website) lines.push((v.websiteLabel ? v.websiteLabel + ': ' : '') + webURL(v.website));
    if (v.email) lines.push(v.email);
    if (v.phone) lines.push(v.phone);
    if (v.linkedin) lines.push(webURL(v.linkedin));
    if (v.location) lines.push(v.location);
    if (v.tags) lines.push(v.tags);
    return lines.filter(Boolean).join('\n');
  }
  return Object.freeze({defaults:defaults, limits:limits, icons:icons, iconFile:iconFile, normalize:normalize, validate:validate, render:render, plainText:plainText});
}));
