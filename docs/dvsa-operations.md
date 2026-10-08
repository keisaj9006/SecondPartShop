# DVSA operations

SecondPart uses the existing server registration service for both web and mobile. DVSA identifies the vehicle; it never proves that a part fits. Manual catalogue selection remains the outage fallback.

## Configuration and activation

Configure `DVSA_CLIENT_ID`, `DVSA_CLIENT_SECRET`, `DVSA_API_KEY`, `DVSA_SCOPE_URL` and `DVSA_TOKEN_URL` in the intended Vercel environment. Do not use `NEXT_PUBLIC_`, Git, reports or client storage. Preview values are not authority to configure Production. Confirm names, environment and branch scope without decrypting or printing values.

A variable update requires a **new deployment**. Verify deployment target, branch, SHA and READY state, then health and one authorised known registration through `/api/vehicle-lookup`. Record vehicle/result status and timings only. Never record the OAuth response, Authorization header, API key or secret. A success might come from the result cache; distinguish that from a new provider request before claiming OAuth runtime evidence.

## Token and result caching

DVSA documents a typical 60-minute access-token lifetime. The client instead trusts the actual positive `expires_in` supplied by the token response and refreshes before expiry, with a margin of up to 60 seconds. One in-flight acquisition is shared per server instance. Cold instances may each acquire their own token; this is not a distributed token cache.

Reduced vehicle results are cached by hashed registration/provider: found results for 24 hours and not-found for 30 minutes. Authentication/network failures are not cached as successful vehicles. Do not clear shared caches merely to produce QA evidence.

Both OAuth and vehicle requests have eight-second deadlines and reject redirects. They do not retry automatically; user retry stays behind the existing rate limiter. The sequential upstream deadlines do not constitute an absolute eight-second end-to-end budget because database/cache/catalogue work also occurs.

## Rotation and inactivity

DVSA states an API key unused for 90 days is revoked. Monitor normal usage and provider notices; avoid fake vehicle searches or frequent synthetic keep-alive traffic. Plan a legitimate low-volume operational check when needed.

Client secrets expire after two years; DVSA sends advance notices. Request replacement using the official process, store it in the secret manager and appropriate Vercel environment, then deploy fresh and verify a legitimate registration. This needs no application-code change. Do not revoke the previous credential until replacement operation is confirmed under the provider's rotation procedure. Do not print the `/credentials` response.

## Incident handling

- 401/403: check expiry, secret/key configuration and provider permissions in the management UI; do not expose upstream bodies or repeatedly retry.
- 429: respect provider throttling and stop repeated QA; preserve manual selection.
- 5xx/timeout/network: use the provider status page, controlled user retry and manual selection.
- Malformed/mismatched vehicle: fail closed; never substitute invented identity or compatibility.

Rollback Preview to a known safe deployment only after checking environment applicability. Old deployments may lack rotated credentials. Production rollback/deployment needs separate authorisation.

Sources checked 5 October 2026: [DVSA authentication, token lifetime, inactivity and rotation](https://documentation.history.mot.api.gov.uk/mot-history-api/authentication/), [provider status](https://motservice.status.dvsa.gov.uk/).
