# Rated420 responsive design system

The UX refinement builds on Data Intelligence checkpoint `b1727a2e618529c4f54d178365cb4d896bd88032`. The complete offline package launches on the public homepage. Extract it, open **Launch Rated420.command**, or run `/usr/bin/perl ./serve-rated420.pl` from the extracted folder and visit `http://127.0.0.1:8768/`. The launch requires system Perl. It does not install dependencies.

## Tokens and layout

| Token | Role |
| --- | --- |
| Midnight `#110C20` | Page background and visual depth |
| Amethyst `#41236F` | Active disclosure and selected navigation |
| Violet `#7952B3` | Supporting accent and subtle shadow |
| Emerald `#267D52` | Base palette color, lifted to `#9CE5BF` for small text |
| Pearl `#F2EFF7` | Primary readable foreground |
| Lilac `#DFC5FF` | Primary action, active underline, visible focus family |
| `--surface`, `--surface-deep`, `--surface-raised`, `--surface-hq` | Surface layering for cards, fields, and operational workspaces |
| `--space-*`, `--radius`, `--pill`, `--tap` | Fluid spacing, card and control radii, 44px target |

Local **DM Sans** and **Space Grotesk** continue to provide body and heading type. Public and community pages emphasize artwork, discovery, and profile identity. Business screens prioritize listings and actions. HQ uses restrained solid surfaces and grouped navigation. Gradients are reserved for selected public surfaces. The original imagery and fonts are used as shipped.

## Interaction patterns

- **Public navigation** uses a single link structure. The top bar expands on mobile; Explore, Community, Media, and About disclose their destinations. Selecting a link closes the menu. Escape closes it and restores focus. The current route has a text label, indicator, and accessible current-page state.
- **Administration, founder, business, and HQ workspace navigation** share an expandable panel. On narrow layouts the panel opens inline, so content and forms remain reachable. Desktop collapse choices persist locally. Founder groups organize business operations, outreach, production, and product and data tools. Simulated permissions are still enforced by the established preview guards.
- **Demo controls** are collapsed by default and show the current synthetic identity. Expand them to switch accounts or reset. The development sandbox banner stays visible.
- **Licensing** keeps 12 records per page. Status appears in words. Expand a card to reveal provenance, dates, links, and authorized CRM actions. A unique search result opens automatically. Compact layout, advanced filters, and status explanation keep the main list scannable. Snapshot cohorts and classifications are disclosed separately.
- **Forms, scorecards, and charts** use shared sizing and surfaces. Scoring retains the original minimum, maximum, keyboard increments and total calculations. Tables can scroll within their own region. Chart labels and marks can stack on narrow displays.
- **Accessibility** relies on native buttons, details and dialogs, explicit labels, focus outlines, reduced-motion preferences, safe-area spacing, and text status. A complete WCAG 2.2 audit and assistive technology device matrix have not been performed.

## Upgrade and deployment boundaries

All prior data storage keys and stored record shapes are retained. Only navigation layout preferences use new UX-specific keys. The official snapshot is unchanged. The current release keeps the prior sandbox deployment as a rollback target, and the hosted output excludes documentation, browser-test records, launch scripts, and comparison images. Production and application logic remain out of scope.

See VERIFICATION.txt for the checks run and the visual comparison report for mobile and desktop screenshots. For future UX work, validate the collapsible navigation, forms and license cards on physical iOS and Android devices with screen readers and large text.
