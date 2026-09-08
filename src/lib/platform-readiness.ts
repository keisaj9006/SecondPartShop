import "server-only";

import { isStripeConnectConfigured } from "@/lib/stripe-connect";
import { isStripeCheckoutConfigured } from "@/lib/stripe-payments";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ReadinessCheck={
 key:string;
 label:string;
 ready:boolean;
 detail:string;
};

const present=(value:string|undefined)=>Boolean(value?.trim());

export function getPlatformReadiness(){
 const siteUrl=process.env.NEXT_PUBLIC_SITE_URL?.trim()||process.env.NEXT_PUBLIC_APP_URL?.trim();
 const checks:ReadinessCheck[]=[
  {
   key:"supabase-public",
   label:"Supabase public client",
   ready:isSupabaseConfigured(),
   detail:"Marketplace reads, authentication and normal user writes."
  },
  {
   key:"supabase-admin",
   label:"Supabase service role",
   ready:present(process.env.SUPABASE_SERVICE_ROLE_KEY),
   detail:"Server-only commerce, webhook and administrative operations."
  },
  {
   key:"site-url",
   label:"Canonical HTTPS app URL",
   ready:Boolean(siteUrl?.startsWith("https://")),
   detail:"Stripe redirects, hosted onboarding and production callbacks."
  },
  {
   key:"stripe-connect",
   label:"Stripe seller onboarding",
   ready:isStripeConnectConfigured(),
   detail:"Connected seller payout account creation and verification."
  },
  {
   key:"stripe-checkout",
   label:"Stripe checkout + webhook",
   ready:isStripeCheckoutConfigured(),
   detail:"Buyer payment collection and verified payment state changes."
  },
  {
   key:"commerce-cron",
   label:"Commerce maintenance secret",
   ready:present(process.env.CRON_SECRET),
   detail:"Scheduled reconciliation, delayed payouts and seller-account sync."
  },
  {
   key:"dvsa-provider",
   label:"DVSA vehicle lookup",
   ready:
    process.env.VEHICLE_LOOKUP_PROVIDER?.trim()==="dvsa_mot_history"&&
    present(process.env.DVSA_MOT_CLIENT_ID)&&
    present(process.env.DVSA_MOT_CLIENT_SECRET)&&
    present(process.env.DVSA_MOT_TOKEN_URL)&&
    present(process.env.DVSA_MOT_API_KEY)&&
    present(process.env.DVSA_MOT_API_BASE_URL),
   detail:"UK registration lookup. Manual vehicle selection remains the fallback."
  }
 ];

 const mobileReleaseChecks:ReadinessCheck[]=[
  {
   key:"mobile-firebase",
   label:"Firebase Cloud Messaging sender",
   ready:present(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64),
   detail:"Server-side FCM HTTP v1 credentials for Android push delivery."
  },
  {
   key:"mobile-push-dispatch",
   label:"Push dispatch authorization",
   ready:present(process.env.PUSH_DISPATCH_SECRET)||present(process.env.CRON_SECRET),
   detail:"Protects the server endpoint that drains the private push outbox."
  },
  {
   key:"mobile-app-links",
   label:"Verified Android App Links",
   ready:present(process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS),
   detail:"Publishes the production signing certificate fingerprint in /.well-known/assetlinks.json."
  },
  {
   key:"mobile-production-url",
   label:"Production mobile HTTPS origin",
   ready:Boolean(siteUrl?.startsWith("https://")&&!siteUrl.includes("preview")),
   detail:"Release AAB must point to the canonical production SecondPart domain, not a preview deployment."
  }
 ];

 return {
  checks,
  readyCount:checks.filter(check=>check.ready).length,
  totalCount:checks.length,
  launchCriticalReady:checks
   .filter(check=>check.key!=="dvsa-provider")
   .every(check=>check.ready),
  mobileReleaseChecks,
  mobileReadyCount:mobileReleaseChecks.filter(check=>check.ready).length,
  mobileTotalCount:mobileReleaseChecks.length,
  mobileReleaseReady:mobileReleaseChecks.every(check=>check.ready)
 };
}
