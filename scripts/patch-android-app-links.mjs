import {readFile,writeFile} from "node:fs/promises";

const rawUrl=String(process.env.SECOND_PART_PRODUCTION_URL||"").trim();
let productionUrl;
try{productionUrl=new URL(rawUrl);}catch{throw new Error("SECOND_PART_PRODUCTION_URL must be a valid HTTPS URL.");}
if(productionUrl.protocol!=="https:")throw new Error("SECOND_PART_PRODUCTION_URL must use HTTPS.");
const host=productionUrl.hostname;

const manifestPath="android/app/src/main/AndroidManifest.xml";
const manifest=await readFile(manifestPath,"utf8");
const marker="</activity>";
if(!manifest.includes(marker))throw new Error("Could not locate MainActivity in AndroidManifest.xml");

const filters=[
 "/checkout/mobile-complete",
 "/seller/payments/mobile-complete",
 "/auth/mobile-complete"
].map(path=>[
 '            <intent-filter android:autoVerify="true">',
 '                <action android:name="android.intent.action.VIEW" />',
 '                <category android:name="android.intent.category.DEFAULT" />',
 '                <category android:name="android.intent.category.BROWSABLE" />',
 '                <data android:scheme="https" android:host="'+host+'" android:pathPrefix="'+path+'" />',
 "            </intent-filter>",
 "        "
].join("\n")).join("");

if(!manifest.includes('android:autoVerify="true"')){
 const next=manifest.replace(marker,filters+marker);
 await writeFile(manifestPath,next,"utf8");
}
console.log("Configured verified HTTPS App Links for "+host);
