# Default-template Auth confirmation repair — 21 September 2026

## Current hosted evidence

Supabase dashboard for secondpart was accessed through its existing ChatGPT login. Confirm sign up currently uses the default .ConfirmationURL template. Template editing is disabled; the UI requires custom SMTP or Pro (or a Send Email hook). No plan, SMTP, email template, credential, identity or confirmation state was changed.

Supabase's SSR PKCE flow returns an authorization code to redirectTo. Reference: https://supabase.com/docs/guides/auth/server-side/advanced-guide . Current signup/resend/recovery all target /auth/confirm, but that route accepted only token_hash/type. Consequently a valid default-template code was discarded before the normal cookie-bound exchange. The separate /auth/callback route already demonstrated the supported exchangeCodeForSession pattern.

## Repair

/auth/confirm now exchanges a PKCE code using the existing SSR client when no token_hash parameter is present. Token-hash confirmation is retained. Provider error parameters block either exchange. Invalid token-hash input cannot downgrade to a supplied code. Safe internal return destinations and recovery/signup failure UX are preserved. No verifier bypass or manual confirmation is introduced.

## Evidence and limits

Six expected RED assertions reproduced the missing PKCE paths and provider-error handling. After implementation, 24 focused Auth/context/origin tests pass. Independent read-only review found no blocking issues. Mocked tests do not prove live email receipt, actual cookie persistence or a completed password reset. PKCE still requires the originating browser's verifier cookie; cross-browser confirmation needs the separately planned custom TokenHash template setup.

Full default-template signup/recovery and destructive account-deletion E2E remain open until exercised with a disposable account through the normal flow. Creating/changing a password and final destructive deletion require user involvement under browser rules. Do not substitute an admin-generated session or forced Auth state.

## Verified integration

- Full local suite: 667/667 PASS, zero skipped/failed. Lint passes with four pre-existing warnings; typecheck, production build and staged whitespace check pass.
- Feature CI 35610758429: all five jobs PASS, including all release validators and isolated PostgreSQL proofs.
- PR #3 merged only to rebuild-nextjs as 1d8a49d.
- Exact Preview dpl_9FdpLv4Py7VUKXtJ4aPXotaG9SS8 is READY at application SHA 2805670: https://second-part-shop-7kjdogq3y-joannakwapis11-5369.vercel.app .
- Browser smoke on exact Preview: invalid PKCE signup code fails closed, retains /saved retry context; invalid recovery code returns to /auth/forgot-password?error=expired-link. This is negative-path provider/route evidence, not successful authentication proof.
- Real PKCE verification requires the originating browser AND origin cookie context. Preview alias versus generated branch-email origin must be checked in the fresh lifecycle; this patch does not waive that check or cross-browser limitations.
