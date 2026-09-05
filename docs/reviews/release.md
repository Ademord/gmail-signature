# Independent release, privacy, and accessibility review

Reviewed 2026-09-05 against the explicit bar: a working local demo prepared for a user GitHub push; generic public source; personal data confined to browser storage or private local files; editable identity, title, and portfolio links; copy, download, share, reset; keyboard operation, associated field errors, and usable mobile/short-window controls.

Scope: actual `app.js`, `index.html`, `signature.html`, `editor.css`, shared renderer contract, all scripts and Node tests, `.gitignore`, Pages workflow, README, PROGRESS, and Git status. No app edits or shared live-browser control were performed by this reviewer. The lead was testing the live browser while this independent source review ran. Source changed during review; findings below were rechecked against the changes.

## Verdict

No open high-impact app/release/privacy findings remain from this review. Two reproducible P2 issues were reported to the lead and corrected during review. Node tests currently pass: 13 passed, 0 failed, 1 skipped (Windows account cannot create symlinks; that case runs on Linux CI).

This is not a live Gmail compatibility verdict or an independent screenshot/viewport verdict. Those require the lead's browser checks and an actual sent/received email. The README correctly states that browser tests do not prove Gmail paste/send preservation, and that an actual successful Pages deployment is needed before a live URL can be confirmed.

## P2 — manual clipboard fallback copied local preview image URLs — fixed

Original reproduction:
1. Open the local demo with the default image base.
2. Deny/fail `navigator.clipboard.write` and make `document.execCommand('copy')` return false.
3. Activate Copy signature and follow the suggested Ctrl+C/Command+C action.
4. The selected preview originally contained `src="./sig/dots.png"`, while normal exported HTML used the public HTTPS image base. Copying that preview into email could retain a localhost/relative image reference unavailable to recipients.

Cause: the preview deliberately used `{ assetBase: './sig' }`, and the failure branch selected that preview unchanged.

Correction verified in current `app.js`: the failure branch replaces the preview with the same `core.render(draft)` HTML used by the normal clipboard export before selecting it. A Node VM execution of the real app code with both clipboard mechanisms forced to fail returned the same public `https://raw.githubusercontent.com/Ademord/gmail-signature/main/sig/dots.png` image source in the selected node and normal export. The status truthfully describes the failure and manual action.

## P2 — failed storage could be hidden on mobile and falsely described as saved — fixed

Original reproduction:
1. Make `localStorage.setItem` throw (for example, quota or storage access failure).
2. Open a valid draft link at a viewport width of 390 pixels.
3. The header-only storage warning was hidden by the <=900px CSS rule; the footer still said the draft stayed in the browser.
4. The import status claimed the draft had been saved, and a failed draft-link copy also claimed the draft was still saved locally.

Correction verified in current `app.js` and CSS: the visible rail footer now says `Not saved. Download HTML to keep a copy.` with warning styling and status semantics; the import message says only `Draft loaded from the link.`; the failed share-copy message recommends downloading without claiming persistence. A Node VM execution of the real app with failing storage confirmed all three strings. The rail footer is not hidden by the mobile breakpoints.

## Other checks

- The local server and build share an explicit 12-file public allowlist. Paths to `.git`, `.private`, notes, arbitrary files, encoded traversal, and unexpected assets are rejected. The build validates and reads all public sources before replacing the old output; tests cover stale files and missing sources.
- The Pages workflow runs tests and build for main pushes and PRs, uploads only `dist`, and gates deployment to main non-PR events. Deployment permissions are scoped to the deploy job. No script pushes, changes visibility, or rewrites history.
- Current public app values are generic. There are no form submissions, analytics calls, or server draft endpoints. Link sharing is explicit and visibly disclosed; data is encoded in the URL fragment and removed after import. Export and external image behavior are explained in the README.
- Existing commits retain personal data. The README prominently and accurately states that replacing current files does not remove it, and explains the fresh-repository/history decision. The allowlisted Pages artifact excludes repository history. A public source push still requires the user to make that documented history decision.
- Source keyboard paths are present: native controls, roving editor tabs with Left/Right/Home/End support, native modal dialog, and focus-to-invalid-field behavior including opening hidden panels/details. Errors have an input-specific element, `aria-describedby`, `aria-invalid`, and visible error styling.
- Invalid raw dimensions now produce explicit width/height errors. Earlier clamping concern is resolved by current renderer validation. Long escaped URL markup is rejected before export. Current Node suite passes.
- PROGRESS still described work as in progress at the time of this review. Before final handoff it needs the actual completed checks and precise remaining limitations; stale pending agent/work items should not be represented as the final handoff state.

## Limits of verification

The forced-failure interaction checks used the actual `app.js` in Node's VM with a minimal DOM/clipboard/storage harness. They verify the branch behavior and selected HTML but do not prove native clipboard behavior in every browser. Mobile clipping, short-window scrolling, focus appearance, and actual Gmail handling remain live-browser/email checks owned by the lead. No such checks are claimed here.
