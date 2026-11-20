# Rated420 HQ Operations verification

- Baseline `49dad9b7e2178893236810d3029d02dde8d954a8`
- Checkpoint `50d4a0c4c21591299da40817cc87174a689a3796`
- Existing sandbox https://rated420-sandbox.vercel.app/
- Sandbox deployment `dpl_F4RBYU13LopcYNAkh8cPx3AxdJhk`
- Preserved rollback `dpl_CG3jS7kQt77MWCU1wUzQKmXPVy9H`

## Browser checks

Chrome for Testing 116.0.5845.96 on Linux exercised 320, 390, 820 and 1440 CSS px. The test blocked outside-origin requests. The hosted test routed certificate-checked HTTPS bytes into Chrome. Browser runs exercised the homepage, mobile and desktop menus, catalogue, staff HQ, Founder overview, Territory Explorer and Data Intelligence.

The tests opened a catalogue queue and returned to HQ, opened a task and related thread and returned to the task and overview, verified a filtered Founder list retained its search after record inspection, and returned from a linked CRM organization to the selected region and open business profile. A synthetic contributor submission was sent to staff for review and marked Needs Revision inline. Moderator access was checked against founder-only tools. Data Intelligence regression coverage included manual imports, conflict handling, source diagnostics, history and reversion, official licensing, and local prospect creation. Existing catalogue, editorial, profile/account, community, workspace and responsive regression suites passed. The same-origin upgrade test preserved existing local browser data. Twenty-three Node checks passed.

Keyboard checks covered menu and region selection, visible focus, and scorecard sliders. At 200% root text size, the catalogue, HQ, Founder, Territory and Intelligence views fit without page-level horizontal overflow at the four widths. This check used enlarged root text. Screen-reader listening, physical touch, macOS launcher auto-open and a full WCAG audit were outside the checks performed.

## Membership gradient

At each requested width, computed colors were checked against a rendered capture of the full membership gradient with the text and button hidden. Gradient pixels were sampled across the panel. The CTA was measured on its own solid background.

| Element | Lowest measured contrast |
|---|---:|
| Pearl heading and supporting copy over the gradient | 7.68:1 |
| Green emphasis and eyebrow over the gradient | 5.98:1 |
| CTA text over its own dark surface | 13.10:1 |

## Preservation and distribution

The official NYS snapshot, images and fonts match the baseline. Provider availability describes the bundled official snapshot and local adapters. Commercial providers remain disconnected. Anonymous requests matched all 57 public sandbox files and their noindex and isolation headers. Internal notes and the launcher are only in the distribution. The prior sandbox and live homepage matched their pre-deployment bytes. No production-domain or production-data changes were performed.

The included PDF has paired views at 390 and 1440 CSS px. It shows the homepage membership section and catalogue cards, navigation, catalogue, HQ, Founder, Territory Explorer and Data Intelligence.
