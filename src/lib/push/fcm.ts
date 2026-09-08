import "server-only";

import {createSign} from "node:crypto";

type FirebaseServiceAccount={
 project_id:string;
 client_email:string;
 private_key:string;
};

let cachedAccess:{token:string;expiresAt:number}|null=null;

export const isFcmPushConfigured=()=>Boolean(String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64??"").trim());

const serviceAccount=():FirebaseServiceAccount=>{
 const encoded=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64??"").trim();
 if(!encoded)throw new Error("firebase_push_not_configured");
 let parsed:unknown;
 try{parsed=JSON.parse(Buffer.from(encoded,"base64").toString("utf8"));}catch{throw new Error("firebase_service_account_invalid");}
 const row=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};
 const project_id=String(row.project_id??"").trim();
 const client_email=String(row.client_email??"").trim();
 const private_key=String(row.private_key??"");
 if(!project_id||!client_email.includes("@")||!private_key.includes("PRIVATE KEY"))throw new Error("firebase_service_account_invalid");
 return {project_id,client_email,private_key};
};

const base64url=(value:string|Buffer)=>Buffer.from(value).toString("base64url");

async function accessToken(){
 const now=Date.now();
 if(cachedAccess&&cachedAccess.expiresAt-now>60000)return cachedAccess.token;
 const account=serviceAccount();
 const iat=Math.floor(now/1000);
 const header=base64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
 const claims=base64url(JSON.stringify({
  iss:account.client_email,
  scope:"https://www.googleapis.com/auth/firebase.messaging",
  aud:"https://oauth2.googleapis.com/token",
  iat,
  exp:iat+3600
 }));
 const unsigned=header+"."+claims;
 const signer=createSign("RSA-SHA256");
 signer.update(unsigned);
 signer.end();
 const assertion=unsigned+"."+signer.sign(account.private_key).toString("base64url");

 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 let response:Response;
 try{
  response=await fetch("https://oauth2.googleapis.com/token",{
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({
    grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
   }),
   cache:"no-store",
   signal:controller.signal
  });
 }finally{clearTimeout(timer);}
 const payload=await response.json().catch(()=>({})) as {access_token?:unknown;expires_in?:unknown};
 if(!response.ok||typeof payload.access_token!=="string")throw new Error("firebase_oauth_failed");
 const expires=Math.max(300,Math.min(Number(payload.expires_in)||3600,3600));
 cachedAccess={token:payload.access_token,expiresAt:now+expires*1000};
 return cachedAccess.token;
}

export async function sendFcmPush(input:{
 token:string;
 notificationId:string;
 title:string;
 body:string|null;
 href:string|null;
}){
 const account=serviceAccount();
 const bearer=await accessToken();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 let response:Response;
 try{
  response=await fetch("https://fcm.googleapis.com/v1/projects/"+encodeURIComponent(account.project_id)+"/messages:send",{
   method:"POST",
   headers:{
    Authorization:"Bearer "+bearer,
    "Content-Type":"application/json"
   },
   body:JSON.stringify({
    message:{
     token:input.token,
     notification:{
      title:input.title.slice(0,180),
      body:String(input.body??"").slice(0,500)
     },
     data:{
      href:String(input.href??"").slice(0,500),
      notificationId:input.notificationId
     },
     android:{priority:"HIGH"}
    }
   }),
   cache:"no-store",
   signal:controller.signal
  });
 }finally{clearTimeout(timer);}
 const payload=await response.json().catch(()=>({})) as Record<string,unknown>;
 if(response.ok)return {ok:true,invalidToken:false,error:null};
 const serialized=JSON.stringify(payload);
 const invalidToken=response.status===404||serialized.includes("UNREGISTERED")||serialized.includes("registration-token-not-registered");
 return {
  ok:false,
  invalidToken,
  error:invalidToken?"device_unregistered":"fcm_http_"+response.status
 };
}
