# Checkout compatibility fail-closed hardening — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers selected-vehicle compatibility verification immediately before checkout reservation/session creation on web and mobile. It does not change compatibility scoring, listing fitment data, Stripe configuration, Buyer Protection, Supabase schema, Production or `main`.

## Root cause

Both checkout entry points used:

```ts
getPartCompatibility(...).catch(()=>null)
```

When the compatibility RPC failed, the exception was converted to `null`. The checkout code interpreted that as if there were no uncertain compatibility result and continued to `prepare_checkout_order_v2`, stock reservation and Stripe Checkout.

`prepare_checkout_order_v2` validates that the supplied vehicle/year/engine context exists, but it does not independently evaluate the part-to-vehicle compatibility confidence or enforce the acknowledgement gate. Therefore the compatibility warning could fail open during a backend compatibility outage.

## TDD RED

Regression commit:

- `a00702468dee353a350b87c7b09f1bb2ebc55ce3`
- GitHub Actions run: `35350026877`

Expected RED:

- total tests: 583;
- 581 PASS;
- 2 FAIL;
- web checkout continued through reservation/session creation and redirected to Stripe when compatibility lookup threw;
- mobile checkout returned HTTP 201 when compatibility lookup threw.

These failures proved the compatibility check could be bypassed by an availability failure rather than by an explicit user acknowledgement.

## GREEN implementation

Web implementation:

- `1fa5050036c86ff87344a1d5c74e50210039ed61`
- compatibility lookup failure now reports `checkout / checkout_compatibility_check_failed`;
- returns a user-safe error: `We could not verify compatibility right now. Please try again.`;
- stops before `prepare_checkout_order_v2` and before Stripe.

Mobile implementation / final application SHA:

- `d4a6a168e6f87bfc347ac41a8fb6c585369bcd28`
- compatibility lookup failure reports `checkout / mobile_checkout_compatibility_check_failed`;
- returns HTTP 503 with `compatibility_check_unavailable`;
- stops before `prepare_checkout_order_v2` and before Stripe.

Existing behavior remains unchanged when the compatibility check succeeds:

- `confirmed` / `buyer_verified`: checkout continues normally;
- `family_match` / `unverified`: explicit acknowledgement remains required;
- no selected vehicle context: compatibility gate is not invoked.

## Final verification

GitHub Actions run `35350230043`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- tests: **583/583 PASS**, 0 FAIL;
- release/commerce validators: PASS;
- production Next.js build: PASS; compiled successfully.

Vercel Preview for the exact final SHA:

- deployment: `dpl_Agq6XHgYHVk6KXPJ967GWjWsFXp3`;
- exact URL: `https://second-part-shop-qyjs4ovlr-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Fresh read-only health smoke on both the exact deployment and branch alias returned HTTP 200 with `backendReady:true`.

## Scope limit

This closes the fail-open compatibility outage path for web/mobile checkout. It does not replace final real-provider checkout QA, full provider/UI last-stock race evidence, DVSA integration, physical Android QA or Production release gates.
