# Rated420 Visual Identity & Living Experience

The preview follows Catalogue Intelligence checkpoint `232dee8c2f99f4b733493cf3a50f5009be7dbe19`. The preserved sandbox rollback is `dpl_2MQKfk3D6NbBHLTt28A91YGUbfXY`. The preview uses the same browser-local accounts, catalogue, review and HQ workflows. The bundle keeps the original image bytes and local fonts. See the included before-and-after reference for the homepage, catalogue, Treehouse, RYTHM, review scorecard and Catalogue Manager.

## Tokens and type

| Role | Token or value |
|---|---|
| Foundation | Midnight `#110C20`, deep surface `#181227`, default surface `#20172F`, raised `#2B1E3C` |
| Reading | Pearl `#F2EFF7`, secondary text `#C9BDD9`, disabled text `#AE9EBF` |
| Accent | Purple `#DFC5FF`, green `#9CE5BF`, selected background `#41236F` |
| Atmosphere | Amethyst `#503779` to deep emerald `#235344`; reserve stronger gradients for the hero and membership surfaces |
| Primary action | Lavender `#E3CAFF` through pale jade `#B1EFD2`, with Midnight text |
| Controls | Visible edge `#A18DB5`, focus outline `#E3CAFF`, destructive text `#FFC1CE` over `#412032` |
| Typography | Bundled DM Sans for body text and controls, Space Grotesk for headings, tabular numerals for score values. Use system sans-serif fallback. |
| Layout | Shared spacing steps, 1 rem cards, 0.625 rem controls and a 44 CSS-pixel minimum height for selected controls |
| Motion | 140 ms state transitions; reduced motion minimizes transitions and starts the slideshow paused |

## Component reference

- **Buttons.** Primary actions use the pale gradient. Secondary actions have a defined border and deep surface. Tertiary actions and disclosure summaries retain visible labels. Archive and decline controls use a distinct tinted border and explicit action verbs.
- **Interaction states.** Keyboard focus uses a two-pixel outline with an offset. Current and selected controls include a bottom indicator plus native semantics or ARIA. Pressed controls have an inset edge. Disabled controls keep visible text and use native disabling.
- **Navigation.** Desktop dropdowns and the mobile menu use the same state treatments. Explore keeps the old scorecard routes accessible. The catalogue keeps search, category, format and layout in a single labeled toolbar. Result count updates through a status region.
- **Cards and images.** Cards use purple-tinted surfaces with distinct text hierarchy. Media keeps its original proportions where cropping could remove context. Placeholder shapes supplement the textual entity labels. Catalogue profiles put actions and description beside media at desktop and tablet sizes and stack them on small phones.
- **Scorecards.** The field, surface, row dividers, numeric values and slider states use the shared palette. A visible 22 px thumb sits inside a 44 px hit area. Keyboard values and the existing 420-point total work as before.
- **Dialogs, error messages and status.** Dark reading surfaces, labeled controls, visible alerts and existing status announcements flow through the same tokens. The home slideshow has a Play/Pause control and respects reduced motion.

## Launch

Extract the ZIP and open **Launch Rated420.command** on macOS. The manual fallback is `/usr/bin/perl ./serve-rated420.pl` from the extracted folder, then open `http://127.0.0.1:8768/`. The browser keeps local demo state within that origin. See README.md for demo roles and feature details.

## Scope and compatibility

This build adds no runtime dependencies or external font, photography, or effects requests. Layered CSS gradients and standard WebP images require no canvas or continuously running visual effects. Chromium uses an explicitly styled slider; browsers without the matching pseudo-elements use their native slider accent. Chrome 116 on Linux is the verified browser. Screen-reader listening, physical touch, Safari, Firefox, macOS launcher integration and full WCAG conformance remain unverified. The included accessibility and verification report distinguishes targeted keyboard and automated findings from untested areas.
