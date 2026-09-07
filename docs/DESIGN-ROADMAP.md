# Signature Studio roadmap

The current source adds six full-canvas compositions, four fantasy themes, private photo cropping, and scoped AI proposals. Original retains its two-card arrangement. The immediate task is to finish reviewing the integrated editor and exports, then improve compact email formats. This document describes implementation and plans; it does **not** declare every release, deployment, or received-email check passed. [PROGRESS.md](../PROGRESS.md) holds the latest evidence from the expanded eight-agent work.

## Implemented collection

| Design | Current composition | Review focus |
| --- | --- | --- |
| Original | Original name and contact cards, paired or stacked | Preserve existing draft behavior |
| Orbit | Three-part portrait/artwork, identity, and contact band | Clear separation and a prominent name |
| Studio | Asymmetric geometric sidebar and contrasting contact area | Strong shapes without crowded text |
| Contour | Centered identity above a contact grid | Balanced alignment and readable fine lines |
| Prism | Diagonal artwork rail with inset contacts | Clear hierarchy and usable link boundaries |
| Editorial | Full-width serif masthead, fine rule, contact columns | Reading order and reliable font fallbacks |
| Signal | Framed terminal-style header and labeled grid | Readable monospaced text and helpful labels |

The six new designs use the full Wide or Tall canvas. Their name placement, artwork position, and contact arrangement differ. The gallery and preview share the renderer. Selecting a design applies its composition, colors, and default pattern while preserving personal details. Users can change or hide the pattern, apply quick palettes, swap colors, fine-tune colors, reset the selected design, or use **Surprise me**. Signature changes use undo/redo and draft/session persistence. Saved color themes still contain only a name and three colors; complete presets remain future work.

The workspace now focuses on the current canvas. **Browse designs** opens Layouts, Themes, and Artwork tabs in a separate dialog; **Browse artwork** opens the same browser directly to patterns. The sidebar keeps simple selectors, palettes live in Colors, and section AI tools are small text links. A selection returns to the preview. Further features should fit these existing surfaces before adding permanent panels or another gallery to the main page.

The fantasy gallery now contains **Galaxy** (Orbit, violet spirals), **Starlight** (Editorial, gold constellations), **Moonlight** (Contour, Sailor Moon-inspired crescent and ribbons), and **Frost Crown** (Signal, Frozen Throne-inspired ice crown and runes). Each applies a composition, palette, and pattern that can then be mixed independently. These are four starting themes using the seven compositions.

## Implemented photo workflow

Users can choose a local JPG, PNG, or WebP, up to 12 MB and 60 megapixels. A bundled Pico worker detects face regions on the device. **Smart crop** frames head and shoulders; multiple detections expose face selection. Manual drag, position sliders, zoom, brightness, monochrome, mirroring, and keyboard adjustment remain available. Applied photos support circle, rounded-square, and square display shapes at 40–96 px.

The applied crop is a metadata-stripped **384 × 384 JPEG**. Drafts, PNG exports, and session JSON carry that crop, not the original file or unfinished editing controls. Detection finds regions rather than identities and may miss small, obscured, or side-on faces. The MIT-licensed detector and model are bundled, with no remote detection service. [Detector provenance](../vendor/README.md)

**Adjust** reopens the applied crop after reload or session restore. It supports further cropping and image adjustments. Recovering a wider view requires re-uploading the original file because pixels outside the saved square were discarded.

A NASA portrait fixture and a multi-face composite have exercised the Node detector; browser smart cropping has also been observed. These are specific checks, not a general release pass. Follow [PROGRESS.md](../PROGRESS.md) for current evidence.

Local crops work for private preview, PNG export, and session backup. Clickable HTML email requires an explicit, stable, publicly readable **square HTTPS image URL**. Users download the crop, host it themselves, and choose **Use photo URL**. The editor checks loading and square dimensions; it does not publish the file. Copy/HTML export requires that URL while a local crop is present. Draft links do not embed uploaded photos. PNG export additionally needs cross-origin reads when images come from another host.

Session imports now let users choose **Information**, **Design**, or both. Information includes wording, contacts, and photo data/URL. Design includes compositions, recipes, colors, icons, dimensions, image base, photo shape/size, themes, and view settings. Unselected fields stay. The complete incoming file and combined result still validate before restoration; saved themes merge when Design is selected.

## Implemented AI extensions

The workflow is **a prompt for a selected section → JSON response → validated preview → explicit apply → undo**. Buttons are available for design, artwork, layout, colors, details, icons, and photo format. Users copy the prompt to their own AI and paste its response back; editable examples also work without an AI account. The editor has no model connection, API-key setup, or model-training feature.

By default, prompts omit personal fields, URLs, and the photo; they include the user's typed request. Details uses fictional wording until the user explicitly chooses to include current text and contacts. Only fields allowed for the selected section can change. Applied proposals produce one undo step, and a stale preview cannot apply after the draft changes.

Custom layout recipes choose six base compositions, three name-font families, and two identity alignments. Custom pixel-art recipes allow 1–8 colors, equal rows 4–16 cells wide and 4–32 rows tall, with at most 384 cells total. They render as native email tables without an additional image host. The whole signature must still stay under 10,000 HTML characters; dense recipes may be rejected. These are bounded layout and artwork tools, not arbitrary HTML or general image generation. [Complete contract and examples](AI-EXTENSIONS.md)

## Artwork

The initial six transparent antialiased **304 × 728 RGBA PNGs** provide 4× native detail at 76 × 182 px. Geometry is editable in [`scripts/prepare-patterns.mjs`](../scripts/prepare-patterns.mjs) and regenerates without additional packages. Four additional fantasy PNGs are bundled separately. PNG motif inks are fixed independently of card colors and accent; custom pixel artwork has its own editable palette.

![Orbit, Studio, Contour, Prism, Editorial, and Signal on light and dark backgrounds](design-artwork.png)

This is an artwork proof at twice nominal display size, not an editor screenshot or received-email test. The motifs range from 3.3 KB to 21.3 KB. They carry no essential contact information and use empty alt text. Arbitrary backgrounds can obscure some decorative strokes.

```sh
node scripts/prepare-patterns.mjs --proof
node scripts/prepare-patterns.mjs --check
```

Checks read the real PNGs and verify dimensions, transparency, solid ink, antialiased edges, uniqueness, and deterministic regeneration. Deliberately blank images, wrong dimensions, and duplicate artwork have been rejected. Visual review of the complete signatures remains separate.

## Immediate acceptance work

Review all designs in Wide and Tall with and without photos and patterns. Use short/long names, Unicode, all contacts, empty optional fields, and size limits. Inspect actual-size signatures alongside gallery thumbnails. Exercise crop application, multi-face selection, manual adjustment, removal, undo/redo, reload, session transfer, hosted URL errors, clipboard fallback, HTML export, and PNG export. Verify the public build includes required patterns and licensed detector files.

The seven exported AI examples have passed proposal validation and actual rendering with the default signature. Further checks cover field scope, default prompt privacy, stale proposals, one-step Undo, custom recipe limits, and HTML budget errors. Codex in-app browser evidence includes verified downloaded JSON/PNG files and the corrected Signal layout. Gmail paste/send verification remains blocked on an authenticated send test; these browser checks do not close it.

The real reference is [HubSpot's Email Signature Generator](https://www.hubspot.com/email-signature-generator), fetched on 7 September 2026. Compare actual template selection, detail editing, image URL handling, styling, and copy/export workflows at matched viewports. A critic must distinguish blind from labeled comparison. Visual preference does not compensate for broken exports; passing code tests does not establish a visual win.

## Next priorities

| Priority | Planned work | Evidence needed |
| --- | --- | --- |
| 1. Compact email layouts | Explicit total-width controls and short single-signature formats around 320–420 px; a compact reply version; primary-contact selection; restrained artwork | Actual received messages fit narrow views; readable text at 100%; no overlap with long names or optional fields; output dimensions match the UI |
| 2. Email compatibility and accessibility | A matrix recording client/platform/version, insertion method, light/dark appearance, images blocked, replies, fonts, and received-message results; concise contrast and export feedback | Evidence for each supported case; keyboard/focus checks; workarounds or explicit unsupported status; simulated previews never described as received-email proof |
| 3. Brand kits and complete presets | Separate color themes from presets containing design, pattern, palette, layout, and approved typography; brand kits with stable asset URLs and icon styles | Complete JSON round trips; old drafts still restore; applying a kit preserves personal details; invalid assets recover; Undo restores the previous signature |
| 4. Optional hosted assets | Opt-in publication to a user-selected host with exact image/destination preview; stable URLs, replacement policy, errors, and manual-URL fallback | Approved upload returns a usable public URL; failed uploads leave the crop intact; cross-origin export behavior is known; previously sent assets follow a documented retention policy |
| 5. Broader typography and layout controls | Extend the existing three-family/two-alignment recipes with tested sizes, spacing presets, and contact columns; meaningful compact/mirrored/two-ink variants | Visibly useful choices; measured/exported dimensions agree; fallback fonts reviewed; extreme settings cannot overlap or hide content |
| 6. Custom icons and logos | PNG preparation first; controlled SVG sanitization/rasterization later; transparency, attribution, light/dark variants, hosted URLs, and bundled fallbacks | Invalid input rejected; contacts survive icon removal; semantic text remains; email uses stable PNG URLs; cross-origin failures have a clear recovery path |

## Constraints to keep

Google documents a **10,000-character signature limit**, notes that images count toward it, and supports separate defaults for new messages and replies. Keep the Gmail handoff clear and use actual received messages for compatibility claims. [Google signature instructions](https://support.google.com/mail/answer/8395?hl=en)

Google documents formatting and image problems. Keep names, roles, and contacts as real text; a PNG is static and loses per-contact click targets. Export tables, explicit dimensions, inline presentation, and system-font fallbacks. Keep editor controls and animation outside email markup. [Google troubleshooting](https://support.google.com/mail/answer/11468381)

A hosted direct URL is also part of HubSpot's documented image workflow. Selecting a local file does not publish it for recipients. Hosting integration must remain explicit and optional. [HubSpot image instructions](https://www.hubspot.com/email-signature-generator)

Target **4.5:1** for ordinary text and **3:1** for qualifying large text. Meaningful icons and applicable control boundaries need **3:1** non-text contrast. Decorative marks still need visual review on the chosen background. [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
