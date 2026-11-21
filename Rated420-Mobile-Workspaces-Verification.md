# Rated420 mobile workspaces verification

- Source checkpoint `a302adb29c616f8e49624cf14e9b22c695a4e5e1`
- Baseline `50d4a0c4c21591299da40817cc87174a689a3796`
- Sandbox deployment `dpl_3eD4uMV1xwhDYWyTj4761STvzbA4`
- Preserved rollback `dpl_F4RBYU13LopcYNAkh8cPx3AxdJhk`

Chrome for Testing 116.0.5845.96 on Linux exercised 320, 375, 390, 430, 820 and 1440 CSS pixels. The four phone-sized widths used synthetic browser touch with a 667 CSS-pixel viewport height. Hosted tests loaded certificate-checked same-origin HTTPS responses. The offline verification blocked external requests. The before-and-after reference pairs expanded Explore, Community and About at 390 px and HQ, Founder and selected Territory at 390 and 1440 px.

## Navigation

The mobile menu used consistently sized, left-aligned rows with a 44 CSS-pixel minimum, no per-row borders, a single scrolling panel and one expanded group. The test checked scroll access to the last Explore link and verified closing with Menu, Escape, an outside click and destination activation. Keyboard tests checked Tab entry, Escape focus restoration and focus visibility. The menu continued to fit horizontally at 200% root text size. The toolbar kept the sandbox label visible while demo roles remained available through its disclosure.

## Workspaces and data

Tests covered inline moderator review, Founder task and correspondence links, restoring list search after opening a record, switching territory by keyboard and returning from a CRM record to the selected territory and open item. Regional labels showed the same official location count as their selected-region summary. Tests also exercised source diagnostics, the catalogue and role restrictions, reduced-motion mode and page fit at 200% root text size. The same-origin upgrade preserved pre-existing local storage, CRM and import history. Catalogue, editorial, unified ecosystem, responsive and Data Intelligence regressions passed, along with 23 Node checks.

## Isolation and limits

The original NYS snapshot, bundled images and fonts matched the baseline. Commercial provider simulations remained disconnected from external services. The live Rated420 homepage and the rollback homepage matched their before copies. Real iPhone/iOS Safari, VoiceOver, physical touch, native browser text zoom and macOS launcher auto-open were not tested. Root font enlargement and browser-emulated touch are separate from those device checks.
