import { createHandler } from './handler.mjs';

// Public intake is protected by server-side Turnstile verification and rate limits.
// /admin/* additionally requires the server-only service-role credential.
Deno.serve(createHandler({ env: (name: string) => Deno.env.get(name) }));
