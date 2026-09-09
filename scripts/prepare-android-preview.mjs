import {readFile,writeFile} from "node:fs/promises";

const rawUrl=String(process.env.SECOND_PART_PREVIEW_URL||"https://second-part-shop-preview.vercel.app").trim();
let previewUrl;
try{previewUrl=new URL(rawUrl);}catch{throw new Error("SECOND_PART_PREVIEW_URL must be a valid HTTPS URL.");}
if(previewUrl.protocol!=="https:")throw new Error("SECOND_PART_PREVIEW_URL must use HTTPS.");

const capacitorPath="capacitor.config.json";
const config=JSON.parse(await readFile(capacitorPath,"utf8"));

config.appId="com.secondpart.marketplace.preview";
config.appName="SecondPart";
config.loggingBehavior="debug";
config.android={...(config.android||{}),backgroundColor:"#173c31",webContentsDebuggingEnabled:true};
config.server={
 url:previewUrl.origin,
 cleartext:false
};
config.plugins={...(config.plugins||{}),PushNotifications:{presentationOptions:["badge","sound","alert"]}};

await writeFile(capacitorPath,JSON.stringify(config,null,2)+"\n","utf8");
console.log("Prepared Android Preview to load full Next.js frontend from "+previewUrl.origin);
console.log("Android Preview wrapper source:",String(process.env.GITHUB_SHA||"local"));
