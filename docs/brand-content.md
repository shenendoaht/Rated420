# Rated420 brand and consumer refinement

Base: `a46f4f16bb324d78784941a56143771c2490426f`. The full ecosystem stays in the package. Extract and use **Launch Rated420.command**, or run `/usr/bin/perl ./serve-rated420.pl` from the extracted directory and visit `http://127.0.0.1:8768/`. These routes and the catalog work offline. Manufacturer links open only after explicit confirmation.

## What changed

- The homepage keeps its four original slides and removes the overlapping scale sticker, the dedicated How It Works button, and numeric step badges. **About → About Rated420** opens the homepage How It Works section. **About → Team and company story** opens the team page.
- The **420 Standard** block presents editorial independence and the contributor-recognition equation in serif math typography. R counts distinct review units (strain + format, a dispensary, or a catalog item), C counts approved contributions that created a new and unarchived listing, and P counts recorded Vault votes. The prototype adapter and Build 02 SQL both compute `reviews + 3 * contributions + polls`. Product rating categories, point caps and aggregation remain unchanged. The Build 02 SQL is documented source, not a claim about a deployed production schema.
- Accessories has an independently curated product section and a separate section for the original community accessory ratings. Manufacturer pages and public product metadata were checked November 20, 2026. Existing scorecards stay linked to their original entries.

| Product | Manufacturer page |
| --- | --- |
| Peak | [Puffco](https://www.puffco.com/products/the-peak) |
| Glass Grinder | [Houseplant](https://www.houseplant.com/products/glass-grinder) |
| GRAV® 3-Piece Grinder | [GRAV](https://grav.com/products/2-5-grav-3-piece-grinder) |
| Waterpipe | [Heir](https://smokeheir.com/products/waterpipe) |

Prices and stock can change. The curated cards use original short descriptions and publisher links. Product photography is pending permission. No retailer image or copy was copied into the build.

## Editorial architecture

`preview/editorial/store.js` owns the browser-local catalog, content records, validation and mutation guards. `preview/editorial/content.js` renders the independent showcase, Standard, public story, and HQ editor. The **Editorial content** tool is available to founders and administrators. Edits persist in the editor's browser, separate from ratings, company data and the licensing snapshot. The shared demo reset clears editorial changes along with other demo edits. Other visitors see the bundled defaults.

Catalog entries have individual stable IDs, descriptions, manufacturer links, a locally selected approved image and its rights record, publishing visibility, placement type, and mandatory disclosure for commercial placements. The default entries are independent editorial selections. Paid labels model future disclosure behavior in a browser-local draft. There are no starter commercial agreements, prices, direct sales or payment integrations. An authorized backend would need roles, a publication review process, approved image storage, rights evidence and commercial disclosures.

## Team assets still needed

The baseline and repository history reviewed did not contain standalone approved biographies or titles for the three team members. Shen and Al are identified by the existing homepage photo caption. A third unnamed slot is preserved for the requested roster. The existing Treehouse group photograph and a short introduction based on the existing homepage are shown. There are three consistent portrait placements and expandable biographies.

Provide the founder-approved full roster, roles, responsibilities, biographies, company history and three individual portraits. A preferred replacement group photo and approved product images can be supplied separately. The HQ local editor accepts approved JPG, PNG or WebP files under 200 KB, paired with a rights record.

## Verification

Use the included comparison PDF to review the homepage, carousel art, Standard, accessory showcase and team presentation at 390 and 1440 px. The complete regression suite includes offline and hosted editorial checks and a same-origin demo storage upgrade check. Browser compatibility is tested against Chrome for Testing 116.0.5845.96 on Linux. Physical mobile devices and Finder launch are outside the assessed matrix. See the delivery report for the exact results and sandbox rollback reference.
