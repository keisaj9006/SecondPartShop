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

## Search ordering

When a vehicle is selected, Best match should prioritize:

1. confirmed;
2. family match;
3. unverified.

When compatible-only is checked, level 3 is excluded.

When compatible-only is unchecked, level 3 remains browseable but clearly marked.
