# Support conversation thread implementation plan

1. Add failing contract tests for conversation storage, status transitions, owner/admin routes, and bounded loaders.
2. Add migration for append-only support messages, resolved status, RLS, and atomic user/admin reply RPCs.
3. Add owner conversation loader and `/contact/[requestId]` page with reply form.
4. Add admin support detail page and visible reply/status actions; preserve private admin notes.
5. Update `/contact` status cards and moderation links.
6. Run full CI and exact-SHA Preview verification.
7. Apply migration only to QA after GREEN.
8. Run rollback-only security proof for owner, outsider, anon, and admin role behavior.
