# Rated420 NY — Build 06

This build extends the verified Supabase account foundation and uses the original strain directory and five-slider scorecard design.

## What's included
- Original 21+ age gate, landing page, 4-image carousel, and account/login/profile pages.
- Searchable community strain catalogue, seeded with 18 strain names (no fictional scores).
- Five score categories: Aesthetic, Aroma, Flavor, Effects, and Overall. Each slider maxes at 84; the server calculates a maximum 420 total.
- Distinct community averages for each product format (Flower, Pre-Roll, Vape, etc.).
- Actual account-owned notes and ratings, one active review per user + strain + brand + product type. Saving a matching review updates the old scores.
- Optional public review photo upload: JPG, PNG, or WebP, up to 5 MB.
- 'My strain reviews' list in your account, with edit and delete.

## Backend
The complete applied database history, including the original member-profile foundation, is recorded in `supabase/migrations/`. All three migrations are already applied to the connected project. **Do not run them again** there. The root-level SQL files are legacy reference copies. See [backend setup](supabase/README.md) and the [live backend audit](docs/backend-audit.md).

Public browse and review reads are permitted; only authenticated users can submit or update their own ratings. A user's private member profile data is still protected by the existing `member_profiles` table rules.

## Deployment
Unzip the full archive and preserve its directory structure. The site uses `index.html`, `styles.css`, `app.js`, `rated420-logo.png`, and the `images/` directory. For a local preview, run `python3 -m http.server 8000` from the unzipped directory and open http://localhost:8000/. For Vercel, deploy that directory as a static site with no build command. Google Fonts, the Supabase JavaScript SDK, and the configured Supabase backend load over the internet.

Supabase project URL: `https://ymluyoqkmzxomjokjmkj.supabase.co`

Only the public, browser-safe publishable key appears in the app. Never add a Supabase service-role or secret key to any static file.

The 21+ gate is self-attestation, **not** legal identity or age verification. Consider formal age verification requirements and content moderation policies before a public release.

## Test checklist
1. Open the staging URL and confirm 21+.
2. Use **Strain catalogue** / **Rate a strain**.
3. Search **Lemon Creamsicle** and select it.
4. Check the 0–84 sliders and verify that the total updates as you move them.
5. Sign in and submit a test review with a producer, product type, scores and notes.
6. Return to the catalogue: the community average should now show your saved score.
7. In My account, edit or delete your review and verify the catalogue updates.
8. Optionally test a small review photo, then confirm it appears with the review.

## Known boundaries
- User-generated strain names and photos are not moderated yet. Staging use only.
- Supabase reports leaked-password protection disabled. This feature requires Pro or above; the audited organization is on Free. See the backend audit for this pending configuration decision.
- Search currently fetches the first 1000 strain names; pagination and moderation can follow as the catalogue grows.
- The account page and catalogue are tested with static syntax/structural checks. Real multi-user review submissions should still be tested through the staging URL.

## Build 06 — Dispensary reviews and profile pictures

Build 06 expects the dispensary and avatar migration. The live backend audit confirmed that it is already applied to the connected Rated420 project; do not reapply it. New empty environments need the complete ordered history in `supabase/migrations/`, including the member-profile foundation.

- Open **Dispensaries** to rate a location on Aesthetic, Accessibility, Staff,
  Menu, and Overall. Each slider runs from 0 to 84. Include a branch address
  in the location if the same dispensary has multiple branches in your city.
- Recent dispensary reviews, their notes, and any photos are public. Signed-in
  members can edit or delete their own review from **My account**.
- In **My account → My profile**, pick one of five avatars or upload a JPG,
  PNG or WebP up to 5 MB, then click **Save profile**. Uploaded profile
  pictures appear in the owner's account. The Rated420 logo is the default.
- After applying the migration and deploying to staging, sign in, save a
  review with a photo, edit it from My account, and verify that it displays
  while signed out. Save an avatar and an uploaded photo in turn, and reload
  My account after each save to check that the selection persists.
