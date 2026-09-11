// Read-only Preview diagnostic. Secrets stay in the deployment environment.
const key=(process.env.STRIPE_SECRET_KEY??"").trim();
if(process.env.VERCEL_ENV!=="preview"||!/^(sk|rk)_test_/.test(key)){
 throw new Error("Diagnostic requires Preview and Stripe test mode");
}
const accountId=process.argv[2];
if(!/^acct_[A-Za-z0-9]+$/.test(accountId??""))throw new Error("A Stripe account ID is required");
const stripeVersion=process.env.STRIPE_CONNECT_API_VERSION?.trim()||"2026-08-26.preview";
const query=new URLSearchParams({"include[0]":"configuration.recipient","include[1]":"requirements"});
const response=await fetch(`https://api.stripe.com/v2/core/accounts/${accountId}?${query}`,{
 headers:{Authorization:`Bearer ${key}`,"Stripe-Version":stripeVersion},
 signal:AbortSignal.timeout(15000)
});
if(!response.ok)throw new Error(`Stripe diagnostic HTTP ${response.status}`);
const account=await response.json();
if(account.id!==accountId||account.livemode!==false)throw new Error("Unexpected account or non-test response");
const balance=account.configuration?.recipient?.capabilities?.stripe_balance;
const capability=value=>({
 status:value?.status??"unknown",
 details:(value?.status_details??[]).map(detail=>({code:detail.code,resolution:detail.resolution}))
});
console.log("SECOND_PART_STRIPE_DIAGNOSTIC "+JSON.stringify({
 accountId:account.id,livemode:account.livemode,stripeVersion,
 supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
 siteUrl:process.env.NEXT_PUBLIC_SITE_URL,
 stripeTransfers:capability(balance?.stripe_transfers),
 payouts:capability(balance?.payouts)
}));
