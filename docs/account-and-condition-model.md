# SecondPart account, seller and listing-condition model

## One identity, two marketplace modes

SecondPart uses one user identity.

Every authenticated account can use buyer functionality:

- browse and search;
- Garage;
- compatibility context;
- save parts and searches;
- create part requests;
- buy parts;
- use buyer protection, returns and transaction cases;
- message other members;
- build transaction reputation.

Selling is an additional capability. It does not replace buying.

A seller therefore keeps the same email/login, Garage, purchases, reviews and messages.

## Registration entry points

Registration presents two clear starting intents:

### I want to buy parts

Creates the normal buyer-first experience.

The user can enable selling later without creating another account.

### I want to sell parts

Creates the same underlying SecondPart identity with selling enabled.

After authentication, the user completes a seller profile.

Seller registration must explicitly explain that buying is also included.

## Buying and Selling views

Accounts with selling enabled have two UI modes:

### Buying

Buyer-focused navigation:

- Garage;
- marketplace;
- saved parts;
- purchases;
- returns and cases;
- part questions;
- reviews.

### Selling

Seller-focused navigation:

- seller dashboard;
- inventory;
- create/edit listings;
- buyer questions;
- sales and payouts;
- seller cases;
- donor vehicles;
- verification.

These are interface modes, not separate accounts.

## Seller type

Seller onboarding asks separately whether the seller is:

- Private seller; or
- Business / garage / breaker.

Do not assume that every seller is a garage or registered business.

## Reputation

Buying and selling reputation belongs to the same member identity.

Public member profiles may show both buyer and seller transaction history while keeping the relevant rating directions separate.

## Part condition

The primary marketplace conditions are:

1. Used — default for most SecondPart listings.
2. New.
3. Remanufactured / professionally refurbished — available when genuinely applicable, but not promoted as the marketplace focus.

The database currently keeps the legacy enum value `reconditioned` for compatibility. Buyer-facing UI must label it as **Remanufactured / professionally refurbished**.

Do not treat cleaning, visual inspection or an ordinary used part as remanufacturing.

## Marketplace scope

SecondPart is a general automotive-parts marketplace.

Transmission and gearbox parts are ordinary categories among many others.

Transmission-specific codes and technical fields are shown only when the selected part category requires them. They must not dominate registration, navigation, homepage copy or general listing creation.
