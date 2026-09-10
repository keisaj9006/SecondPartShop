import fs from "node:fs";

const path="docs/android-rc-test-matrix.md";
const doc=fs.readFileSync(path,"utf8");

const requiredIds=[
 "RC-INSTALL-01","RC-INSTALL-02","RC-LIFE-01","RC-LIFE-02",
 "RC-AUTH-01","RC-AUTH-02","RC-AUTH-03","RC-AUTH-04","RC-PRIVACY-01",
 "RC-NAV-01","RC-HOME-01","RC-SEARCH-01","RC-LISTING-01",
 "RC-GARAGE-01","RC-GARAGE-02","RC-GARAGE-03","RC-COMPAT-01",
 "RC-BUYER-01","RC-MSG-01","RC-UGC-01","RC-REQUEST-01",
 "RC-SELLER-01","RC-SELLER-02","RC-SELLER-03","RC-MEDIA-01","RC-MEDIA-02",
 "RC-STRIPE-01","RC-STRIPE-02","RC-ORDER-01","RC-SALES-01","RC-CASE-01",
 "RC-FCM-01","RC-FCM-02","RC-FCM-03",
 "RC-LINK-01","RC-LINK-02","RC-LINK-03",
 "RC-NET-01","RC-NET-02","RC-NET-03","RC-NET-04",
 "RC-VISUAL-01","RC-VISUAL-02","RC-VISUAL-03"
];

const checks=[
 ["RC matrix must target the production package",doc.includes("com.secondpart.marketplace")],
 ["RC must be installed from a Google Play test track",doc.includes("Google Play Internal or Closed testing track")],
 ["All required P0 RC scenarios remain documented",requiredIds.every(id=>doc.includes(id))],
 ["Navigation regression sequence must include right-to-left movement",doc.includes("Home -> Garage -> Inbox -> Account -> Home -> Account -> Inbox -> Garage -> Home")&&doc.includes("right-to-left")],
 ["Garage add-vehicle regression remains covered",doc.includes("previously selected vehicle is not incorrectly pre-filled")],
 ["Vehicle fit checkbox regression remains covered",doc.includes("Show only parts that fit this vehicle")],
 ["Camera and gallery physical-device coverage remains required",doc.includes("RC-MEDIA-01")&&doc.includes("RC-MEDIA-02")],
 ["Stripe physical return paths remain required",doc.includes("RC-STRIPE-01")&&doc.includes("RC-STRIPE-02")],
 ["Physical FCM foreground/background delivery remains required",doc.includes("RC-FCM-02")&&doc.includes("RC-FCM-03")],
 ["Verified App Links remain a release requirement",doc.includes("RC-LINK-01")&&doc.includes("Verified HTTPS App Link")],
 ["Offline and interrupted network recovery remain covered",doc.includes("RC-NET-01")&&doc.includes("RC-NET-04")],
 ["Release evidence must capture version, commit, device and Android",doc.includes("RC version")&&doc.includes("Commit SHA")&&doc.includes("Device")&&doc.includes("Android")],
 ["P0 blocked tests must remain release blockers",doc.includes("A `BLOCKED` P0 is a release blocker")],
 ["GO requires separate commerce E2E sign-off",doc.includes("docs/commerce-e2e-runbook.md")&&doc.includes("Commerce E2E signed off")],
 ["GO requires physical FCM sign-off",doc.includes("Physical FCM E2E signed off")],
 ["GO requires production package/signature verification",doc.includes("Production package/signature verified")],
 ["Release evidence must prohibit unnecessary secrets/PII",doc.includes("Do not record secrets")&&doc.includes("full delivery addresses")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} Android RC gate invariant(s) failed.`);
 process.exit(1);
}

console.log(`\nSecondPart Android RC gate passed with ${requiredIds.length} required scenarios.`);
