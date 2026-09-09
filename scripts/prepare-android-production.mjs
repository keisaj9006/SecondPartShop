import {readFile,writeFile} from "node:fs/promises";

const rawUrl=String(process.env.SECOND_PART_PRODUCTION_URL||"").trim();
if(!rawUrl)throw new Error("SECOND_PART_PRODUCTION_URL is required for a production Android build.");

let productionUrl;
try{productionUrl=new URL(rawUrl);}catch{throw new Error("SECOND_PART_PRODUCTION_URL must be a valid HTTPS URL.");}
if(productionUrl.protocol!=="https:")throw new Error("SECOND_PART_PRODUCTION_URL must use HTTPS.");
if(/preview|localhost|127\.0\.0\.1/i.test(productionUrl.hostname))throw new Error("Refusing to build production Android against a preview/local hostname.");

const capacitorPath="capacitor.config.json";
const config=JSON.parse(await readFile(capacitorPath,"utf8"));

config.appId="com.secondpart.marketplace";
config.appName="SecondPart";
config.loggingBehavior="none";
config.android={...(config.android||{}),backgroundColor:"#173c31",webContentsDebuggingEnabled:false};
config.server={url:productionUrl.origin,cleartext:false};
config.plugins={...(config.plugins||{}),PushNotifications:{presentationOptions:["badge","sound","alert"]}};

await writeFile(capacitorPath,JSON.stringify(config,null,2)+"\n","utf8");
console.log("Prepared Android Production for "+productionUrl.origin);
console.log("Production package: "+config.appId);
