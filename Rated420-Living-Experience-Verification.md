# Rated420 visual identity verification

Source: 49dad9b7e2178893236810d3029d02dde8d954a8
Sandbox: https://rated420-sandbox.vercel.app/
Vercel sandbox deployment: dpl_CG3jS7kQt77MWCU1wUzQKmXPVy9H
Preserved sandbox rollback: dpl_2MQKfk3D6NbBHLTt28A91YGUbfXY

## Functional and responsive checks

Chrome for Testing 116.0.5845.96 on Linux passed the living identity and catalogue suites at 320, 390, 820 and 1440 CSS pixels against the extracted package and the public sandbox. The browser test routed only same-origin assets. Hosted runs forwarded certificate-checked HTTPS responses into Chrome to avoid relying on the browser image's trust store. Local runs blocked all external page requests. The delivered launcher served the package under Linux; its macOS auto-open behavior was not tested.

Checks included catalogue search, category and format changes, compact layout, Treehouse and RYTHM media layout, demo role switching, staff proposal review and publication, browser-local image approval, original scores, same-origin state carry-forward, navigation fit, reset, local account flows and the existing homepage slideshow. A responsive regression sweep also passed from 320 to 1920 CSS pixels. The editorial, unified ecosystem and Data Intelligence browser suites passed. The Data Intelligence reset test hit an execution-context race on the initial parallel run and passed on its own rerun. The build isolation, contact handler and Data Intelligence test files passed all 23 Node checks.

## Keyboard and accessibility checks

Keyboard checks covered tab focus, visible focus outlines, an Enter-operated Play/Pause control and native slider Home/ArrowRight operation. Reduced motion started the slideshow paused. Text enlargement used a 200% root text size and confirmed the catalogue search, results and horizontal fit at all four widths. Full-site browser zoom and physical touch were not tested.

axe-core 4.10.3 checked the six screenshot routes at 390 and 1440 px against the extracted ZIP and public sandbox. It reported zero automatic violations for the tested A/AA rules and requested manual color review at these element counts:

| Route | 390 px | 1440 px |
|---|---:|---:|
| Homepage | 39 | 38 |
| Product catalogue | 2 | 1 |
| Treehouse | 3 | 2 |
| RYTHM | 2 | 1 |
| Strain scorecard | 46 | 55 |
| Catalogue Manager | 1 | 0 |

Counts include gradients, pseudo-elements and symbol-only details. Some were sampled separately below. A full manual review of every flagged element, live-region announcements, reading order and screen-reader operation remains open. No screen reader was used, and these results do not establish WCAG 2.2 AA conformance.

## Contrast measurements

For gradients and atmospheric backgrounds, foreground colors came from computed styles and backgrounds from matched Chrome pixel captures with text hidden for sampling. Values below use the lowest ratio sampled in the interior text area across 390 and 1440 px. Solid control, slider and focus pairs were checked against their adjacent surface colors.

| Reference | Ratio | Applicable target |
|---|---:|---:|
| Primary button label over the action gradient | 13.01:1 | 4.5:1 |
| Homepage hero heading over its background | 12.62:1 | 3:1 |
| Homepage hero body copy over its background | 8.61:1 | 4.5:1 |
| Membership accent label over the section gradient | 6.42:1 | 4.5:1 |
| Catalogue entity label over the card | 11.08:1 | 4.5:1 |
| Scorecard category label over the form | 15.07:1 | 4.5:1 |
| Search border against the field | 6.06:1 | 3:1 |
| Slider track against the form | 5.71:1 | 3:1 |
| Focus ring against the deep control surface | 12.26:1 | 3:1 |

The samples represent specific controls and adjacent surfaces. Disabled states are present in the design, but these measurements are not an exhaustive check of every foreground/background combination.

## Performance and isolation

The static manifest grew by 10,297 bytes before transfer compression (about 0.38%). Image, font and OCM snapshot bytes stayed the same. No external runtime dependency, visual effect service, or external asset request was added. No frame-rate benchmarks or field Core Web Vitals were collected.

Anonymous HTTPS requests matched all 57 public files, the indexing directives and the isolated Content Security Policy. Launcher, source notes and the visual references are included in the ZIP only. The live Rated420 homepage and the prior sandbox rollback homepage matched their pre-deployment bytes. The preview uses synthetic local functionality and retains independent browser data.
