# Next SecondPart Internal Testing build — physical QA

Status: NOT RUN. This checklist records required physical evidence; automated tests do not close it.

Record the exact build commit, AAB SHA-256, package `com.secondpart.marketplace`, versionName/versionCode, Play track, device model/Android version, tester and evidence reference. VersionCode must exceed the last uploaded Play version; do not infer that value from the repository alone. Remain in Internal Testing.

Use the complete [physical RC matrix](android-rc-test-matrix.md), with these focused regressions for this change:

| Test | Required observation |
| --- | --- |
| Buyer sold-part return list | A participant can still see an existing case after the part becomes sold; title and status remain present. |
| Seller case list | Only the seller's cases appear; the same sold-part case remains visible. |
| Admin case list | Authorised admin sees the case and its audit state. A buyer cannot access admin pages/actions. |
| Outsider/account switch | A second account sees no first-account cases or cached private state after sign-out/sign-in. |
| Pagination and refresh | Load more/back/refresh retains cases once, with no false empty state after network failure. |
| Listing question | Normal pre-purchase question reaches the intended listing once. Sign-out, blocked users and Terms gates remain effective. |
| Case error recovery | Network loss during case loading shows a controlled retry/error; recovery restores the correct list. |
| Play update | Update the prior Play-installed build in place; package/signature/session/navigation remain valid. |
| FCM and links | Physical foreground/background push, tap routing, cold/warm App Links, Auth and Checkout returns match the configured Internal QA origin. |
| Seller media | Camera/gallery, permission denial, upload interruption and retry preserve the draft and do not duplicate media. |
| Vehicle selection | Home/Garage support clean vehicle switching and truthful fit-filter state; no stale vehicle after failed lookup. |

Do not create a new provider payment merely to run these checks. Use already-authorised isolated fixtures and existing recorded cases; provider mutations need their own scope. F-only remains a separate outstanding provider gate. A running screen, server-side FCM acceptance or a unit-test result is not physical PASS evidence.
