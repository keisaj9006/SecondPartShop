# SecondPart — scaling guardrails

This document defines non-negotiable performance rules for the marketplace as inventory grows from thousands to hundreds of thousands or millions of listings.

## Stable rollback checkpoint

The pre-scaling stable application state is preserved on:

`checkpoint/2026-09-06-stable-compat-v2`

Commit:

`aa2ad5a2099497e5bbfc5d950b073dc7689767aa`

Do not move or reuse that branch for development.

## Marketplace reads

- Never hydrate the full active marketplace to render a result page.
- Default page size: 24 web listings.
- Mobile APIs must paginate in PostgreSQL/Supabase before returning listing payloads.
- Text search may rank a bounded candidate ID set first, then hydrate only the current page.
- Price, delivery and warranty sorting should be performed by PostgreSQL.
- Distance sorting must not permanently rely on hydrating all listings; seller coordinates should be persisted and distance moved into database-side ranking.

## Compatibility

Compatibility is a graph, not a text field.

Evidence priority:

1. explicit catalogue/OE fitment — confirmed;
2. transaction-backed verified buyer fit;
3. same-family / donor evidence;
4. unverified.

- Do not send the full compatibility graph to clients.
- Vehicle result pages should be ranked and paginated inside PostgreSQL.
- Raw verified-fit feedback remains private; public APIs expose aggregate confidence only.
- Add indexes before new high-cardinality fitment dimensions are introduced.

## Images

- Marketplace cards render one optimized image only.
- Use responsive image sizes and lazy loading.
- Full galleries load on the listing page, not marketplace search.
- Long-term seller upload pipeline should create thumbnail / medium / full derivatives and retain the original only when product evidence requires it.

## Search

- Search is server-side.
- OEM/MPN exact and normalized lookups require indexes.
- Never download catalogue inventory to the browser for search.
- Expensive AI identification runs on listing creation/import and saves structured results; it must not run for every marketplace view.

## Find My Part

- Match requests to a ranked seller subset using inventory, donor vehicles, specialisation and location.
- Never fan out every request to every seller.

## Monitoring

Before public launch track at minimum:

- marketplace API p50/p95 latency;
- search latency;
- compatibility query latency;
- database rows scanned for high-volume queries;
- image transfer size;
- Search Fill Rate;
- Find My Part Success Rate.

## Rule of thumb

A user should receive only the data required for the screen they are currently viewing, regardless of whether SecondPart stores 1,000 or 1,000,000 listings.
