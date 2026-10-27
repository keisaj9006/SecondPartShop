import {EXPECTED_PLAY_APP_SIGNING_SHA256,validateInternalOrigin,validatePlayAssetLinks} from "./android-internal-release-policy.mjs";

const base=new URL(validateInternalOrigin(process.env.SECOND_PART_INTERNAL_URL));
const timeoutMs=15_000;

async function get(path,{json=false}={}){
 const url=new URL(path,base);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{redirect:"manual",cache:"no-store",signal:controller.signal,headers:{Accept:json?"application/json":"text/html, text/plain"}});
  if(response.status>=300&&response.status<400)throw new Error(path+" must not redirect.");
  if(!response.ok)throw new Error(path+" returned HTTP "+response.status+".");
  return json?response.json():response.text();
 }finally{
  clearTimeout(timer);
 }
}

const home=await get("/");
if(!home.includes("SecondPart"))throw new Error("Internal QA homepage is missing the SecondPart marker.");

const privacy=await get("/privacy");
if(!privacy.includes("SecondPart Privacy Policy"))throw new Error("Internal QA Privacy page is missing.");

const contact=await get("/contact");
if(!contact.includes("Contact SecondPart"))throw new Error("Internal QA Contact page is missing.");

const deletion=await get("/account-deletion");
if(!deletion.includes("Delete your SecondPart account"))throw new Error("Internal QA account-deletion page is missing.");

const assetLinks=await get("/.well-known/assetlinks.json",{json:true});
validatePlayAssetLinks(assetLinks);

console.log("PASS: stable Internal QA origin is reachable: "+base.origin);
console.log("PASS: public policy/contact/deletion routes are reachable.");
console.log("PASS: App Links authorize com.secondpart.marketplace with Play signer "+EXPECTED_PLAY_APP_SIGNING_SHA256+".");
