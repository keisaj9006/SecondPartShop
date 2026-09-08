import {mkdir,readFile,writeFile} from "node:fs/promises";

const config=JSON.parse(await readFile("capacitor.config.json","utf8"));
const packageName=String(config.appId||"").trim();
if(!/^[a-zA-Z][a-zA-Z0-9_.]+$/.test(packageName))throw new Error("Capacitor appId is invalid.");

const json={
 project_info:{
  project_number:"123456789012",
  project_id:"secondpart-ci-placeholder",
  storage_bucket:"secondpart-ci-placeholder.appspot.com"
 },
 client:[{
  client_info:{
   mobilesdk_app_id:"1:123456789012:android:0000000000000000000000",
   android_client_info:{package_name:packageName}
  },
  oauth_client:[],
  api_key:[{current_key:"AIzaSySecondPartCiPlaceholderKey000000000"}],
  services:{appinvite_service:{other_platform_oauth_client:[]}}
 }],
 configuration_version:"1"
};
await mkdir("android/app",{recursive:true});
await writeFile("android/app/google-services.json",JSON.stringify(json,null,2)+"\n","utf8");
console.log("Wrote CI-only Firebase placeholder for "+packageName);
