# SecondPart vehicle compatibility model

## Product rule

Selecting a vehicle establishes a compatibility context. It does not have to hide the rest of the marketplace.

The buyer controls filtering with **Show only parts that fit this vehicle**.

- checked: show only listings with `confirmed` or `family_match` evidence;
- unchecked: show the full marketplace and keep a compatibility label on every listing.

The unchecked state deliberately includes listings that may not fit the selected vehicle.

## Confidence levels

### Confirmed for your vehicle

Use only when the listing contains an explicit catalogue fitment for the selected vehicle configuration.

Seller confirmation must be based on actual fitment knowledge, OE/OEM information, supplier data or similarly defensible evidence.

### Verified fit by SecondPart buyers

Transaction-backed evidence for the exact selected catalogue vehicle.

SecondPart may show this level when at least two different buyers completed real marketplace transactions for the same part and exact vehicle context, confirmed an exact fit, and the evidence is not materially contradicted by verified non-fit reports.

This level is deliberately separate from **Confirmed for your vehicle** so community evidence is never presented as manufacturer/OE catalogue confirmation.

### Vehicle family match — verify details

A useful but non-final compatibility signal.

It can be produced by:

- an explicit seller fitment for another derivative in the same vehicle family; or
- a seller-linked donor vehicle matching make/model family/year and compatible known fuel/engine context.

A donor vehicle alone must never automatically become an exact confirmed fit.

### Fit not verified — may not fit

SecondPart has insufficient fitment evidence.

This does **not** mean the part is known to be incompatible. It means the buyer should verify OE/OEM or manufacturer part numbers and seller evidence before ordering.

Do not label an unknown fit as definitely incompatible unless SecondPart later introduces an explicit negative-fitment evidence model.

## Seller listing UX

Compatibility collection should be progressive rather than a long mandatory technical form.

### Step 1 — donor vehicle

Ask: **Which vehicle did this part come from?**

This is the easiest compatibility evidence for dismantlers and garages and can be reused across many listings.

### Step 2 — part identification

Ask for identifiers the seller genuinely has:

- OE/OEM number when available;
- manufacturer / brand;
- manufacturer part number.

Never encourage sellers to guess identifiers.

### Step 3 — other exact compatible vehicles

Optional advanced section.

The seller may add exact make/model/year/derivative/engine combinations only when they can explicitly confirm them.

These fitments can power `confirmed`.

## Publishing quality gate

A draft can be saved with incomplete compatibility information.

To publish an active listing, at least one compatibility/identity basis is required:

- donor vehicle;
- explicit catalogue fitment;
- OE/OEM number; or
- manufacturer plus manufacturer part number.

Real product photography remains a separate publication requirement.

## Verified post-purchase fit feedback

When checkout starts with a selected catalogue vehicle, SecondPart snapshots the vehicle variant, year, fuel, engine and normalized registration onto the order item.

After a successfully completed, non-refunded transaction with released funds, the buyer can report:

- exact fit;
- fit with modification / coding / adaptation;
- did not fit; or
- not installed yet.

The buyer cannot substitute a different vehicle after the transaction. Public compatibility statistics expose only aggregate counts; the registration remains private transaction data.

A buyer-verified compatibility signal requires evidence from distinct buyers rather than raw feedback-row counts.

## Registration / VRM lookup

Registration lookup is provider-neutral at the product level. The current adapter is prepared for the official DVSA service and maps returned vehicle data into the internal DfT/provider-neutral catalogue.

Until API credentials are configured, the user can continue with manual vehicle selection. Provider credentials must remain server-side.

## Search ordering

When a vehicle is selected, Best match should prioritize:

1. explicit confirmed fitment;
2. verified fit by SecondPart buyers;
3. family match;
4. unverified.

When compatible-only is checked, unverified listings are excluded.

When compatible-only is unchecked, unverified listings remain browseable but clearly marked.
