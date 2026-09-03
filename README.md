# Gmail signature — Juan Francisco Ribera Laszkowski

A Gmail-compatible HTML email signature that reproduces the business card
(front + back A, side by side) 1:1 at screen scale: each panel is 321 × 208 px,
which is 85 × 55 mm at 96 dpi. Built with tables and inline styles only, so
Gmail's signature editor keeps everything.

## Repository layout

```
.
├── README.md             this file
├── signature.html        preview page + "copy to clipboard" tool (open in Chrome)
├── signature-only.html   the bare signature markup, nothing else (what gets pasted into Gmail)
└── sig/
    ├── dots.png          front-panel dot grid, 152 × 364 px (2×, displayed at 76 × 182)
    ├── icon-mail.png     30 × 30 px (2×, displayed at 15 × 15), cream #f3f0ea stroke on transparent
    ├── icon-phone.png
    ├── icon-linkedin.png
    └── icon-pin.png
```

## Instructions for Claude Code (or whoever pushes this)

1. Push this folder as-is to a **public** GitHub repository (or a public branch of one).
   The PNGs must stay in `sig/` and keep their names.
2. Work out the raw base URL of the `sig/` folder:
   `https://raw.githubusercontent.com/<user>/<repo>/<branch>/sig`
   Verify it by opening `<base>/icon-mail.png` in a browser — it must return the PNG, not HTML.
3. In `signature.html` and `signature-only.html`, replace every occurrence of the
   placeholder `https://YOUR-HOST/sig` with that base URL (no trailing slash). Commit and push again.
   (`signature.html` also has an input field at the top that does this substitution live in the
   browser, so step 3 is optional if the user prefers to type the URL there each time.)
4. Report the final base URL back to the user.

Do not change any pixel values, font stacks, colours or table structure — they were measured
against the original card (see "Verification" below).

## Installing in Gmail

1. Open `signature.html` in Chrome. Make sure the image base URL field at the top contains the
   real hosted URL and the preview shows the icons and dot grid.
2. Click **Copy signature to clipboard** (it writes real `text/html` to the clipboard).
   Fallback: select the two panels with the mouse and press Ctrl/Cmd+C.
3. Gmail → Settings (gear) → *See all settings* → *General* → *Signature* → *Create new* → paste with
   Ctrl/Cmd+V → *Save Changes* at the bottom of the page.
4. Send yourself a test mail and check it on desktop and on the phone app.

Gmail's limit is 10,000 characters per signature; this one is 5147.

## Why some things differ from the card (and what to expect)

- **Fonts.** Gmail does not load web fonts. The stacks are
  `Schibsted Grotesk → Helvetica Neue → Helvetica → Arial → sans-serif` for the name and
  `IBM Plex Mono → SF Mono → Menlo → Consolas → Courier New → monospace` for everything else.
  Recipients with Schibsted Grotesk / IBM Plex Mono installed see the exact card typography;
  everyone else gets the fallback. The layout was rendered with Arial/Courier-class fallbacks
  too and nothing wraps or shifts (Arial Bold "Ribera Laszkowski" measures 186 px inside a
  211 px column).
- **Paper grain and gloss.** These were `data-screen-only` CSS overlays (SVG turbulence +
  gradient, `mix-blend-mode`) on the original and have no email equivalent. The panels are flat
  `#f3f0ea` / `#1c1c1c`.
- **Icons and dot grid are images.** The originals were inline SVG and a CSS
  `radial-gradient` background; Gmail strips both, so they are hosted PNGs at 2× resolution.
  They render exactly as on the card, including the four off-grid red dots. If images are
  blocked by a recipient, the signature degrades to the text + the cream vertical rule.
- **Uppercase is literal.** `text-transform` is not supported by Gmail, so the title, tagline
  and tags are typed in capitals.
- **Gap between the panels** is a 20 px spacer cell (`<td width="20">`). On the original
  desk view the cards were 9 mm ≈ 34 px apart; change that one value if you want it wider.

## Verification

The signature was rendered in headless Chromium next to the original card (fonts embedded
for the comparison) and element positions were measured:

| Element | Original (px) | Signature (px) |
|---|---|---|
| Panel size | 321 × 208 | 321 × 208 |
| Red square | 17 × 17 at (22.7, 22.7) | 17 × 17 at (23, 23) |
| Name block top | y = 80.1 | y = 80 |
| Title top | y = 132.6 | y = 133 |
| Tagline top | y = 160.6 | y = 161 |
| Dot grid | 76 × 181 at (234.3, 13.2) | 76 × 182 at (234, 13) |
| Contact rows | y = 61.7 / 86.6 / 111.6 / 136.5 | y = 61 / 86 / 111 / 136 |
| Contact text x | 62.2 | 63 |
| Cream rule x | 51.4 | 52 |
| Red line | y = 164.4 | y = 165 |
| Tags top | y = 175.2 | y = 175 |
| "j.francisco.ribera@gmail.com" width | 145.3 | 145.3 |

CSS checked absent from the pasted markup: `position`, `flex`, `grid`, `background-image`,
`<svg>`, `data:` URIs, `<style>`, `class`, `text-transform`, `margin`, `@font-face`, `transform`.

## The signature markup

This is `signature-only.html` verbatim (placeholder `https://YOUR-HOST/sig` still in place):

```html
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
<td valign="top" style="padding:0">
<table cellpadding="0" cellspacing="0" border="0" width="321" style="border-collapse:collapse;width:321px;height:208px;background-color:#f3f0ea"><tr>
<td valign="top" style="padding:23px 0 23px 23px;vertical-align:top">
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="padding:0;width:17px;height:17px;background-color:#c8362a;font-size:1px;line-height:17px">&nbsp;</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="padding:40px 0 0 0;font-family:'Schibsted Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:21px;line-height:23px;font-weight:600;letter-spacing:-0.2px;color:#1c1c1c;white-space:nowrap">Juan Francisco<br>Ribera Laszkowski</td></tr>
<tr><td style="padding:7px 0 0 0;font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:9px;line-height:11px;font-weight:500;letter-spacing:0.73px;color:#c8362a;white-space:nowrap">AI PLATFORM ENGINEER</td></tr>
<tr><td style="padding:17px 0 0 0;font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:8px;line-height:12px;letter-spacing:1.11px;color:#5a5651;white-space:nowrap">BUILDING RELIABLE AI PLATFORMS<br>THAT SCALE.</td></tr>
</table>
</td>
<td valign="top" align="right" width="76" style="width:76px;padding:13px 11px 0 0;vertical-align:top;text-align:right;line-height:0;font-size:0"><img src="https://YOUR-HOST/sig/dots.png" width="76" height="182" alt="" style="width:76px;height:182px;border:0;vertical-align:top"></td>
</tr></table>
</td>
<td width="20" style="width:20px;padding:0;font-size:1px;line-height:1px">&nbsp;</td>
<td valign="top" style="padding:0">
<table cellpadding="0" cellspacing="0" border="0" width="321" style="border-collapse:collapse;width:321px;height:208px;background-color:#1c1c1c"><tr>
<td valign="top" style="padding:23px;vertical-align:top">
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="padding:0"><table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="padding:0;width:17px;height:17px;background-color:#c8362a;font-size:1px;line-height:17px">&nbsp;</td></tr>
</table></td></tr>
<tr><td style="padding:21px 0 0 0">
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:9.45px;line-height:13px;letter-spacing:0.19px;color:#f3f0ea">
<tr>
<td width="17" valign="middle" style="width:17px;height:15px;padding:0 10px 10px 2px;vertical-align:middle"><img src="https://YOUR-HOST/sig/icon-mail.png" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0"></td>
<td rowspan="4" width="1" style="width:1px;padding:0;background-color:#f3f0ea;font-size:1px;line-height:1px">&nbsp;</td>
<td valign="middle" style="padding:0 0 10px 10px;height:15px;vertical-align:middle;white-space:nowrap"><a href="mailto:j.francisco.ribera@gmail.com" style="color:#f3f0ea;text-decoration:none">j.francisco.ribera@gmail.com</a></td>
</tr>
<tr>
<td valign="middle" style="width:17px;height:15px;padding:0 10px 10px 2px;vertical-align:middle"><img src="https://YOUR-HOST/sig/icon-phone.png" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0"></td>
<td valign="middle" style="padding:0 0 10px 10px;height:15px;vertical-align:middle;white-space:nowrap"><a href="tel:+41765593461" style="color:#f3f0ea;text-decoration:none">+41 76 559 34 61</a></td>
</tr>
<tr>
<td valign="middle" style="width:17px;height:15px;padding:0 10px 10px 2px;vertical-align:middle"><img src="https://YOUR-HOST/sig/icon-linkedin.png" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0"></td>
<td valign="middle" style="padding:0 0 10px 10px;height:15px;vertical-align:middle;white-space:nowrap"><a href="https://www.linkedin.com/in/ribr" style="color:#f3f0ea;text-decoration:none">linkedin.com/in/ribr</a></td>
</tr>
<tr>
<td valign="middle" style="width:17px;height:15px;padding:0 10px 0 2px;vertical-align:middle"><img src="https://YOUR-HOST/sig/icon-pin.png" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0"></td>
<td valign="middle" style="padding:0 0 0 10px;height:15px;vertical-align:middle;white-space:nowrap">Winterthur, Switzerland</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:13px 0 0 0">
<table cellpadding="0" cellspacing="0" border="0" width="275" style="border-collapse:collapse;width:275px">
<tr><td style="padding:0;height:1px;background-color:#c8362a;font-size:1px;line-height:1px">&nbsp;</td></tr>
<tr><td style="padding:10px 0 0 0;font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:8px;line-height:10px;letter-spacing:1.11px;color:#b5b0a8;white-space:nowrap">PLATFORMS &middot; DATA &middot; ML &middot; AUTOMATION</td></tr>
</table>
</td></tr>
</table>
</td>
</tr></table>
</td>
</tr></table>
```
