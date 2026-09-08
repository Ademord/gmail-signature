# Signature editor — progress and handoff

Updated: 2026-09-08. Published scope: artwork across the full signature, editable side details, unified color palettes, collapsible layouts, width/height controls, and two reproduced input races. Keep the existing public repository/Pages audience; do not rewrite history or change visibility.

## Flowing artwork and editor controls — 8 September 2026

The user asked for abstract artwork to flow across the card, replacing the restricted rail treatment. Six built-in abstract studies now have twelve dedicated Wide/Tall backgrounds. Placement is Automatic, Side detail, or Across signature; flowing artwork supports 75–150% scale and 0–100% horizontal/vertical positions. Four draft fields store these choices with defaults for older sessions. The drawing dialog still creates an editable native-table side detail and explains that boundary; its six studies support inks, painting/erasing, mirrors, variations, local history, preview, and Apply/Cancel.

The library now has Layouts and Artwork. Colors → Palettes holds seventeen color-only choices, including Midnight, the six abstract palettes, and four fantasy palettes. Layout selection preserves the current colors and pattern. The main Layout section collapses; the sizing tab has synchronized width and height sliders and number fields. Ten agent roles contributed in waves to implementation, contracts, visual review, and release evidence.

The initial audit confirmed the published `d1d1bbf` baseline had successful 170-test CI and 76 matching live resource URLs. Before the flow expansion, the independent manual-artwork audit passed 199 of 200 local tests with the existing Windows symlink skip, validated the runtime token, and confirmed a 53-file build. That intermediate result does not certify the later flow/palette revision. Import and photo fixes address stale JSON becoming restorable during a file read and inability to reselect a photo after interrupted detection.

The current publication roster has **65 files** and **19 versioned editor script/style links**. Final local verification: **216 tests, 215 passed, zero failures, one expected Windows symlink skip**. Both generators pass sixteen motifs and twelve full-canvas backgrounds; the actual build matches all 65 source files and excludes private files and fixtures. Runtime token: `4b21b60415b81f8c`. The visual critic's first failure led to compact, padded identity/contact blocks replacing fragmented per-line masks. All six revised artworks, Original with a portrait, Signal, Tall, and the inspected PNG now pass the scoped visual review. Flow backgrounds are embedded before PNG rasterization. Google's [Gmail CSS reference](https://developers.google.com/workspace/gmail/design/css) lists the background properties used, but settings paste/send preservation remains unverified.

Latest lead Codex-browser checks: Midnight changed only three colors; selecting Signal retained Counterform. Width 380 and height 260 produced a 380 × 540 Tall signature; Undo restored Wide while retaining those dimensions. At 390 × 844, sizing sliders measured 293 px, page scroll stayed within 375 px, and the two-tab library measured 369 px for both client and scroll width. Position controls disabled an axis with no travel and enabled it after zoom. The drawing dialog explained side-detail placement before Apply. The NASA fixture completed automatic face cropping and appeared independently of the flowing art. Actual downloads include a decoded 1284 × 1744 PNG and a 7,910-byte HTML file with the public Tall artwork URL, live contact links, and no local URLs.

App commit: `d64ce06ef9df868cae3a5996005c4f5ebf27a531`. [Exact-commit CI and Pages passed](https://github.com/Ademord/gmail-signature/actions/runs/34174750140): 216 of 216 Linux tests passed, with zero failures or skips. Independent deployment verification matched **96 of 96 URLs** against committed bytes: 65 canonical files, 19 versioned editor resources, and all twelve raw artwork URLs used by email exports. The raw artwork has the expected PNG content type and cross-origin headers. The hosted Codex browser loaded token `4b21b60415b81f8c`, seventeen palette choices, both sizing sliders, no Themes tab, and six decoded 1720 × 640 artwork previews. This read-only hosted check opened and closed the library; it did not export or change the personal draft. See the [independent final visual review](docs/reviews/flow-artwork-2026-09-08.md).

| Check | Expected evidence | Status |
| --- | --- | --- |
| Import and photo recovery | Deferred file/detection probes reject stale state and allow retries | Ten import and four photo regressions passed; included in the final suite |
| Flowing and manual artwork | Six full-card studies in both orientations; explicit side-detail editing; reversible apply | Passed local checks and revised visual review |
| Palettes and layout controls | Seventeen distinct color-only choices, two library tabs, preserved colors/pattern, synchronized sizing | Passed desktop/mobile controls and independent regressions; legacy Spruce maps to Forest |
| Persistence and export | Old/custom recipes and new placement fields round-trip; CSS backgrounds survive PNG embedding | Passed full suite and actual downloaded PNG/HTML checks |
| CI, public build, and hosted demo | Current runtime token, 65-file boundary, exact-commit CI and deployed controls | Passed on app commit d64ce06; 96 deployed URLs match committed bytes |
| Real Gmail send/receive | Actual received desktop/mobile/light/dark messages | Blocked: Codex browser rechecked on 8 September and redirects to Gmail's public landing/sign-in page. No message sent. |

The following sections preserve earlier release evidence and UI terminology; they do not describe the current library or certify this revision.

## Abstract artwork extension — 7 September 2026

The user requested a stronger MoMA/Kunsthaus-inspired abstract direction. Six original procedural studies now extend Artwork and Themes: Cut paper, Color field, Chromatic, Counterform, Overprint, and Gesture. Existing seven layout engines and saved session fields are unchanged. Six quiet curated palettes pair the studies with Orbit, Prism, or Studio. The Artwork dialog shows the new studies at full 76 × 182 size, in three desktop or two mobile columns, followed by the existing graphic/fantasy options. No permanent editor controls were added.

An independent artwork builder, visual critic, and regression reviewer worked alongside lead integration. The critic reviewed real MoMA/Kunsthaus references, original PNG proofs at small sizes/light/dark, and actual desktop UI. Feedback improved the brush underpainting and color-field edges. References and descriptions are in README and the roadmap.

Local verification: **170 tests, 169 pass, zero failures, one Windows symlink skip**. Nine new tests cover six explicit patterns and collections, 1,008 design/size/photo cases, 84 session round trips, AI contracts, real HTTP assets, actual app selection/history, and the 50-file public roster. All sixteen generated patterns pass deterministic raster checks; the original ten PNGs remain byte-identical. Runtime token: `cc27cc5e607b403d`.

Root Codex browser checks: six abstract theme cards and six full-size artworks loaded; applying a collection preserved Avery details and returned focus; Cut paper and Overprint PNG exports decoded at 2648 × 832. At 390 × 844, the artwork dialog client and scroll width both measured 369 px, with two columns and 76 × 182 artwork. The independent visual critic approved all six final studies, desktop/mobile library captures, and the inspected export. Small-scale pigment detail remains less distinct than the hard-edge designs.

Published app commit: `ce131a1c2170765365ff8060fd3dcded10efd414`. [CI and Pages passed](https://github.com/Ademord/gmail-signature/actions/runs/34131611086): **170 tests passed, zero failures or skips**, sixteen artwork checks, the expected runtime version, and a 50-file build. The independent release check matched 73 HTTP responses against Git blobs: 50 canonical assets, sixteen versioned script/style URLs, the root page, and six raw GitHub PNG URLs used by email exports. Root reloaded the hosted editor and verified all six new artwork images decoded at 304 × 728 and all six theme choices existed. Hosted verification only opened and closed the library; the personal draft was not exported or changed. A documentation-only follow-up records this result without changing runtime files.

Existing constraint: on some compact Contour/Editorial cards, a large portrait fills the artwork slot; the selected pattern remains in the draft and returns when the photo is removed. The supplied abstract themes use compositions with room for the artwork. Real Gmail send/receive remains the previously recorded external check; this artwork extension makes no new email-client compatibility claim.

## Previous design-studio gauntlet

- Working checkout: this repository, branch `codex/signature-design-studio`, starting at `3c46e99`. The original checkout and private backups are preserved.
- Reference: real HubSpot Email Signature Generator, https://www.hubspot.com/email-signature-generator. Fresh paired captures have actual DOM viewports of 1280×720; mobile checks use 390×844. Earlier requested viewport sizes did not apply to the reference tab, so those earlier captures are not treated as a matched comparison.
- Eight agents built and reviewed the studio across waves: renderer, studio UI, artwork/roadmap, portrait critic, studio critic, release critic, AI builder and extension critic. The resumed release uses six independent roles: regressions, public boundary, GUI, documentation, photo/AI contracts, and final release. Lead integrates fixes and deployment.
- Six new designs: Orbit, Studio, Contour, Prism, Editorial, Signal. Original remains available. Designs change composition, artwork and palette. Fields, dimensions, themes, icon choices, HTML/PNG, history and session backups must remain usable.
- Portraits: local JPG/PNG/WebP upload; bundled Pico worker detects face regions; manual pan/zoom, multi-face choice, brightness, monochrome, mirror, shape/size, square crop download and removal. Uploaded crop stays in local storage/JSON/PNG. Clickable HTML needs a hosted square photo URL; do not silently embed unsupported local data in email HTML or upload a photo to a service.
- Galaxy, Starlight, Moonlight (Sailor Moon inspired) and Frost Crown (Frozen Throne inspired) collections add four sets of procedural artwork and palettes. Original and all six new geometries remain available.
- External-AI workflow works in seven sections: visible prompt, optional manual selection, editable examples, strict JSON response validation, separate proposal preview, one-step apply/undo and stale-proposal rejection. Custom layout recipes choose a base composition, name font and alignment; custom artwork uses bounded native-table pixel patterns. Default prompts omit identity, contacts, photo data and URLs. No model API call or upload service.
- User flagged crowding after the first integrated studio. The final editor moves galleries into a Browse designs library with Layouts/Themes/Artwork tabs and uses contextual AI links. Root browser checks and independent image/source review approve the revised UI. Updated README screenshots show the actual final workspace and dialogs.
- Signal right-shift cause fixed: the first spacer row now declares all three frame columns. Root Codex browser and independent screenshot review confirmed the aligned frame, including a photo. The latest user screenshot depicts the pre-fix frame; recheck after final refresh/publication.
- Selective imports now have Information and Design checkboxes. Unselected fields stay; Design includes saved themes and photo formatting, Information includes the photo itself. Copy cleanup supports email escape artifacts and identical Markdown URL wrappers and reports each cleanup. User's exact pasted example validates with three cleanups; its contents are only in ignored `.private/`.
- Gmail check attempted: available browser redirects to Google sign-in. No authenticated Gmail session is available and no test email has been sent. Finish other work; a real send/receive check needs user sign-in and explicit test-send authorization.
- User explicitly chose Codex's browser instead of personal Edge. Actual Codex downloads were found in the OS Downloads folder: JSON 34,132 bytes, SHA256 `632126046560D79BB6247A84C31C8483DF0FB56B68A202A60EBABE3C9A804A49`; portrait PNG 2648×832, 272,069 bytes, SHA256 `BAB63A2B0A2DF3E32C556CDFC97826550160C4459E6589909D5CBCA4C49FE0D8`. Native Edge automation was stopped by its URL-confidence safety check and is no longer the selected browser path.
- Resumed hosted check found the personal session already restored on the older release. Its 23 fields and one theme were exported to an ignored private backup before publication; verify them again after the upgrade. Public screenshots use generic details and the licensed NASA test photo.
- Local verification: the original 155-test suite has 154 passes and one Windows symlink skip; all six new independent cache regressions also pass. Final Linux CI runs **161 tests, 161 pass, zero failures or skips**. All ten generated PNG assets and editor asset versions pass deterministic checks; production build has **44 allowlisted files**, with matching HTML entry points and no private profile matches in publishable source. Original backup copies still match `4A43FCDFFDB2A05ACDEF378626AA50BE61368E651BE60D4CD4C5FC3B7CBE11ED`.
- Final Signal PNG from Codex downloaded to the OS Downloads folder: 2648×832, 260,417 bytes, SHA256 `A53BB2E3C9A6709D2EC65EE0EF4C70C0442C6482160D67B2C1F0DD49CD0FCA4A`. Its frame and portrait were checked in the real preview; earlier renderer browser matrices tested 674 fitting cases and 68 decoded PNG cases.
- Root browser: Design-only import retained Avery and the portrait while applying Signal/Frost; Undo restored Orbit/Galaxy. Information-only imported Jordan while keeping Galaxy; Undo restored the photo. Mobile import and library dialogs have equal client/scroll widths (335 and 369 px at a 390×844 viewport). Library keyboard tabs, selection close/focus return, and Custom artwork → AI dialog transition work. See the independent follow-up in `docs/reviews/ai-extension-2026-09-07.md`.
- Resumed GUI critic found focus was lost after closing AI launched from the artwork library. The library now returns focus to its original workspace launcher when the next dialog closes. Root Codex browser verified Escape, Close, and Apply; all three returned focus correctly. Fresh regression review reconfirmed 154 passes / one Windows skip and byte-for-byte 44-file build parity. Public boundary review found no private contact payloads, backups, secrets, or personal photos in the current release files.
- Initial studio publication `696b70e` passed [CI and Pages](https://github.com/Ademord/gmail-signature/actions/runs/34118405960): 155 tests passed, no skips, ten artwork checks, 44 public files. The independent critic confirmed all 44 deployed files matched Git blobs. Actual browser upgrade then exposed cached old JavaScript mixed with the new HTML. This invalidated the live-control gate despite the correct deployed bytes. The follow-up versions every editor script and stylesheet with a deterministic runtime hash and passes that version through the portrait worker to its detector/model. CI rejects stale HTML versions before building.
- Final app release: `cf17f27ffc3f97bcccb1f1332ed6551722c09dd7`, [161 passing tests and successful Pages deployment](https://github.com/Ademord/gmail-signature/actions/runs/34119031821). Independent parity checked all 44 canonical files and 19 versioned script/style/worker/vendor URLs against committed bytes. Runtime version: `9e64998744205214`. Root reloaded the same previously stale hosted tab and verified the complete editor, aligned Signal with a portrait, Galaxy selection, AI preview/apply/Undo, and both selective import paths. [Six-role resumed review](docs/reviews/resumed-release-2026-09-07.md).
- Hosted personal session is restored and verified. Exported state matches the original backup after migration across all 31 draft fields, the saved theme, and restored UI settings. Draft and theme remain equal after refresh. As before, a new page load opens the Design editor tab; this is not claimed to preserve the active tab. Private exports remain ignored and both original backup hashes are unchanged.
- Final live smart crop succeeded with the NASA fixture. PNG export decoded at 2648×832 and reached the OS Downloads folder: 312,457 bytes, SHA256 `301A5C44BD0C01C869D7614D9D1A5D77DE72575497A3402CA8BE89927B08DCB2`. Gmail was rechecked in Codex's browser and redirects to the public landing/sign-in page; no test message was sent.

| Current gate | Expected evidence | Status |
| --- | --- | --- |
| Seven designs / patterns / palettes | Real controls, distinct compositions, reversible changes without losing contacts | Passed, including final library |
| Private smart portrait workflow | Real image detection and crop, manual adjustments, preview/PNG/JSON, safe HTML photo URL handling | Passed; saved crop Adjust also verified |
| External AI and recipes | Privacy, strict section contract, actual preview/apply/history/session and failure recovery | Passed independent core and Codex browser review |
| Selective import | Information/Design/both preserve unselected state; copied-text recovery | Passed independent tests and root browser checks |
| Regression suite and public build | All existing journeys plus new independent expectations; exact allowlist | Passed: 161/161 in Linux CI, 44 files; local Windows symlink skip covered in CI |
| Independent visual comparison | Same-size real reference/artifact captures and critic verdict | GUI wins nonblind; final declutter also approved independently |
| Exact-commit CI / Pages | Successful run, reviewed source published, critical live controls exercised | Passed for cf17f27, including cache-upgrade repair and live controls |
| Hosted personal session | Back up, restore, compare, refresh | Passed; original details and theme restored, backups preserved |
| Gmail send/receive | Received signature on desktop/mobile/light/dark | Blocked: sign-in and send authorization |
| Browser downloads | Selected Codex browser download produces actual JSON/PNG files | Passed |

The following sections retain the prior released baseline; they do not claim verification of the new design-studio changes.

## Historical baseline — before the current studio extension

- Local app: this folder. Remote: https://github.com/Ademord/gmail-signature, branch `main`. Starting commit: `1edfa379cee56bf06908987fc6c99f71f1003d7f`.
- Published app commit: `a78925506dbd93c2ecf594720a634f3e81601d45`. [CI and Pages deployment passed](https://github.com/Ademord/gmail-signature/actions/runs/33995141058). [Live demo](https://ademord.github.io/gmail-signature/) verified in a fresh browser origin with Avery Morgan and zero saved themes. A documentation-only follow-up records this result; app source is unchanged.
- Session export/import is implemented and the actual private session round trip passed. Independent review approved the theme deduplication and storage recovery fixes with no remaining concrete blocker.
- Latest full local check: **84 passed, 0 failed, 1 Windows symlink skip** (85 total); production build contains **21 allowlisted files**.
- Current browser shows the generic Avery Morgan draft. The private draft was backed up first, restored through the UI, compared with the original, and only then reset again. Existing browser-local saved themes remain. Do not overwrite the backup with the sample.
- Backup: ignored `.private/session-backup-2026-09-05.json`; second copy outside the repository at `../signature-work/private-session-backup-2026-09-05.json`. Both SHA256: `4A43FCDFFDB2A05ACDEF378626AA50BE61368E651BE60D4CD4C5FC3B7CBE11ED`. Contains 23 draft fields, one saved theme, and view/export settings. Keep these files private.
- Run `npm start` with Node 22+; no dependency installation. Default http://127.0.0.1:4173. The retained preview uses port 4186, server session 2873. PowerShell: `$env:PORT='4186'`, then `npm start`.
- The sample app is published and verified. See tomorrow's TODOs below. Public screenshots have been refreshed and the clean source/private-data scan passed. No private backup files were committed. The linked run records the app release; see the repository's Actions page for subsequent documentation deployments.

## Acceptance record

| Check | Scope and expected behavior | Evidence | Status / remaining gap |
| --- | --- | --- | --- |
| Preserve personal session before sample reset | Private data stays recoverable | Two matching backup hashes; codec round trip; real UI export → reset → paste import → restore → export gave equal draft, themes and UI | Passed |
| Portable session data | JSON restores details, colors, icons, dimensions, themes and UI; malformed files do not mutate data | App integration and codec tests; real browser restore | Passed |
| Theme merge and storage recovery | Existing themes remain, repeat imports reuse matching themes, failed storage is reported accurately | Independent critic approved 40 focused tests and separate cross-session collision, selected identity, reload and repeated storage-failure checks | Passed |
| Public source and site boundary | Generic data only in current files; backups excluded | Explicit 21-file build/server allowlist; private-marker scan and clean ZIP script; reviewed commit file list | Passed |
| GitHub CI | Reviewed commit runs all required tests and build | Linked run for a789255: 85 passed, 0 failed, 0 skipped; build, artifact upload and Pages deployment all succeeded | Passed |
| Public hosted demo | Fresh sample, working controls, loaded icons and PNG export | Live JSON export → name edit → paste import restored Avery; all preview images loaded; generated PNG 2648×832; sample retained after reload | Passed |
| Responsive editor and dimensions | Usable laptop/mobile/short windows; export dimensions match controls | Browser sizes 1440×900, 1366×768, 390×844 and 1000×600; no page-width overflow | Passed |
| HD PNG | Selected layout, colors, icons and dimensions retained | Local decoded PNGs at three resolutions/layouts with pixel checks; hosted 2648×832 PNG preview inspected; docs/export.png is the live site | Passed |
| Undo/Redo | Edits, invalid input, reset and draft imports recoverable | Real color/invalid-height UI checks and history/app regressions | Passed |
| Transparent icons on light cards | No solid icon boxes; readable artwork | Preserved all source alpha bytes; 4096 sampled backgrounds at ≥3:1 ink contrast; browser and PNG inspection | Passed |
| Real sent/received Gmail rendering | Gmail preserves pasted markup on desktop and mobile | No real Gmail message has been sent | Not performed; compatibility check remains |
| Portable offline bundle | Run without a local server or network | Clean source ZIP is provided for development, not claimed as an offline app | Not selected |

## Historical implementation notes

- `index.html` and `signature.html` are identical editor entry points. Keep both synchronized.
- `signature-core.js` owns generic defaults, normalization, validation, HTML and plain-text rendering. All preview/export paths use this renderer. Optional empty contact rows disappear. Titles use the original regular monospace styling.
- `app.js` owns form state, local persistence, themes, history integration, previews and clipboard actions. `editor.css` owns layout. Short windows scroll naturally; preview scaling does not change export dimensions.
- `editor-history.js` stores up to 100 undo steps per page session, coalesces continuous typing, and clears redo after a new edit. Draft history does not mutate the theme library.
- `signature-image.js` exports 2×/4×/6× PNGs from the same HTML through embedded assets and canvas. It validates dimensions, decodes assets, aborts failures, and rejects stale renders. Default assets load locally; custom image hosts must permit reads.
- `session-data.js` validates versioned JSON and merges themes. `session-controls.js` supplies file/paste import and download/copy export. Files over 1 MiB, unsupported versions, unsafe values and malformed data fail before restore. Slow file reads cannot overwrite newer pasted content.
- Session restore writes the draft and themes with rollback on storage failure. The current tab still works if saving is blocked; a later successful draft save retries imported themes too. View/export settings restore from JSON. Undo history is not exported.
- Theme presets: Original, Midnight, Spruce. Saved themes contain their name and three colors; collision-renamed imports retain optional `importedFromName` metadata. Dedupe uses the full source name and colors, never a truncated display-name guess. The app loader and session codec preserve that identity. Updating a saved theme intentionally makes it independent. Save/update/delete, deletion Undo and local reload are covered. Applying a theme preserves contacts and layout.
- `sig/` has the grid plus five cream and five charcoal transparent icons. `scripts/prepare-icons.mjs` regenerates charcoal variants using Node built-ins while preserving dimensions and alpha. The renderer selects cream/charcoal against the contact-card color.
- `scripts/public-files.mjs` is the explicit build/server boundary. Do not replace it with a recursive folder copy. Site output excludes docs, Git metadata, notes and backups.
- `.github/workflows/pages.yml` runs tests and builds on main pushes/PRs/manual dispatch. Only main non-PR runs deploy to Pages. This workflow does not configure branch protection.
- `../signature-work/package-source.py` builds the clean development ZIP, scans private profile markers, validates archive integrity and excludes `.git` and `.private`. Run again after final docs changes.

## Review history and verification limits

The initial gauntlet used three builders (GUI, renderer, release/tests) and three separate critics in waves, then the lead integrated the work. The real visual reference was HubSpot's signature generator at 1440×900. The critic preferred this editor. Blindness was limited because the reference retained identifiable product text; this is not a fully anonymous comparison or proof of world-leading design. Initial reviews are under `docs/reviews/`.

Independent review caught and verified fixes for wide-name overflow, malformed email addresses, unsafe image paths, clipboard fallback selecting local URLs, misleading storage status, and compact legacy drafts being reset when icons were added. Later checks cover corrupted assets, image-render cancellation, history, transparent icon variants and session restoration. Do not treat earlier reviews as coverage of later changes without checking them.

Public screenshots use only generic example data. Actual personal HTML, draft links, screenshots and PNGs are ignored under `.private/`. Browser download buttons were invoked and Blob contents checked, but an OS Downloads save was not confirmed; UI says download requested and offers copy/right-click alternatives.

The repository was already public before this work. Old commits contain personal contact details; replacing current files and using an allowlisted build does not erase that history. No force push, history deletion or visibility change was performed. Hosted preview artwork and embedded PNG export now load successfully from the Pages site. Real email-client fetching of exported public image URLs remains part of the Gmail test below.

## Historical TODOs — superseded by the active gate table above

- Import the private session backup on the hosted editor when ready to use the personal signature there. The local and hosted sites have separate browser storage.
- Paste a signature into Gmail and inspect an actual received message on desktop and mobile, including light/dark mail views. This has not been verified by sending email.
- Check JSON and PNG downloads in the user's usual Chrome/Edge browser; automated checks inspect the contents but do not confirm the native Downloads folder.
- Optional: decide whether to offer custom icon uploads. Current choices cover the five bundled icons and None; arbitrary icon uploads are not implemented.
- Handle further visual preferences after using the published editor. Preserve the original role typography and transparent icon contrast.

## Normal updates

1. Back up the active session with Export data before clearing browser storage or changing site address.
2. Edit the source, keep the two HTML entry points equal, and run `npm test` and `npm run build`.
3. Review the exact files to commit; exclude personal exports and `.private/`.
4. Push main and inspect the workflow for that commit. Open the deployed page, refresh, and verify the changed controls.
5. Update this handoff with actual evidence. Preserve plain UI copy, generic public defaults, the static architecture and the user's private backup.
