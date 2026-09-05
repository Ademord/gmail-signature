# Renderer critic — verified revision

Rechecked the integrated `signature-core.js` independently on 2026-09-05. SHA-256: `91822a2086e8fff20f01a7e1da3c2146497dae81d98b7189c106d5f150a71990`.

**Verdict: all three reported defects are resolved for the original reproducers. No unresolved code-proven defect remains from this review.**

| Finding | Status | Independent recheck |
| --- | --- | --- |
| P1: accepted wide-glyph names | Resolved at renderer validation boundary | Fourteen `m` characters in either name line now produce a field error; both HTML and plain-text export reject them. Glyph-specific estimates replace the generic width. A 28-character `m` title wraps into 15 + 13 characters; a 43-character title is rejected for exceeding two lines. |
| P2: malformed email domains | Resolved | Original three domains, consecutive dots, a 64-character domain label, and a 65-character local part are rejected. HTML and plain-text export both reject them. A 64-character local part remains accepted at sufficient card dimensions. |
| P3: protocol-relative asset overrides | Resolved | Original network paths and triple-slash variants throw. Relative and percent-encoded traversal, HTTP traversal, JavaScript scheme, and loopback HTTP overrides also throw. Five ordinary relative/public asset-folder forms still export correctly. |

Verification: all 13 current Node tests passed. Additional independent assertions covered 2 rejected name cases, 6 rejected email cases, 11 rejected asset cases, 5 accepted asset-folder forms, and 18 combinations of both layouts with widths 280/321/420 and heights 180/208/320. Every accepted dimension case validated, exported the expected outer dimensions, and remained below 10,000 characters (6,881–6,903 characters).

No browser was used during this revision check. The original overflowing input now cannot reach the renderer; broader rendered geometry, clipboard behavior, and Gmail paste fidelity remain the lead's verification scope. Attribute checks do not prove email-client layout.

## Original findings and reproducers

Scope: independent inspection of `gmail-signature/signature-core.js` and its nine Node tests. Existing tests passed. They inspect declared table dimensions, escaping, and representative inputs; they do not establish rendered text containment or Gmail paste fidelity.

### P1 — Accepted name text can overflow its allocated column — resolved

Reproducer:

```js
const value = { ...core.defaults, nameLine1: 'mmmmmmmmmmmmmm' };
core.validate(value); // {}
core.render(value);   // succeeds
```

`units()` assigns lowercase `m` and `w` the generic 0.58em estimate, while the resulting Arial bold glyphs are wider. `plan()` uses that underestimate to approve the name, and `textRow()` emits `white-space:nowrap`. There is no clipping or final browser measurement. The lead's browser probe confirmed a 274px name inside a 202px text cell for this input. Card dimensions declared in HTML therefore do not ensure content stays inside the front card. Use conservative actual-font width estimates and a regression covering wide-glyph names; test title wrapping with the same glyph family. The repeated-letter case is an adversarial width probe, not a typical personal name.

### P2 — Invalid email domains pass validation and become active links — resolved

Reproducer:

```js
for (const email of [
  'hello@-example.com',
  'hello@example-.com',
  'hello@.example.com'
]) {
  const value = { ...core.defaults, email, height: 260 };
  core.validate(value); // {} for each
  core.render(value);   // contains the corresponding mailto link
}
```

`emailOK()` allows the domain character class `[a-z\d.-]+` without checking individual DNS labels. It rejects consecutive dots but accepts an empty first label and leading/trailing label hyphens. The UI promises a valid email address but permits these broken contact addresses. Validate domain labels separately and add all three cases to rejection tests. The accepted 65-character local part (`'a'.repeat(65) + '@example.com'`) is another missing email-length boundary.

### P3 — Asset override accepts network paths disguised as relative folders — resolved

Reproducer:

```js
core.render(core.defaults, { assetBase: '//localhost' });
// emits src="//localhost/dots.png"
core.render(core.defaults, { assetBase: '//evilhost' });
// emits src="//evilhost/dots.png"
```

The relative-folder regex accepts any slash prefix, so protocol-relative network URLs bypass `webURL()` and its public-host checks. This affects the renderer's options API; the editor's ordinary `imageBase` field follows the stricter path. Reject double-slash/network prefixes before accepting a relative folder. No script execution was found from these values.

## Remaining evidence limits

The lead owns browser geometry and clipboard verification. This review did not independently paste into Gmail or test another email client. The exported table attributes and Node tests alone cannot establish Gmail sanitization behavior, fallback-font metrics, exact final dimensions after paste, or image accessibility. URL-scheme and text-escaping probes did not produce an executable HTML injection; encoded control characters inside an ordinary HTTP path are not evidence of script execution.
