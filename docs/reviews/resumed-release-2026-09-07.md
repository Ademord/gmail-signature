# Resumed release review — 7 September 2026

The user requested six agents for the resumed gauntlet. Six independent roles reviewed regressions, the public boundary, the GUI, documentation, photo/AI contracts, and final release evidence. They worked in waves; the lead integrated fixes and performed live Codex browser checks. This record contains synthetic test evidence only.

## Findings and repairs

- Regression review reran the existing 155 tests: 154 passed, with one Windows symlink-permission skip. The release critic verified that Linux CI executes and passes that symlink check.
- Public boundary review inspected the tracked artifacts, screenshot metadata and representative images, vendor provenance, the explicit 44-file build, and actual denied private routes. No private contacts, exports, original photos, or secrets were found in the new release payload. Public screenshots use fictional Avery/Jordan details and the public NASA fixture. Existing public Git history was not rewritten.
- The GUI critic exercised 1280×720 and 390×844 layouts in Codex's browser. The smaller workspace, aligned Signal frame, library keyboard navigation, and selective imports passed. Custom artwork → AI → Escape lost focus because its original button was inside a closed dialog. The library now returns focus to its workspace launcher after the AI dialog closes. The lead verified Escape, Close, and Apply independently in the actual browser.
- Documentation review corrected pattern-generation coverage to all ten motifs and clarified Reset design. The roadmap distinguishes shipped features from future compact layouts, complete presets, and asset hosting.
- Photo/AI contract review passed 37 focused tests and separate deferred-operation, preservation, and 42-combination probes. It caught differing rounded masks in the crop editor and final signature. The repair passed nine size/shape probes, matching the final 12 px radius at 40, 64, and 96 px.
- The first published studio commit passed CI and static parity, but a persistent browser tab reused old scripts with the new HTML. The lead reproduced the incomplete Composition selector and fixed runtime asset versioning. Six independent regressions cover all sixteen required script/style links, missing-link rejection, a stale-source mutation, repair, cross-platform line endings, dependency invalidation, and worker/model version propagation. CI checks versions before build.

## Reviewed release evidence

App commit: `cf17f27ffc3f97bcccb1f1332ed6551722c09dd7`. [Exact-commit CI and Pages run](https://github.com/Ademord/gmail-signature/actions/runs/34119031821).

The independent final critic read the actual job logs: Node 22.23.2, **161 tests passed, zero failures or skips**, all ten generated motifs checked, asset version `9e64998744205214` verified, and 44 public files built. Both build and deploy jobs succeeded for the reviewed SHA. The critic fetched 44 canonical assets plus 19 versioned script/style/worker/vendor URLs; all 63 returned HTTP 200 and matched Git blob bytes. Canonical runtime payload: 649,233 bytes. Static parity is recorded separately from interactive verification.

The lead reloaded the same formerly stale hosted tab. The new scripts initialized all six editor sections, eight Composition options (including the conditional custom option), and fourteen Pattern options. At an actual DOM viewport of 1280×720, Signal's frame and NASA portrait aligned and every preview image decoded. Galaxy selection, custom AI artwork preview/apply/Undo, Design-only import preserving identity/photo, and Information-only import preserving Orbit/Galaxy all passed.

The live saved-crop Adjust → Smart crop workflow framed a face. PNG export decoded at 2648×832 and produced a real Downloads file of 312,457 bytes, SHA256 `301A5C44BD0C01C869D7614D9D1A5D77DE72575497A3402CA8BE89927B08DCB2`.

The existing hosted personal session was backed up before testing and restored afterward through the real import controls. All 31 migrated draft fields, the saved theme, and restored UI settings matched the private backup. Draft and theme still matched after refresh. A new page load opens the Design tab; active-tab persistence is not claimed. Original private backup copies remain intact. No personal screenshots were added to the public review.

The independent visual critic inspected the actual current studio/library captures alongside the established HubSpot reference and preferred this editor for the selected signature-design workflow. This comparison was **nonblind**. It does not establish received-email fidelity.

## Verdict and remaining boundary

The implemented editor, reviewed source, CI, public deployment, live controls, downloads, and hosted-session restoration pass. A documentation-only follow-up may record this evidence without changing runtime assets.

The overall gauntlet remains **HOLD for real Gmail send/receive verification**. Codex's browser was rechecked and has no authenticated mailbox; a test message also needs explicit send authorization. No email was sent and no desktop/mobile/light/dark received-message result is claimed. A portable offline application was not selected.
