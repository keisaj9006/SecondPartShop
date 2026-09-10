const PACKAGE_NAME="com.secondpart.marketplace";
const APP_LINK_RELATION="delegate_permission/common.handle_all_urls";
const TIMEOUT_MS=10000;

const required=(name)=>{
 const value=process.env[name]?.trim();
 if(!value)throw new Error(`${name} is required.`);
 return value;
};

const normalizeFingerprint=(value)=>String(value??"").replace(/:/g,"").trim().toLowerCase();
const expectedFingerprint=normalizeFingerprint(required("ANDROID_EXPECTED_SIGNER_SHA256"));
if(!/^[0-9a-f]{64}$/.test(expectedFingerprint))throw new Error("ANDROID_EXPECTED_SIGNER_SHA256 must be a SHA-256 certificate fingerprint.");

const base=new URL(required("SECOND_PART_PRODUCTION_URL"));
if(base.protocol!=="https:")throw new Error("Production origin must use HTTPS.");
if(base.username||base.password)throw new Error("Production origin must not contain URL credentials.");
if(base.port&&base.port!=="443")throw new Error("Production origin must use the standard HTTPS port.");
if(/(^|\.)localhost$|^127\.|^0\.0\.0\.0$|preview|vercel\.app$/i.test(base.hostname)){
 throw new Error(`Production origin is not a stable public production host: ${base.hostname}`);
}
base.pathname="/";
base.search="";
base.hash="";

const sameOrigin=(url)=>new URL(url).origin===base.origin;

async function get(path,{json=false}={}){
 const url=new URL(path,base);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  const response=await fetch(url,{redirect:"follow",cache:"no-store",signal:controller.signal,headers:{"user-agent":"SecondPart-Production-Origin-Preflight/1.0"}});
  if(!response.ok)throw new Error(`${path} returned HTTP ${response.status}.`);
  if(!sameOrigin(response.url))throw new Error(`${path} redirected outside the production origin to ${response.url}.`);
  return json?await response.json():await response.text();
 }catch(error){
  if(error?.name==="AbortError")throw new Error(`${path} timed out after ${TIMEOUT_MS}ms.`);
  throw error;
 }finally{
  clearTimeout(timer);
 }
}

const mailtoFrom=(html)=>{
 const match=html.match(/href=["']mailto:([^"'?\s>]+)[^"']*["']/i);
 return match?.[1]?.trim().toLowerCase()??null;
};
const validEmail=(value)=>Boolean(value&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

const home=await get("/");
if(!home.includes("SecondPart"))throw new Error("Production homepage does not contain the SecondPart product marker.");
console.log("PASS: Production homepage is reachable on the canonical origin.");

const privacy=await get("/privacy");
if(!privacy.includes("SecondPart Privacy Policy"))throw new Error("Privacy page is missing the SecondPart Privacy Policy marker.");
if(privacy.includes("public privacy/support email must be configured in the Production environment before publication")){
 throw new Error("Privacy page still reports that the Production support email is missing.");
}
const privacyEmail=mailtoFrom(privacy);
if(!validEmail(privacyEmail))throw new Error("Privacy page does not expose a valid public privacy/support email.");
console.log("PASS: Public Privacy Policy exposes a configured support contact.");

const contact=await get("/contact");
if(!contact.includes("Contact SecondPart")||!contact.includes("Public support email")){
 throw new Error("Contact page does not expose the public support-email section.");
}
const contactEmail=mailtoFrom(contact);
if(!validEmail(contactEmail))throw new Error("Contact page does not expose a valid public support email.");
if(contactEmail!==privacyEmail)throw new Error("Contact and Privacy pages expose different public support emails.");
console.log("PASS: Public Contact and Privacy pages expose the same support email.");

const deletion=await get("/account-deletion");
if(!deletion.includes("Delete your SecondPart account")||!deletion.includes("external account-deletion route for SecondPart")){
 throw new Error("External account-deletion page is missing its public deletion markers.");
}
console.log("PASS: External account-deletion page is publicly reachable.");

const assetlinks=await get("/.well-known/assetlinks.json",{json:true});
if(!Array.isArray(assetlinks))throw new Error("assetlinks.json must return a JSON array.");
const link=assetlinks.find(item=>
 Array.isArray(item?.relation)&&
 item.relation.includes(APP_LINK_RELATION)&&
 item?.target?.namespace==="android_app"&&
 item?.target?.package_name===PACKAGE_NAME&&
 Array.isArray(item?.target?.sha256_cert_fingerprints)&&
 item.target.sha256_cert_fingerprints.some(value=>normalizeFingerprint(value)===expectedFingerprint)
);
if(!link)throw new Error(`assetlinks.json does not authorize ${PACKAGE_NAME} with the production signing certificate.`);
console.log("PASS: Android App Links authorize the production package and signing certificate.");

console.log(`\nSecondPart production origin preflight passed for ${base.origin}.`);
