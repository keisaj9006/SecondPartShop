import {readFile} from "node:fs/promises";

const [filePath,expectedPackage,mode="production"]=process.argv.slice(2);
const ciPlaceholder={
 projectId:"secondpart-ci-placeholder",
 projectNumber:"123456789012",
 appId:"1:123456789012:android:0000000000000000000000",
 apiKey:"AIzaSySecondPartCiPlaceholderKey000000000"
};

const fail=message=>{
 console.error(message);
 process.exit(1);
};

if(!filePath)fail("Path to google-services.json is required.");
if(!/^[A-Za-z][A-Za-z0-9_.]+$/.test(expectedPackage??""))fail("Expected Android package is invalid.");
if(!["production","ci"].includes(mode))fail("Firebase verification mode must be production or ci.");

let config;
try{
 config=JSON.parse(await readFile(filePath,"utf8"));
}catch{
 fail("google-services.json is missing or invalid JSON.");
}

const project=config?.project_info;
const projectId=typeof project?.project_id==="string"?project.project_id.trim():"";
const projectNumber=typeof project?.project_number==="string"?project.project_number.trim():"";
if(!projectId)fail("Firebase project_id is missing.");
if(!/^\d+$/.test(projectNumber))fail("Firebase project_number is missing or invalid.");
if(mode==="production"&&projectId==="secondpart-ci-placeholder"){
 fail("Firebase CI placeholder is not permitted for a production build.");
}
if(mode==="ci"&&(projectId!==ciPlaceholder.projectId||projectNumber!==ciPlaceholder.projectNumber)){
 fail("CI mode requires the generated Firebase placeholder.");
}

const clients=Array.isArray(config?.client)?config.client:[];
const client=clients.find(item=>item?.client_info?.android_client_info?.package_name===expectedPackage);
if(!client)fail(`google-services.json does not contain Android client ${expectedPackage}.`);

const appId=typeof client?.client_info?.mobilesdk_app_id==="string"
 ?client.client_info.mobilesdk_app_id.trim():"";
if(!new RegExp(`^1:${projectNumber}:android:[A-Fa-f0-9]+$`).test(appId)){
 fail("Matching Android client has an invalid Firebase mobile app ID.");
}

const apiKeys=Array.isArray(client?.api_key)?client.api_key:[];
const hasApiKey=apiKeys.some(item=>typeof item?.current_key==="string"&&item.current_key.trim().length>=20);
if(!hasApiKey)fail("Matching Android client has no API key.");
if(mode==="ci"&&(
 clients.length!==1
 ||appId!==ciPlaceholder.appId
 ||apiKeys.length!==1
 ||apiKeys[0]?.current_key!==ciPlaceholder.apiKey
)){
 fail("CI mode requires the generated Firebase placeholder.");
}

console.log(`Verified Firebase Android config for ${expectedPackage} (${mode}).`);
