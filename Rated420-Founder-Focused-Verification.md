# Rated420 Founder focused workspace and team photo

Baseline `87c72ab8de8d1454f307b859a8736ef68c834d5c`. Source `ec0a488c8f93e085a56a7e06d60b9770844051ce`. Sandbox deployment `dpl_GDY86hR3CN8ogBPeNTsGG2c1ZpVZ`. Rollback `dpl_7SZ3B3v7qPGmBCJXhCYVi4uy8P6R`.

Chrome 116.0.5845.96 on Linux exercised the Founder and scorecard flows at 320, 375, 390, 430, 820 and 1440 CSS pixels. Founder opens on priority work with the destination picker, settings, planning and activity collapsed. Tests exercised keyboard dismissal and focus restoration, opening the organization directory, preserving its search, inspecting linked campaign history and returning to the same organization, and navigation back to HQ. Public mobile navigation, complete offline, catalogue, editorial, responsive and HQ checks were also run. Twenty-three Node checks passed.

The About and team photo uses a display crop on the existing bundled image. The storefront sign falls outside that presentation, and the three team members remain in frame. The visual reference includes the old and new crop at 390 and 1440 px, plus Founder overview, navigation and campaign context. The original photo and approved NYS data file were compared with the baseline.

All 13 calculator models retained five 84-point categories and keyboard scoring. The checks covered live score readability at 200% root text size, format filtering and whole-number community display. Hosted checks used certificate-verified HTTPS responses. Offline checks blocked requests outside the preview origin.

Physical iPhone Safari, screen-reader listening and macOS launcher auto-open were not tested. The ZIP includes **Launch Rated420.command**. The manual launch command from the extracted directory is `/usr/bin/perl ./serve-rated420.pl`, then open `http://127.0.0.1:8768/`.
