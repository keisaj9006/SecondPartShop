# Same-origin Auth confirmation — 30 September 2026

Remote rebuild-nextjs matched the last verified local head 7919e30; no intervening source changes. Existing original checkout and main remain untouched.

## Root cause and fix

Default-template PKCE codes require the verifier cookie set when signup/recovery begins. The previous email-origin resolver always preferred the Vercel branch URL in Preview, even when the user started on the canonical alias or exact deployment. That moved confirmation to another cookie origin.

The resolver now retains the request Origin only on an exact match against server-configured canonical, branch or deployment origins. No arbitrary Vercel wildcard, forwarded host, userinfo or URL path is trusted. Missing/untrusted Origin retains the previous fallback. Signup, resend and recovery await the request header and use the same resolver. Existing OTP/code verification remains unchanged.

## Verification

- RED: three expected failures (canonical alias, exact deployment, trusted deployment in production).
- GREEN: all 33 focused Auth tests pass; action integration covers distinct configured/branch/deployment origins in Preview.
- Independent read-only review: no blocking findings; its integration-test strengthening request was applied.
- Supabase must separately allow each retained redirect origin. Full real-email/browser lifecycle remains a provider E2E gate, not implied by mocked tests.

## Device and environment limits

Android SDK adb is installed, but no device is connected. Real signed-device, Play install, FCM and hardware navigation checks cannot be marked passed. Browser tooling currently fails before startup with the Windows sandbox deny-read ACL error; terminal fallback with approved escalation works, but no alternate browser-control bypass is used.
