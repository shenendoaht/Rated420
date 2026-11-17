# Contact Us — implementation status and setup

## Current branch status

The Contact Us interface and backend are implemented on a feature branch. The private table and submit-contact Edge Function have been deployed with explicit authorization. Migration 20261117064837_create_private_contact_submissions is already applied: do not replay it. The Resend/Turnstile accounts, secrets, sender-domain verification, and Hover DNS remain external setup dependencies. Existing profiles, strains, reviews, and policies have unchanged verification checksums.

The site-key meta tag is deliberately empty. The frontend can load the public site key from the Edge Function's /config route after real secrets and TURNSTILE_SITE_KEY are configured. Until then, submission reports that the form is unavailable; it cannot display a successful confirmation. Do not insert a test key into a deployed public form or bypass server-side spam checks.

The user approved Resend, a private contact_submissions table, a Supabase Edge Function, Cloudflare Turnstile, setup/testing, and notifications to rated420.ny@gmail.com with the visitor's validated address as Reply-To. The fixed sender is Rated420 NY <contact@mail.rated420ny.com>. Sending from this address requires verification of mail.rated420ny.com in Resend.

## Proposed email provider

[Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits) currently offers 100 transactional emails/day and 3,000/month on its free plan. Delivery beyond its limits needs a plan decision; do not upgrade automatically. Use a Resend account controlled by Rated420.

Production sending requires a [domain owned and verified by Rated420](https://resend.com/docs/dashboard/domains/introduction). A Gmail address can receive notifications but cannot be used as a verified Resend sending domain. Prefer a sending subdomain to keep existing mail configuration separate. DNS changes require approval of the exact records and target domain.

Required configuration, through secure provider dashboards or secrets tooling:

- A Resend account and verified mail.rated420ny.com sending domain.
- RESEND_API_KEY, stored only as a Supabase Edge Function secret. Never paste it into chat or commit it. Sending permission is required. The optional administrator status endpoint also needs permission to retrieve email delivery status; if a restricted sending key cannot read status, confirm delivery in the Resend dashboard rather than widening permissions without approval.
- A fixed recipient of rated420.ny@gmail.com, set server-side; never accept recipient or From addresses from a browser request.
- TURNSTILE_SITE_KEY (public) and TURNSTILE_SECRET_KEY (secret), configured through Supabase's Edge Function Secrets settings. The service URL and service-role key are provided by the Supabase runtime and never sent to the browser.
- Turnstile hostnames: rated420ny.com, www.rated420ny.com, rated420-staging.vercel.app, and rated420-staging-git-codex-contact-us-shenendoahts-projects.vercel.app. These exact HTTPS origins are also allowed by the function; arbitrary preview hosts are not. Use the stable branch-preview alias for real challenge tests.

Use Reply-To for the validated submitter email. Reject newline/header injection; render contact text as plain text or safely escaped HTML. Never use the submitter as From.

## Implemented backend and privacy

1. A new contact_submissions table, separate from existing profiles and reviews. Fields mirror the form: name, email, category, optional organization, subject, message, optional business location/site/phone, generated ID/time, unique request ID, administrator review status, and notification-delivery status. Do not store Turnstile tokens or raw IP addresses with messages.
2. Enable RLS and revoke all table access from PUBLIC, anon, and authenticated. No public read/write policies. Only the server-side service role and authorized Supabase dashboard administrators can store or review submissions. Existing app users are not automatically administrators.
3. A public submit-contact Edge Function with JWT verification intentionally disabled for anonymous contact; every submission must instead pass server-side Turnstile verification. Browser CORS is not an authorization boundary.
4. Enforce request size and content type, exact category allowlist, trimmed nonempty values and length limits, email validation, HTTP/HTTPS-only website URLs, optional business-field applicability, honeypot rejection, request-ID validation, and no dynamic recipients. Validate independently of the browser.
5. Validate Turnstile server-side, including action and hostname. Fail closed when keys are missing, verification fails, or the provider times out. Atomic database intake limits a sender to three new messages per ten minutes and ten per day, plus twenty total new messages per minute. The sender key is an HMAC of the gateway-provided IP (falling back to email), not a stored raw IP. Never rely on client-only validation or CORS as spam protection.
6. Store the validated message before attempting email delivery. Use the submission ID as the email idempotency key. Track notification failure privately; a two-minute delivery lease prevents concurrent sends. Administrator retries stop after twenty-three hours and mark needs_review, because Resend's deduplication window is twenty-four hours. Review older attempts in Resend before any manual resend. A stored message is not proof of email delivery.
7. Return a branded success state only after the backend confirms receipt. Return safe generic errors without SQL/provider details or personal data. Do not log message contents or credentials. Never expose an anonymous submission-list endpoint.
8. Administrators initially review private records in Supabase and receive notifications in Gmail. No public admin page or role-policy changes are required. Agree retention/deletion rules separately before automating any deletion of messages.

## Administration

Only trusted Supabase project administrators can review contact_submissions in Table Editor. Ordinary app accounts have no access. Review status can be new, read, or closed. Notification states are pending, sending, accepted, delivered, failed, or needs_review. Accepted means Resend accepted the API request, not proof of Gmail inbox delivery.

The same function exposes POST /submit-contact/admin/retry and POST /submit-contact/admin/status, with JSON {"id":"submission UUID"}. These require the server-only service-role Authorization credential and must never be called from the public frontend. Use an authorized administrative environment or the Supabase dashboard; do not retrieve, paste, or expose that credential. Status checks use Resend's last_event and mark delivered only when the provider reports delivered. A failed status lookup does not establish delivery.

Retry delivery after the two-minute lease, using the same message ID. If a record is needs_review, verify the provider history before manually deciding how to handle it. No automatic deletion or background migration/job has been added.

## Primary domain and staging

The user explicitly designated the existing rated420-staging project's main deployment as the primary site. rated420ny.com is assigned to that project, and www.rated420ny.com redirects there with HTTP 308. These names and rated420-staging.vercel.app share the main deployment and Supabase backend; they are not isolated environments. Preview branches also use the same backend, so all browser write tests need authorization.

DNS remains authoritative at Hover. Vercel currently returns these target records; recheck its current recommendations before changing DNS:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 216.198.79.1 |
| A | @ | 64.29.17.1 |
| CNAME | www | ba9c842b08305e3b.vercel-dns-017.com |

Replace only the Hover parking records that conflict. Preserve unrelated records and add the exact Resend DKIM/SPF/MX values supplied by the provider. Do not invent email DNS records. Ownership verification in Vercel does not establish correct DNS or HTTPS. rated420ny.store is reserved for future merchandise and has not been configured or changed.

Before launch, update Supabase Auth's Site URL to https://rated420ny.com and include its allowed redirects, while retaining the existing staging/preview redirects and authentication settings. These dashboard settings have not been changed through this connection.

## Remaining activation and verification gates

- Configure the approved Resend and Turnstile accounts and keys, and verify the sending-domain DNS records. No secret values belong in Git, chat, or logs.
- The contact migration and Edge Function are already deployed. Do not rerun the migration. Vercel does not execute it.
- Configure a real Turnstile site key only after the production verification path works.
- Completed: RLS/grant checks, anonymous REST read denial, synthetic database intake/deduplication/conflict/rate-limit/lease tests in a transaction rolled back, ten backend unit tests with mocked providers, and desktop/mobile UI/auth regressions. No real email has been sent or delivery verified yet.
- Still required: real Turnstile token, authorized test message, durable storage, Resend delivery status, recipient mailbox confirmation and Reply-To. Never treat the mocked tests or an API acceptance response as evidence of actual inbox delivery.
- Verify Hover DNS propagation, Vercel configuration and HTTPS for rated420ny.com and the www redirect.
- Recheck Vercel previews for the final exact commit and existing account/review/navigation flows before requesting merge approval.
- Until those checks pass, keep this PR in draft and do not merge.

## Frontend tests

In a Node environment with Playwright and its Chromium browser installed, run:

```sh
node --check app.js
node --check contact.js
node --test tests/contact-handler.test.mjs
node tests/contact.browser.cjs
git diff --check
```

The browser test uses only synthetic data, local repository files, a mocked Turnstile widget, and mocked submission responses. All other requests are blocked. It is not evidence of working live email delivery or server-side protection.
