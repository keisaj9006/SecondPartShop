import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const ui=read("mobile-shell/ui.js");
const core=read("mobile-shell/core.js");
const app=read("mobile-shell/app.js");
const market=read("mobile-shell/views-marketplace.js");
const commerce=read("mobile-shell/views-commerce.js");
const account=read("mobile-shell/views-account.js");
const media=read("mobile-shell/views-media.js");
const fullNav=read("src/components/mobile-bottom-nav.tsx");
const auth=read("src/lib/auth.ts");
const marketplaceData=read("src/lib/data/marketplace.ts");
const homePage=read("src/app/page.tsx");
const marketplaceHome=read("src/components/marketplace-home.tsx");
const previewPrep=read("scripts/prepare-android-preview.mjs");
const searchScaleMigration=read("supabase/migrations/20260909100500_indexed_marketplace_search_candidates.sql");
const cursorMigration=read("supabase/migrations/20260909103000_marketplace_cursor_pagination.sql");
const garageLoading=read("src/app/garage/loading.tsx");
const purchasesLoading=read("src/app/account/orders/loading.tsx");
const inboxLoading=read("src/app/inbox/loading.tsx");
const accountLoading=read("src/app/account/loading.tsx");

const checks=[
 ["Root navigation must not detach large DOM trees into a holder",!ui.includes("holder.append(...Array.from(app.childNodes))")],
 ["Navigation latency telemetry must remain enabled",ui.includes("[SecondPart][nav]")&&ui.includes("Slow route")],
 ["API cache must support stale-while-revalidate",core.includes("staleWhileRevalidate")&&core.includes("Background cache refresh failed")],
 ["Cache invalidation must defeat stale in-flight responses",core.includes("responseCacheVersions")&&core.includes("cacheVersion(key)===version")],
 ["Session refresh must not revive a cleared identity",core.includes("requestEpoch=identityEpoch")&&core.includes("requestEpoch!==identityEpoch")],
 ["Session refresh must be single-flight",core.includes("sessionRefreshPromise")&&core.includes("if(sessionRefreshPromise)return sessionRefreshPromise")],
 ["Profile loading must be single-flight",core.includes("meRequestPromise")&&core.includes("if(meRequestPromise)return meRequestPromise")],
 ["Home marketplace must render 24 items initially",market.includes("limit:24,offset:0")],
 ["Primary marketplace prefetch must match the 24 item page",app.includes('params.set("limit","24")')],
 ["Marketplace root navigation must use SWR",market.includes("staleWhileRevalidate:true")],
 ["Garage root navigation must use SWR",market.includes('"/garage",{auth:true,maxAge:60000,staleWhileRevalidate:true}')],
 ["Inbox root navigation must use SWR",commerce.includes('"/inbox",{auth:true,maxAge:15000,staleWhileRevalidate:true}')],
 ["Purchases first page must use SWR",commerce.includes("staleWhileRevalidate:offset===0")],
 ["Seller sales first page must use SWR",commerce.includes('"/seller/sales?limit=30&offset=0"')&&commerce.includes("staleWhileRevalidate:true")],
 ["Seller dashboard data must use cached root requests",commerce.includes('C.apiCached("/seller/readiness"')&&commerce.includes('C.apiCached("/seller/cases?limit=20&offset=0"')],
 ["Seller inventory first page must stay lightweight",media.includes("const pageSize=24;")&&media.includes("staleWhileRevalidate:rootPage")],
 ["Seller mode must prefetch seller roots",account.includes('C.prefetch("/seller/listings?limit=24&offset=0"')&&account.includes('C.prefetch("/seller/readiness"')],
 ["Marketplace cards must prefer thumbnail URLs",ui.includes("firstImage(item,true)")&&ui.includes("thumbnailUrl||images[0].url")],
 ["Seller inventory cards must prefer thumbnail URLs",media.includes("thumbnailUrl||item.images[0].url")],
 ["Seller tabs must be treated as root navigation peers",ui.includes('"seller","inventory","sellerSales"')&&ui.includes("peerRootNavigation")],
 ["Late seller responses must not overwrite a newer route",commerce.includes('UI.isCurrent("seller")')&&commerce.includes('UI.isCurrent("sellerSales")')&&media.includes('UI.isCurrent("inventory")')],
 ["Account must not await push storage before first render",!account.includes('const pushToken=C.Native.push?.supported?await C.Native.storage.get("pushToken")')],
 ["Cold start must keep account bootstrap in the background",app.includes("const bootstrapPromise=")&&app.includes("await UI.route(\"home\")")&&app.includes("void bootstrapPromise.then")],
 ["Full frontend root tabs must optimistically acknowledge taps",fullNav.includes("pendingNavigation")&&fullNav.includes("setPendingNavigation")],
 ["Full frontend root tabs must prefetch destinations",fullNav.includes("router.prefetch(item.href)")&&fullNav.includes("onPointerDown")],
 ["Auth user reads must be request-deduped",auth.includes("getCurrentUser=cache(async()=>")],
 ["Auth profile reads must be request-deduped",auth.includes("getCurrentProfile=cache(async():Promise<Profile|null>=>")],
 ["Marketplace home must pass cursor tokens to data layer",homePage.includes("marketplaceCursor")&&homePage.includes("cursor:marketplaceCursor")],
 ["Default marketplace browse must use cursor RPC",marketplaceData.includes('marketplace_browse_cursor_page')&&marketplaceData.includes('mode:"cursor"')],
 ["Cursor pagination must use stable created_at + id ordering",cursorMigration.includes("(p.created_at,p.id)<(p_after_created_at,p_after_id)")&&cursorMigration.includes("order by p.created_at desc,p.id desc")],
 ["Search ranking must stay bounded to indexed candidates",searchScaleMigration.includes("candidate_rows as")&&searchScaleMigration.includes("candidate_limit")],
 ["Cursor UI must avoid deep OFFSET page links",marketplaceHome.includes('pagination.mode==="cursor"')&&marketplaceHome.includes("Next 24 parts")],
 ["Android Preview must keep loading the full Next.js frontend",previewPrep.includes("second-part-shop-preview.vercel.app")&&previewPrep.includes("config.server=")],
 ["Garage root tab must have an instant loading boundary",garageLoading.includes('variant="garage"')],
 ["Purchases root tab must have an instant loading boundary",purchasesLoading.includes('variant="purchases"')],
 ["Inbox root tab must have an instant loading boundary",inboxLoading.includes('variant="inbox"')],
 ["Account root tab must have an instant loading boundary",accountLoading.includes('variant="account"')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?"PASS":"FAIL"}: ${name}`);
if(failed.length){
 console.error(`\n${failed.length} mobile performance invariant(s) failed.`);
 process.exit(1);
}
console.log("\nAll mobile performance invariants passed.");
