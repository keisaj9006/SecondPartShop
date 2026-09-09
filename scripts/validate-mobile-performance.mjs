import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const ui=read("mobile-shell/ui.js");
const core=read("mobile-shell/core.js");
const app=read("mobile-shell/app.js");
const market=read("mobile-shell/views-marketplace.js");
const commerce=read("mobile-shell/views-commerce.js");
const account=read("mobile-shell/views-account.js");
const styles=read("mobile-shell/styles.css");

const checks=[
 ["Root navigation must not detach large DOM trees into a holder",!ui.includes("holder.append(...Array.from(app.childNodes))")],
 ["Navigation latency telemetry must remain enabled",ui.includes("[SecondPart][nav]")&&ui.includes("Slow route")],
 ["API cache must support stale-while-revalidate",core.includes("staleWhileRevalidate")&&core.includes("Background cache refresh failed")],
 ["Session refresh must be single-flight",core.includes("sessionRefreshPromise")&&core.includes("if(sessionRefreshPromise)return sessionRefreshPromise")],
 ["Profile loading must be single-flight",core.includes("meRequestPromise")&&core.includes("if(meRequestPromise)return meRequestPromise")],
 ["Home marketplace must render 24 items initially",market.includes("limit:24,offset:0")],
 ["Primary marketplace prefetch must match the 24 item page",app.includes('params.set("limit","24")')],
 ["Marketplace root navigation must use SWR",market.includes("staleWhileRevalidate:true")],
 ["Garage root navigation must use SWR",market.includes('"/garage",{auth:true,maxAge:60000,staleWhileRevalidate:true}')],
 ["Inbox root navigation must use SWR",commerce.includes('"/inbox",{auth:true,maxAge:15000,staleWhileRevalidate:true}')],
 ["Purchases first page must use SWR",commerce.includes("staleWhileRevalidate:offset===0")],
 ["Offscreen listing rendering must stay deferred",styles.includes("content-visibility:auto")&&styles.includes("contain-intrinsic-size")],
 ["Account must not await push storage before first render",!account.includes('const pushToken=C.Native.push?.supported?await C.Native.storage.get("pushToken")')],
 ["Cold start must keep account bootstrap in the background",app.includes("const bootstrapPromise=")&&app.includes("await UI.route(\"home\")")&&app.includes("void bootstrapPromise.then")]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?"PASS":"FAIL"}: ${name}`);
if(failed.length){
 console.error(`\n${failed.length} mobile performance invariant(s) failed.`);
 process.exit(1);
}
console.log("\nAll mobile performance invariants passed.");
