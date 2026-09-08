import {readFile,writeFile} from "node:fs/promises";

const rawUrl=String(process.env.SECOND_PART_PRODUCTION_URL||"").trim();
let productionUrl;
try{productionUrl=new URL(rawUrl);}catch{throw new Error("SECOND_PART_PRODUCTION_URL must be a valid HTTPS URL.");}
if(productionUrl.protocol!=="https:")throw new Error("SECOND_PART_PRODUCTION_URL must use HTTPS.");
const base=productionUrl.origin;

const capacitorPath="capacitor.config.json";
const config=JSON.parse(await readFile(capacitorPath,"utf8"));
config.appId="com.secondpart.marketplace";
config.appName="SecondPart";
config.webDir="mobile-shell";
config.loggingBehavior="none";
config.android={...(config.android||{}),backgroundColor:"#173c31",webContentsDebuggingEnabled:false};
config.plugins={...(config.plugins||{}),PushNotifications:{presentationOptions:["badge","sound","alert"]}};
delete config.server;
await writeFile(capacitorPath,JSON.stringify(config,null,2)+"\n","utf8");

const mobileConfigPath="mobile-shell/config.js";
let mobileConfig=await readFile(mobileConfigPath,"utf8");
mobileConfig=mobileConfig
 .replace(/apiBaseUrl:"[^"]+"/, 'apiBaseUrl:"'+base+'"')
 .replace(/webBaseUrl:"[^"]+"/, 'webBaseUrl:"'+base+'"')
 .replace(/buildChannel:"[^"]+"/, 'buildChannel:"release"');
await writeFile(mobileConfigPath,mobileConfig,"utf8");

console.log("Prepared production Android config for "+base);
