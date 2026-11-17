# Contact Us — implementation status and setup

## Current branch status

The Contact Us interface is implemented on a feature branch. It is not ready to merge or accept real messages yet. No contact table has been created, no Edge Function has been deployed, no external provider has been provisioned, and no existing records or security policies have been changed.

The site-key meta tag is deliberately empty. Until real configuration is in place, submission reports that the form is unavailable; it cannot display a successful confirmation. Do not insert a test key into a deployed public form or bypass server-side spam checks.

The user approved a private contact_submissions table, a Supabase Edge Function, and Cloudflare Turnstile. They also requested notifications to rated420.ny@gmail.com with the visitor's validated address as Reply-To. The email provider is awaiting approval and sender-domain details before implementation.

## Proposed email provider

[Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits) currently offers 100 transactional emails/day and 3,000/month on its free plan. Delivery beyond its limits needs a plan decision; do not upgrade automatically. Use a Resend account controlled by Rated420.

Production sending requires a [domain owned and verified by Rated420](https://resend.com/docs/dashboard/domains/introduction). A Gmail address can receive notifications but cannot be used as a verified Resend sending domain. Prefer a sending subdomain to keep existing mail configuration separate. DNS changes require approval of the exact records and target domain.

Required configuration, through secure provider dashboards or secrets tooling:

- A Resend account and verified sending domain; a fixed From address on that domain.
- A sending API key, stored only as a Supabase Edge Function secret. Never paste it into chat or commit it.
- A fixed recipient of rated420.ny@gmail.com, set server-side; never accept recipient or From addresses from a browser request.
- Cloudflare Turnstile site key (public, in the meta tag) and secret key (server-side only), with approved deployment hostnames.
- An explicit allowed-origin/hostname list for the stable staging and preview URLs. Do not permit arbitrary origins.

Use Reply-To for the validated submitter email. Reject newline/header injection; render contact text as plain text or safely escaped HTML. Never use the submitter as From.

## Approved backend design to implement

1. A new contact_submissions table, separate from existing profiles and reviews. Fields mirror the form: name, email, category, optional organization, subject, message, optional business location/site/phone, generated ID/time, unique request ID, administrator review status, and notification-delivery status. Do not store Turnstile tokens or raw IP addresses with messages.
2. Enable RLS and revoke all table access from PUBLIC, anon, and authenticated. No public read/write policies. Only the server-side service role and authorized Supabase dashboard administrators can store or review submissions. Existing app users are not automatically administrators.
3. A public submit-contact Edge Function with JWT verification intentionally disabled for anonymous contact; every submission must instead pass server-side Turnstile verification. Browser CORS is not an authorization boundary.
4. Enforce request size and content type, exact category allowlist, trimmed nonempty values and length limits, email validation, HTTP/HTTPS-only website URLs, optional business-field applicability, honeypot rejection, request-ID validation, and no dynamic recipients. Validate independently of the browser.
5. Validate Turnstile server-side, including action and hostname. Fail closed when keys are missing, verification fails, or the provider times out. Add abuse controls appropriate to the deployed function; never rely on client-only validation.
6. Store the validated message before attempting email delivery. Use the submission ID as the email idempotency key. Track notification failure privately and provide an administrator-only retry path so provider outages do not lose stored inquiries. Do not mark a notification sent merely because a submission was stored.
7. Return a branded success state only after the backend confirms receipt. Return safe generic errors without SQL/provider details or personal data. Do not log message contents or credentials. Never expose an anonymous submission-list endpoint.
8. Administrators initially review private records in Supabase and receive notifications in Gmail. No public admin page or role-policy changes are required. Agree retention/deletion rules separately before automating any deletion of messages.

## Activation and verification gates

- Confirm email provider, owned domain, fixed sender, and any exact DNS changes.
- Apply only a newly reviewed contact migration using the existing explicit database authorization; never rerun historical migrations. Record the actual applied version in Git.
- Deploy the approved Edge Function after secrets are configured. No migration execution in Vercel builds.
- Configure a real Turnstile site key only after the production verification path works.
- Test RLS and grants, invalid payloads, anonymous read denial, spam failures, provider timeouts, idempotency/retries, successful private storage, recipient delivery and Reply-To. Use test fixtures and authorized test messages, never existing user records.
- Recheck Vercel previews for the final exact commit and existing account/review/navigation flows before requesting merge approval.
- Until those checks pass, keep this PR in draft and do not merge.

## Frontend tests

In a Node environment with Playwright and its Chromium browser installed, run:

```sh
node --check app.js
node --check contact.js
node tests/contact.browser.cjs
git diff --check
```

The browser test uses only synthetic data, local repository files, a mocked Turnstile widget, and mocked submission responses. All other requests are blocked. It is not evidence of working live email delivery or server-side protection.
