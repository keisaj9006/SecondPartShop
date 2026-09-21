# Default-template Auth confirmation repair — 21 September 2026

## Current hosted evidence

Supabase dashboard for secondpart was accessed through its existing ChatGPT login. Confirm sign up currently uses the default .ConfirmationURL template. Template editing is disabled; the UI requires custom SMTP or Pro (or a Send Email hook). No plan, SMTP, email template, credential, identity or confirmation state was changed.

Supabase's SSR PKCE flow returns an authorization code to redirectTo. Reference: https://supabase.com/docs/guides/auth/server-side/advanced-guide . Current signup/resend/recovery all target /auth/confirm, but that route accepted only token_hash/type. Consequently a valid default-template code was discarded before the normal cookie-bound exchange. The separate /auth/callback route already demonstrated the supported exchangeCodeForSession pattern.

## Repair

/auth/confirm now exchanges a PKCE code using the existing SSR client when no token_hash parameter is present. Token-hash confirmation is retained. Provider error parameters block either exchange. Invalid token-hash input cannot downgrade to a supplied code. Safe internal return destinations and recovery/signup failure UX are preserved. No verifier bypass or manual confirmation is introduced.

## Evidence and limits

Six expected RED assertions reproduced the missing PKCE paths and provider-error handling. After implementation, 24 focused Auth/context/origin tests pass. Independent read-only review found no blocking issues. Mocked tests do not prove live email receipt, actual cookie persistence or a completed password reset. PKCE still requires the originating browser's verifier cookie; cross-browser confirmation needs the separately planned custom TokenHash template setup.

Full default-template signup/recovery and destructive account-deletion E2E remain open until exercised with a disposable account through the normal flow. Creating/changing a password and final destructive deletion require user involvement under browser rules. Do not substitute an admin-generated session or forced Auth state.
