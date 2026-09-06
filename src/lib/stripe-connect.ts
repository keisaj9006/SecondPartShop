import "server-only";

const STRIPE_API="https://api.stripe.com";
const DEFAULT_V2_VERSION="2026-08-26.preview";

type StripeRecipientAccount={
 id:string;
 configuration?:{
  recipient?:{
   capabilities?:{
    stripe_balance?:{
     stripe_transfers?:{status?:string}
    }
   }
  }
 };
 requirements?:unknown;
};

type StripeAccountLink={url?:string};

const secret=()=>{
 const value=process.env.STRIPE_SECRET_KEY?.trim();
 if(!value)throw new Error("Stripe is not configured.");
 return value;
};

export function isStripeConnectConfigured(){
 return Boolean(
  process.env.STRIPE_SECRET_KEY?.trim()&&
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()&&
  process.env.NEXT_PUBLIC_APP_URL?.trim()
 );
}

export function getAppUrl(){
 const value=process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/,"");
 if(!value||!value.startsWith("https://"))throw new Error("NEXT_PUBLIC_APP_URL must be an HTTPS URL.");
 return value;
}

async function stripeV2<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);
 headers.set("Authorization",`Bearer ${secret()}`);
 headers.set("Stripe-Version",process.env.STRIPE_CONNECT_API_VERSION?.trim()||DEFAULT_V2_VERSION);
 if(init.body)headers.set("Content-Type","application/json");
 const response=await fetch(`${STRIPE_API}${path}`,{...init,headers,cache:"no-store"});
 const payload=await response.json().catch(()=>({})) as {error?:{message?:string}}&T;
 if(!response.ok)throw new Error(payload.error?.message||"Stripe request failed.");
 return payload as T;
}

export async function createStripeRecipientAccount(input:{email:string;displayName:string}){
 return stripeV2<StripeRecipientAccount>("/v2/core/accounts",{
  method:"POST",
  body:JSON.stringify({
   contact_email:input.email,
   display_name:input.displayName,
   defaults:{
    responsibilities:{
     fees_collector:"application",
     losses_collector:"application"
    }
   },
   dashboard:"express",
   identity:{country:"gb"},
   configuration:{
    recipient:{
     capabilities:{
      stripe_balance:{
       stripe_transfers:{requested:true}
      }
     }
    }
   },
   include:["configuration.recipient","identity","requirements"]
  })
 });
}

export async function getStripeRecipientAccount(accountId:string){
 const include=new URLSearchParams();
 include.append("include[]","configuration.recipient");
 include.append("include[]","requirements");
 return stripeV2<StripeRecipientAccount>(`/v2/core/accounts/${encodeURIComponent(accountId)}?${include.toString()}`);
}

export async function createStripeOnboardingLink(accountId:string){
 const appUrl=getAppUrl();
 const result=await stripeV2<StripeAccountLink>("/v2/core/account_links",{
  method:"POST",
  body:JSON.stringify({
   account:accountId,
   use_case:{
    type:"account_onboarding",
    account_onboarding:{
     configurations:["recipient"],
     refresh_url:`${appUrl}/dashboard/payments?refresh=1`,
     return_url:`${appUrl}/dashboard/payments?returned=1`,
     collection_options:{fields:"eventually_due"}
    }
   }
  })
 });
 if(!result.url)throw new Error("Stripe did not return an onboarding URL.");
 return result.url;
}

export function recipientTransferStatus(account:StripeRecipientAccount){
 return account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status??"unknown";
}
