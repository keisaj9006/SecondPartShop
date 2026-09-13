# Support conversation thread — approved bounded design

## Scope
Extend the existing account-linked support flow. Keep `support_requests.message` as the immutable original ticket message. Add a separate append-only conversation table for subsequent user/admin messages. Keep `admin_notes` private and out of the customer-visible thread.

## Status model
`open -> in_progress -> resolved -> closed`.

- User replies to an `open` or `in_progress` request append a message without changing the status.
- User reply to a `resolved` request appends a message and reopens the request to `open`.
- `closed` is final: neither user nor admin may append further thread messages. Admin may mark `open`, `in_progress`, or `resolved` requests `closed`.
- Admin replies append a visible message and may move the request to `in_progress` or `resolved` depending on the explicit action.

## Data and security
Create `public.support_request_messages` with ticket id, sender profile id, sender role (`user`/`admin`), message, and timestamps. It is append-only. RLS permits a ticket owner to read messages for their own request and add only their own `user` messages. Admin reads/writes through admin-only server actions / RPCs. DB-side reply RPCs enforce ownership, status transitions, role, length, and final-closed behavior atomically.

## UI
- `/contact`: recent support cards keep status, add `Resolved`, and link to the conversation.
- `/contact/[requestId]`: owner-only detail page shows original message plus thread and a reply form unless closed.
- `/admin/moderation`: support queue links each request to a dedicated detail page.
- `/admin/support/[requestId]`: admin-only detail page shows original request, visible thread, and actions to reply / mark in progress / resolve / close. Internal admin notes remain separate from the visible conversation.

## Validation
TDD contract first. Then lint, typecheck, full test suite, validators, production build, PG17 jobs. Only after GREEN: apply migration to QA and run rollback-only SQL proof for ticket owner vs outsider vs anon plus admin behavior. No Production changes.
