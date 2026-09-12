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
const productionAndroidPrep=read("scripts/prepare-android-production.mjs");
const productionAndroidPatch=read("scripts/patch-android-production.mjs");
const productionAndroidWorkflow=read(".github/workflows/android-production-aab.yml");
const searchScaleMigration=read("supabase/migrations/20260909100500_indexed_marketplace_search_candidates.sql");
const searchPageMigration=read("supabase/migrations/20260912110440_complete_marketplace_search_page.sql");
const cursorMigration=read("supabase/migrations/20260909103000_marketplace_cursor_pagination.sql");
const sellerCursorMigration=read("supabase/migrations/20260909104500_seller_inventory_cursor_pagination.sql");
const sortedCursorMigration=read("supabase/migrations/20260909195500_marketplace_sorted_cursor_pagination.sql");
const cursorIndexAlignment=read("supabase/migrations/20260909194000_align_cursor_indexes.sql");
const compatibilityCursorMigration=read("supabase/migrations/20260909202000_catalogue_compatibility_cursor.sql");
const distanceV2Migration=read("supabase/migrations/20260909203500_distance_page_v2.sql");
const importScale=read("src/lib/inventory-csv-import.ts");
const importLimits=read("src/lib/inventory-import-constants.ts");
const savedSearchQueueScale=read("supabase/migrations/20260909111000_saved_search_queue_throughput.sql");
const garageLoading=read("src/app/garage/loading.tsx");
const purchasesLoading=read("src/app/account/orders/loading.tsx");
const inboxLoading=read("src/app/inbox/loading.tsx");
const accountLoading=read("src/app/account/loading.tsx");
const accountPage=read("src/app/account/page.tsx");
const accountDashboard=read("src/components/account-dashboard-content.tsx");
const reputation=read("src/lib/data/reputation.ts");
const nativeMode=read("src/components/native-app-mode.tsx");
const nativeTopBar=read("src/components/native-top-bar.tsx");
const webHeader=read("src/components/header.tsx");
const rootLayout=read("src/app/layout.tsx");
const globals=read("src/app/globals.css");

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
 ["Full frontend root tabs must optimistically acknowledge taps",fullNav.includes("useLinkStatus")&&fullNav.includes("pending")],
 ["Full frontend root tabs must prefetch destinations once through Next Link",fullNav.includes("prefetch={true}")&&!fullNav.includes("router.prefetch")&&!fullNav.includes("onPointerDown")&&!fullNav.includes("requestIdleCallback")],
 ["Full frontend root navigation latency must stay observable",fullNav.includes("[SecondPart][nav]")&&fullNav.includes("Slow route")&&fullNav.includes("elapsed>750")],
 ["Auth user reads must be request-deduped",auth.includes("getCurrentUser=cache(async()=>")],
 ["Auth profile reads must be request-deduped",auth.includes("getCurrentProfile=cache(async():Promise<Profile|null>=>")],
 ["Marketplace home must pass cursor tokens to data layer",homePage.includes("marketplaceCursor")&&homePage.includes("cursor:marketplaceCursor")],
 ["Marketplace Home must use lean card payloads",homePage.includes("lean:true")&&marketplaceData.includes("selectListingCardLean")&&marketplaceData.includes("leanCardListingsFromRows")&&marketplaceData.includes("slug,title,manufacturer,part_number")&&!marketplaceData.includes("selectListingCardLean=()=>`id,created_at,updated_at,seller_id,category_id,donor_vehicle_id,source_channel,source_external_id,import_batch_id,slug,title,description")],
 ["Default marketplace browse must use cursor RPC",marketplaceData.includes('marketplace_browse_cursor_page')&&marketplaceData.includes('mode:"cursor"')],
 ["Cursor pagination must use stable created_at + id ordering",cursorMigration.includes("(p.created_at,p.id)<(p_after_created_at,p_after_id)")&&cursorMigration.includes("order by p.created_at desc,p.id desc")],
 ["Marketplace cursor indexes must match DESC UUID tie-breakers",cursorIndexAlignment.includes("created_at desc,id desc")&&cursorIndexAlignment.includes("updated_at desc,id desc")],
 ["Marketplace sort modes must use cursor V2",marketplaceData.includes("marketplace_browse_cursor_page_v2")&&marketplaceData.includes('cursorSorts:MarketplaceCursorSort[]=["best","price_asc","price_desc","delivery","warranty"]')],
 ["Sorted cursor RPC must cover price, delivery and warranty",sortedCursorMigration.includes("p_sort='price_asc'")&&sortedCursorMigration.includes("p_sort='price_desc'")&&sortedCursorMigration.includes("p_sort='delivery'")&&sortedCursorMigration.includes("p_sort='warranty'")],
 ["Default vehicle compatibility must use keyset pagination",marketplaceData.includes("marketplace_catalogue_cursor_page_v1")&&marketplaceData.includes('const canUseCatalogueCursor=sort==="best"&&!filters.query?.trim()')],
 ["Compatibility cursor must preserve confidence + created_at + id ordering",compatibilityCursorMigration.includes("f.confidence_rank<p_after_confidence_rank")&&compatibilityCursorMigration.includes("order by f.confidence_rank desc,f.created_at desc,f.part_id desc")],
 ["Text search must page global eligibility inside one bounded RPC",marketplaceData.includes('supabase.rpc("marketplace_search_page_v1"')&&marketplaceData.includes("const visibleRows=pageRows.slice(0,limit)")&&searchPageMigration.includes("limit greatest(1,least(coalesce(p_limit,24),60))+1")],
 ["Distance pagination must request limit+1",marketplaceData.includes("p_limit:limit+1")&&marketplaceData.includes("const hasMore=rawPageRows.length>limit")],
 ["Distance browse must use V2 RPCs",marketplaceData.includes("marketplace_distance_page_v2")&&marketplaceData.includes("marketplace_catalogue_distance_page_v2")],
 ["Distance V2 must compute distance once per seller",distanceV2Migration.includes("seller_distances as")&&distanceV2Migration.includes("join seller_distances d on d.seller_id=p.seller_id")],
 ["Distance V2 must avoid COUNT window on hot path",!distanceV2Migration.includes("count(*) over() as total_count")],
 ["Autosuggest retains its indexed candidate budget",searchScaleMigration.includes("candidate_rows as")&&searchScaleMigration.includes("candidate_limit")],
 ["Full search has no early candidate cap",!searchPageMigration.includes("candidate_limit")&&!searchPageMigration.includes("marketplace_search_part_ids")&&searchPageMigration.includes("eligible as not materialized")],
 ["Cursor UI must avoid deep OFFSET page links",marketplaceHome.includes('pagination.mode==="cursor"')&&marketplaceHome.includes("Next 24 parts")],
 ["Large seller inventory must use keyset pagination by default",marketplaceData.includes("seller_inventory_cursor_page")&&marketplaceData.includes("encodeSellerInventoryCursor")],
 ["Seller cursor must match seller updated-at index order",sellerCursorMigration.includes("(p.updated_at,p.id)<(p_after_updated_at,p_after_id)")&&sellerCursorMigration.includes("order by p.updated_at desc,p.id desc")],
 ["Bulk CSV import must remain chunked with shared large-inventory limits",importLimits.includes("BULK_IMPORT_MAX_ROWS=5000")&&importLimits.includes("BULK_IMPORT_MAX_FILE_BYTES=20*1024*1024")&&importScale.includes("BULK_IMPORT_MAX_ROWS")&&importScale.includes("BULK_IMPORT_MAX_FILE_BYTES")&&importScale.includes("const INSERT_CHUNK_SIZE=250;")&&importScale.includes("for(let start=0;start<payload.length;start+=INSERT_CHUNK_SIZE)")],
 ["Saved-search backlog must be indexed and processed asynchronously in batches",savedSearchQueueScale.includes("saved_search_match_queue_enqueued_idx")&&savedSearchQueueScale.includes("process_saved_search_match_queue(250)")&&savedSearchQueueScale.includes("saved_search_match_queue_stats")],
 ["Android Preview must keep loading the full Next.js frontend",previewPrep.includes("second-part-shop-preview.vercel.app")&&previewPrep.includes("config.server=")],
 ["Production Android must use the full HTTPS frontend",productionAndroidPrep.includes('config.server={url:productionUrl.origin,cleartext:false}')&&productionAndroidPrep.includes('com.secondpart.marketplace')&&!productionAndroidPrep.includes('marketplace.preview')],
 ["Production Android must disable debug WebView and logging",productionAndroidPrep.includes('loggingBehavior="none"')&&productionAndroidPrep.includes('webContentsDebuggingEnabled:false')],
 ["Google Play build must target API 36",productionAndroidPatch.includes('compileSdkVersion = 36')&&productionAndroidPatch.includes('targetSdkVersion = 36')],
 ["Google Play build must produce a signed release AAB",productionAndroidWorkflow.includes('./gradlew bundleRelease')&&productionAndroidWorkflow.includes('Verify AAB signature')],
 ["Google Play build must never use the preview signing key",!productionAndroidWorkflow.includes('ANDROID_PREVIEW_KEYSTORE_BASE64')&&!productionAndroidWorkflow.includes('secondPartPreviewSigning')],
 ["Production Android must reject preview/local hosts",productionAndroidPrep.includes('/preview|localhost|127\\.0\\.0\\.1/i')],
 ["Garage root tab must have an instant loading boundary",garageLoading.includes('variant="garage"')],
 ["Purchases root tab must have an instant loading boundary",purchasesLoading.includes('variant="purchases"')],
 ["Inbox root tab must have an instant loading boundary",inboxLoading.includes('variant="inbox"')],
 ["Account root tab must have an instant loading boundary",accountLoading.includes('variant="account"')],
 ["Account heavy dashboard data must stream behind Suspense",accountPage.includes("<Suspense")&&accountPage.includes("AccountDashboardContent")&&accountDashboard.includes("Promise.all")],
 ["Account trust profile reads must be request-deduped",reputation.includes("getPublicMemberProfileById=cache(async")],
 ["Native mode must persist a server-visible marker",nativeMode.includes("secondpart_native=1")&&nativeMode.includes("Max-Age=31536000")],
 ["Native app must skip heavy server web header reads",webHeader.includes('cookies()')&&webHeader.includes('secondpart_native')&&webHeader.includes('return null')],
 ["Native app must keep a persistent lightweight top bar",rootLayout.includes("<NativeTopBar />")&&nativeTopBar.includes('native-persistent-topbar')],
 ["Native chrome must hide the per-page web header",globals.includes("html.native-app .app-topbar")&&globals.includes("display: none")&&globals.includes("html.native-app .native-persistent-topbar")]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?"PASS":"FAIL"}: ${name}`);
if(failed.length){
 console.error(`\n${failed.length} mobile performance invariant(s) failed.`);
 process.exit(1);
}
console.log("\nAll mobile performance invariants passed.");
