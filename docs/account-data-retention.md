# SecondPart Account Data Retention Matrix

Snapshot: 2026-09-09  
Scope: UK marketplace launch baseline  
Status: engineering policy for implementation; final wording and any jurisdiction-specific legal periods still require UK legal review.

## Regulatory design principles

SecondPart follows a data-minimisation / storage-limitation model:

- personal data is not retained merely because it might be useful later;
- deletion requests remove or anonymise data as soon as the marketplace no longer has an active operational or legal need for it;
- retained transaction records are reduced to the minimum necessary;
- retention is expressed as a fixed period where a clear statutory period exists, otherwise as an objective event/criterion that can be reviewed;
- pseudonymised data is still treated as personal data unless re-identification is no longer reasonably possible.

For company/accounting records, the launch baseline uses the UK requirement to retain company accounting records for 6 years from the end of the last company financial year they relate to. This does **not** justify retaining every piece of personal data for 6 years.

## Deletion blockers

A request can be submitted at any time, but destructive processing must not run while the account is needed to safely complete an active marketplace transaction.

Processing is temporarily blocked while any of the following applies:

- an unpaid/processing checkout still has a live reservation or provider confirmation in flight;
- a paid buyer order is not terminal;
- a seller has a paid sale whose fulfilment or payout is not terminal;
- a transaction case, return, provider dispute, refund or payout reversal is open;
- a seller transfer is in `scheduled`, `releasing` or rollback-required state;
- an unresolved marketplace safety/moderation case requires the account relationship to remain available for investigation.

A blocked request remains queued and is re-checked automatically. Blocking deletion is not the same as cancelling the request.

## Retention matrix

| Data category | On approved account deletion | Retention rule / exit criterion | Engineering treatment |
| --- | --- | --- | --- |
| Supabase Auth account, login email, password/recovery identity | Delete | As soon as deletion preflight is clear | Hard-delete Auth user after DB anonymisation succeeds |
| Public profile: display name, handle, bio, phone | Delete | Immediately at processing | Remove profile with Auth deletion; no public tombstone containing personal data |
| Terms/privacy acceptance attached to profile | Delete from live profile | Deletion completion | Keep only non-identifying policy/audit facts where needed for a transaction/legal audit |
| Wishlist / saved parts | Delete | Immediately | Hard delete |
| Saved searches | Delete | Immediately | Hard delete |
| Recently viewed parts | Delete | Immediately | Hard delete |
| Garage vehicles / stored registrations | Delete | Immediately unless required in an unresolved transaction/case | Hard delete; transaction-specific vehicle snapshot may remain only where necessary |
| Push devices/tokens and queued personal notifications | Delete | Immediately | Hard delete |
| User blocks | Delete | Immediately unless an unresolved safety case requires temporary retention | Hard delete after safety blocker clears |
| Find My Part requests not linked to a transaction | Delete | Immediately | Hard delete or retain only truly anonymised aggregate analytics |
| Pre-purchase listing conversations/messages | Delete | After any unresolved moderation/safety case is closed | Hard delete; no indefinite chat archive |
| Seller public profile | Remove from public marketplace | Immediately after deletion becomes eligible | Detach owner, unverify, remove personal contact/location, use non-identifying tombstone only where transaction references require seller row |
| Seller live/draft listings | Unpublish | Immediately after deletion becomes eligible | Archive; do not leave sellable inventory owned by a deleted account |
| Transaction-linked listing facts | Retain minimum snapshot | While required to evidence the sale / accounting / dispute | Keep non-personal item facts required to understand the transaction; do not keep unnecessary public UGC indefinitely |
| Reviews written by or about the deleted profile | Remove from public reputation | At deletion processing unless an unresolved moderation case requires temporary preservation | Delete review record or retain only aggregate that is genuinely anonymous |
| Verified-fit feedback | Prefer anonymisation | May be retained as technical/statistical evidence only after removing user linkage | Null/remove buyer identity; keep only non-identifying fit result if still useful |
| Orders: amounts, currency, fee, timestamps, payment status | Retain | Company/accounting record: 6 years from end of relevant company financial year, subject to legal review | Keep transaction row with buyer identity detached/anonymised |
| Stripe/provider transaction identifiers | Retain minimum required | With the accounting/payment record and any active refund/dispute obligations | Keep provider IDs needed for reconciliation/refunds; never expose publicly |
| Shipping name/address | Erase earlier than accounting record where possible | Keep only while needed for fulfilment, returns, chargebacks/disputes or a legal claim; erase when that purpose ends | Clear personal shipping fields independently of the retained order money record |
| Transaction messages | Retain only if necessary | Until related return/dispute/legal need ends; erase earlier when not needed | Make sender identity nullable and remove linkage; content retention is purpose-limited |
| Transaction cases / refund / dispute records | Retain minimum evidence | Until the applicable dispute/legal-claim need has ended; exact jurisdiction/provider period confirmed in legal review | Preserve case/payment outcome; detach profile identity where possible |
| Case evidence files | Retain only if necessary | Same purpose window as the associated case; delete when no longer needed | Private storage only, no public reuse |
| Order event audit | Retain minimal transaction audit | With transaction/accounting/legal record | Actor profile becomes nullable; event remains non-public |
| Marketplace moderation / fraud evidence | Retain only where necessary | Until investigation / platform-security / legal purpose ends, then erase or anonymise | No blanket indefinite retention; review periodically |
| Support tickets | Delete unless needed for unresolved legal/support case | At deletion or case closure | Hard delete after blocker clears |
| Account deletion request audit | Retain minimal non-identifying audit | Keep request ID, status and processing timestamps as compliance evidence; remove profile link and free-text reason at completion | Request row survives profile deletion with `profile_id = null` |

## Processing architecture

Account deletion is a two-phase, retry-safe operation.

### Phase 1 — preflight and database privacy transformation

1. Claim a pending deletion request.
2. Check transaction, payout, case, provider-dispute and moderation blockers.
3. If blocked, store a machine-readable blocker and leave the request queued.
4. If clear:
   - delete preferences, saved data, push tokens and non-required UGC;
   - unpublish seller inventory;
   - detach/anonymise retained commerce/audit rows;
   - remove unnecessary shipping/contact data when its operational purpose has ended;
   - leave only the minimum retained transaction/legal records.

### Phase 2 — identity deletion

1. Hard-delete the Supabase Auth user.
2. Confirm that the live profile no longer exists.
3. Mark the deletion request completed by request ID.
4. Null its profile link and erase the free-text reason.
5. Record completion timestamp without storing a new copy of the deleted identity.

If Phase 2 fails, the request remains retryable. A partially anonymised account must not be silently marked completed.

## Follow-up retention jobs

The deletion processor handles the user's account request. A separate scheduled retention job must later purge/anonymise retained transaction/case data when its lawful purpose expires. The 6-year accounting rule must not become a blanket 6-year retention period for shipping addresses, messages, device tokens or other unrelated personal data.

## Legal review items before public commerce

- contracting entity and accounting-year implementation;
- whether and for how long a registered seller or garage legal business name must remain with retained commerce records after account deletion; the current finalizer tombstones private-seller names and all public slugs/locations but preserves registered business names pending that ruling;
- jurisdiction-specific legal-claim limitation/prescription periods across the UK;
- Stripe/card dispute and chargeback evidence windows;
- consumer-return / cancellation evidence requirements;
- exact fraud-prevention retention criteria;
- wording exposed in Privacy Policy / account-deletion UI.
