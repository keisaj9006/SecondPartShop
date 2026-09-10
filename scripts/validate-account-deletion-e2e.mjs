import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const worker=read("src/lib/account-deletion.ts");
const adminPrivacy=read("src/app/admin/privacy/page.tsx");
const maintenance=read("src/app/api/commerce/maintenance/route.ts");
const runbook=read("docs/account-deletion-e2e-runbook.md");
const evidenceTemplate=read("docs/test-runs/account-deletion-e2e-template.md");

const storage=worker.indexOf("await purgePartImages(requestId)");
const prepare=worker.indexOf('admin.rpc("prepare_claimed_account_deletion"');
const authDelete=worker.indexOf("admin.auth.admin.deleteUser(profileId,false)");
const complete=authDelete>=0
 ?worker.indexOf('admin.rpc("complete_account_deletion_request"',authDelete)
 :-1;
const preflightStart=worker.indexOf("export async function getAccountDeletionQaPreflight");
const preflightEnd=preflightStart>=0
 ?worker.indexOf("async function purgePartImages",preflightStart)
 :-1;
const preflightBody=preflightStart>=0&&preflightEnd>preflightStart
 ?worker.slice(preflightStart,preflightEnd)
 :"";
const preflightIsReadOnly=preflightBody.length>0
 &&!preflightBody.includes(".insert(")
 &&!preflightBody.includes(".update(")
 &&!preflightBody.includes(".delete(")
 &&!preflightBody.includes(".upsert(")
 &&!preflightBody.includes(".rpc(")
 &&!preflightBody.includes("deleteUser(");

const checks=[
 ["Deletion worker must purge tracked part images before identity transformation",storage>=0&&prepare>storage],
 ["Deletion worker must prepare DB privacy transformation before hard Auth deletion",prepare>=0&&authDelete>prepare],
 ["Deletion worker must hard-delete Auth before final audit completion",authDelete>=0&&complete>authDelete],
 ["Deletion worker must remain retry-aware after Auth identity disappears",worker.includes("identity_deleted_audit_finalize_pending")&&worker.includes("identity_already_deleted")],
 ["Maintenance route must process the account deletion queue",maintenance.includes("processAccountDeletionQueue")&&maintenance.includes("deletions")],
 ["Admin Privacy must expose the request-UUID QA preflight",adminPrivacy.includes('data-account-deletion-qa-preflight="read-only"')&&adminPrivacy.includes('name="requestId"')&&adminPrivacy.includes("getAccountDeletionQaPreflight")],
 ["Account deletion QA preflight must remain read-only",preflightIsReadOnly],
 ["QA preflight must not treat an empty stored blocker as authoritative",adminPrivacy.includes("A blank stored blocker is not proof")&&adminPrivacy.includes("worker re-checks blockers")],
 ["Evidence template must require a disposable QA identity",evidenceTemplate.includes("disposable QA account")&&evidenceTemplate.includes("founder/admin account")],
 ["Evidence template must prohibit sensitive evidence",evidenceTemplate.includes("Do not record passwords")&&evidenceTemplate.includes("service-role keys")&&evidenceTemplate.includes("full personal addresses")],
 ["Evidence template must require Auth/Profile/Storage/idempotency assertions",evidenceTemplate.includes("Auth identity absent")&&evidenceTemplate.includes("Profile identity removed/detached")&&evidenceTemplate.includes("Storage objects removed")&&evidenceTemplate.includes("idempotent")],
 ["Evidence template alone must never count as a PASS",evidenceTemplate.includes("This template by itself is not release evidence and is not a PASS")],
 ["Runbook must require a disposable QA account",runbook.includes("disposable QA account")&&runbook.includes("Do not use a founder/admin account")],
 ["Runbook must prohibit manual deletion-state forcing",runbook.includes("Never set `account_deletion_requests.status` manually")&&runbook.includes("Never call `claim_account_deletion_request`")],
 ["Runbook must use the normal maintenance endpoint",runbook.includes("GET /api/commerce/maintenance")&&runbook.includes("processAccountDeletionQueue()")],
 ["Runbook must test happy-path deletion",runbook.includes("Scenario A — Happy-path disposable account deletion")],
 ["Runbook must test an active commerce blocker",runbook.includes("Scenario B — Active commerce blocker")],
 ["Runbook must test seller privacy transformation",runbook.includes("Scenario D — Seller privacy transformation")],
 ["Runbook must require a second-pass idempotency check",runbook.includes("A6. Retry-safety check")&&runbook.includes("Run the normal maintenance worker again")],
 ["Runbook must verify Storage image cleanup",runbook.includes("listing images removed from Storage")||runbook.includes("listing-image Storage objects")],
 ["Runbook must preserve the retention model",runbook.includes("docs/account-data-retention.md")&&runbook.includes("anonymised/detached")],
 ["Runbook must forbid secrets and unnecessary PII in evidence",runbook.includes("Do not capture passwords")&&runbook.includes("full personal addresses")],
 ["Launch sign-off must keep destructive E2E open until real execution",runbook.includes("must keep destructive account-deletion E2E unchecked")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} account deletion E2E invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart destructive account deletion E2E baseline passed.");
