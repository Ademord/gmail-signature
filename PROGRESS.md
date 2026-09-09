# Progress

## Artwork controls milestone — released; work stopped

The requested milestone is complete: visible side-artwork size/position controls, four AI-inspired patterns, and a separately selectable Classic red/Plum editor appearance. The user requested a documented checkpoint, push, and stop; no further feature implementation is running.

Final local suite:239 tests,238 passed,0 failures,1 expected Windows symlink skip. Runtime601766014a69fa59; strict build69files. Desktop and391px phone journeys, Undo/reload, photo-space reservation, unchanged signature fields across appearance changes, and1284×1744PNG generation were checked in Codex's browser. Neutral legacy artwork markup remains byte-identical. App commit `c89e051c3045f986a27f26be3240252e50d22ef1` was pushed to main. [CI and Pages succeeded](https://github.com/Ademord/gmail-signature/actions/runs/34293224682); all 104 checked public URLs match that commit (69 canonical files, 19 versioned resources, 16 raw email artwork URLs). The live browser loaded the new controls and Classic red skin and preserved all 35 existing form fields, adding only the three optional motif controls.

[Complete scoped evidence and resume limits](docs/reviews/artwork-controls-2026-09-09.md). Built-in PNG shape/ink edits require replacement via drawing or AI; received Gmail/Outlook remains unverified. Work is stopped. Wait for a new request.

## Interaction simplification — 9 September 2026

The user finds the editor awkward and repetitive. They asked for direct left/right browsing as well as dropdowns, removal of duplicated size information, and a review based on the reusable method from their other local project. The applicable principle is to start with the real task, remove unnecessary decisions, fix the observed path, and have an independent critic challenge both usefulness and evidence. This is a design hypothesis grounded in the user's feedback, not a measured usage study.

The actual baseline browser showed six editor tabs, two Copy signature buttons, and the identical `662 × 208 px` total in the sizing explanation and under the canvas. To compare layouts or artwork, users had to open a dropdown or gallery for each direct choice. Prior local reference captures remain available; this pass uses the real released editor as the task baseline.

The agreed change has four tabs: Design, Colors, Details, Photo. Design gains Previous/Next controls around its native layout/artwork dropdowns. Each step changes one choice and creates one Undo step, skips unavailable custom choices, wraps predictably, and retains unrelated fields and custom recipes. Size & arrangement moves into a closed Design disclosure with direct Wide/Tall buttons; Contact icons moves into a closed Details disclosure. Total dimensions remain beneath the canvas. One Copy action stays beside the result; normal duplicate save text, the Edit colors shortcut, and repeated explanatory copy leave the main surface. Backup & restore remains accessible in a closed disclosure.

Ownership: lead application integration and Codex browser; independent purpose reviewer; independent journey/test reviewer; HTML/CSS builder. The purpose review approved the plan, not its implementation. Preserve legacy session tab identifiers by mapping Layout to the opened Design sizing disclosure and Icons to the opened Details icon disclosure. Validation must open every collapsed ancestor before focusing an invalid field. All seven AI sections, export formats, and stored draft contracts remain supported.

| Check | Expected evidence | Status |
| --- | --- | --- |
| Direct comparison | Real arrow clicks update the canvas; repeat/Undo/native select remain usable; full hit targets and stable focus | Passed actual desktop clicks, phone keyboard activation, and independent state tests |
| Less repetition | Four tabs, one Copy action, one total-size readout; complete sizing/contact paths remain reachable | Passed actual controls and scoped purpose review |
| Recovery and compatibility | Enabled custom choices, legacy tab imports, invalid nested-field focus, unchanged unrelated fields | Passed 47 interaction tests, causal mutation, actual export-validation and legacy Icons import |
| Independent comparison | Critic reviews actual before/after desktop and phone paths | Passed scoped nonblind review; phone uses the existing edit/preview links |
| Integrated delivery | Current token, retained suite, 65-file boundary, exact CI and live resources | Passed app commit e59d7d6: 228 Linux tests, successful Pages deployment, 96 matching public URLs |

Final runtime token: `58e82c029a055915`. The HTML entry points match and the build contains 65 public files. Local checks: 228 tests, 227 passed, zero failed, one expected Windows symlink skip. The independent journey reviewer verified that all seven new tests fail against the old baseline; restoring only nearest-disclosure validation causes the nested image-base case to fail. Actual browser evidence and its limits are detailed in the [interaction review](docs/reviews/interaction-2026-09-09.md). The critic's final footer recommendation was implemented as a quiet two-row action block. Phone screenshot output has a compositor limitation; do not infer exact scrolled geometry from those images. Direct DOM observations and repeated native-key activation establish the reported phone fit and scroll behavior.

Published app commit: `e59d7d62789534a9fcc8ff200e97a7e0a431c2c7`. [Exact-commit CI and Pages passed](https://github.com/Ademord/gmail-signature/actions/runs/34290759040), with **228 tests passed and zero failures or skips**. Independent deployment verification matched **96 of 96 public URLs** to committed bytes: 65 canonical files, 19 versioned resources, and twelve raw artwork PNGs with expected MIME/CORS headers. The live Codex browser loaded the current token, four tabs, four cycling buttons, one Copy button, and no duplicate-size paragraph. Opening Size & arrangement exposed both dimension sliders and the current Wide/Tall selection. All **35 named saved draft fields** matched before/after the upgrade. Hosted checking did not change the signature or export personal data; the release-specific URL avoids a stale cached entry page.

Earlier sections record previous releases and do not certify this change.

## Reference-inspired Plum editor — 9 September 2026

The supplied Email Signature Editor.html contains four design concepts. The comparable reference is its 1a form and live email preview: white signature, warm neutral controls, restrained violet accents, and a serif heading. The reference was rendered locally in Codex with external network requests constrained. Its bundle, fonts, example identities, and unrelated electronic-signing concept remain private and are not copied into this project.

Plum is a selectable color-only palette: white `#ffffff`, warm white `#faf8f4`, and violet `#583da6`. Fresh browser drafts and **Load example** start with it. The editor now offers eighteen unique palettes, six primary and twelve in More palettes. Saved drafts, personal palettes, and incomplete legacy imports keep their previous normalization behavior; core defaults and the legacy renderer hashes are unchanged. The warm stone workspace, paper preview, serif headings, and fixed plum UI accents adopt the reference's useful visual choices while retaining existing keyboard controls and editing flows.

**Email → Desktop / Mobile** changes preview width only. The desktop message is capped at 780 px and mobile at 390 px; both shrink to the available viewport. No exported dimensions, signature HTML, draft links, session fields, or undo history change when switching. The note explicitly describes a width preview rather than email-client emulation.

Independent roles: reference/visual critic, regression reviewer, CSS builder/release auditor, plus lead integration and actual Codex browser checks. Local verification: **221 tests, 220 passed, zero failures, one expected Windows symlink skip**. New regressions independently cover the exact palette values and roster, fresh/reset behavior, saved data and legacy compatibility, Reset/Undo, and view-only device controls. A workspace/button selector collision was caught and fixed; the regression proves content clicks do not trigger unnecessary fitting or add button semantics to the workspace. Asset token: `ab570e96e3452b6e`; matching HTML entry points; 65-file build.

Lead browser evidence: a fresh origin starts with Plum; Forest changes the signature while UI buttons remain violet; Undo restores Plum. Desktop email context and signature frame both measure 780 px. The narrow preview measures 390 px with 366 px of signature content. At an actual 391 × 844 CSS viewport, document client/scroll widths both measure 371 px; email context and frame both fit within approximately 303 px. The reference and final desktop capture use the same actual 1707 × 960 viewport. Screenshots contain fictional Avery details only.

| Check | Scope and expected evidence | Status |
| --- | --- | --- |
| Palette/default compatibility | New drafts use Plum; saved and legacy data preserved; reversible selection/reset | Passed independent regressions and local controls |
| Preview width | Aligned message/signature frames; no export/session changes; no page overflow | Passed browser geometry and independent tests |
| Source, assets, public boundary | Fresh runtime hash; matching entry points; strict 65-file build | Passed local checks and independent audit |
| Reference comparison | Actual reference versus refreshed desktop/mobile UI | Passed scoped nonblind review; inherited Original small text remains a readability gap |
| Exact-commit CI and Pages | Reviewed commit passes and matches hosted bytes | Passed app commit 50fa641; 221 Linux tests and 96 matching public URLs |
| Real Gmail send/receive | Received messages on actual clients | Remains unverified from the prior release; no send was attempted in this UI-only extension |

Published app commit: `50fa641c2588676dca46d1fbfd8a9fb85a1ef3cc`. [Exact-commit CI and Pages succeeded](https://github.com/Ademord/gmail-signature/actions/runs/34287788001): **221 tests passed, zero failures or skips**, sixteen motif checks, twelve flow checks, current asset version, and the 65-file build. Independent deployment verification matched **96 of 96 URLs** to Git blobs: 65 canonical files, 19 versioned resources, and twelve raw email artwork PNGs with correct MIME/CORS headers. The [independent visual review](docs/reviews/plum-editor-2026-09-09.md) is scoped to this refinement and records the remaining compact-type limitation.

The hosted browser initially retained its cached prior entry page. A release-specific URL fetched the current HTML and all resources at `ab570e96e3452b6e`; the independent checker confirmed canonical URLs also serve current bytes. Eighteen palettes and the violet controls loaded. Existing named form fields were compared before/after and remained identical; no hosted palette, personal text, or photo was changed or exported. Live Email → Mobile aligned both frames at approximately 390 px while leaving dimensions at 662 × 208 px. Keyboard ArrowRight moved Colors to Icons with visible plum focus locally. Refresh the page if an older interface remains cached.

The sections below preserve previous release evidence.

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
