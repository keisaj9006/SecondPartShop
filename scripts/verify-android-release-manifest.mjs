import fs from "node:fs";
import path from "node:path";

const root=path.resolve("android/app/build/intermediates");
const reportPath=path.resolve("android-release-permissions.txt");

const blocked=new Set([
 "android.permission.ACCESS_FINE_LOCATION",
 "android.permission.ACCESS_COARSE_LOCATION",
 "android.permission.ACCESS_BACKGROUND_LOCATION",
 "android.permission.RECORD_AUDIO",
 "android.permission.READ_CONTACTS",
 "android.permission.WRITE_CONTACTS",
 "android.permission.GET_ACCOUNTS",
 "android.permission.READ_SMS",
 "android.permission.SEND_SMS",
 "android.permission.RECEIVE_SMS",
 "android.permission.RECEIVE_MMS",
 "android.permission.RECEIVE_WAP_PUSH",
 "android.permission.READ_CALL_LOG",
 "android.permission.WRITE_CALL_LOG",
 "android.permission.READ_PHONE_STATE",
 "android.permission.READ_PHONE_NUMBERS",
 "android.permission.CALL_PHONE",
 "android.permission.ANSWER_PHONE_CALLS",
 "android.permission.BODY_SENSORS",
 "android.permission.BODY_SENSORS_BACKGROUND",
 "android.permission.ACTIVITY_RECOGNITION",
 "android.permission.READ_CALENDAR",
 "android.permission.WRITE_CALENDAR",
 "android.permission.MANAGE_EXTERNAL_STORAGE",
 "android.permission.REQUEST_INSTALL_PACKAGES",
 "android.permission.QUERY_ALL_PACKAGES",
 "android.permission.SYSTEM_ALERT_WINDOW",
 "android.permission.PACKAGE_USAGE_STATS",
 "android.permission.BLUETOOTH_SCAN",
 "android.permission.BLUETOOTH_CONNECT",
 "android.permission.BLUETOOTH_ADVERTISE",
 "android.permission.NEARBY_WIFI_DEVICES"
]);

const walk=dir=>{
 if(!fs.existsSync(dir))return [];
 const result=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())result.push(...walk(full));
  else if(entry.name==="AndroidManifest.xml")result.push(full);
 }
 return result;
};

const candidates=walk(root)
 .filter(file=>/release/i.test(file))
 .map(file=>{
  let content="";
  try{content=fs.readFileSync(file,"utf8");}catch{}
  const score=(/merged_manifest|merged_manifests/i.test(file)?10:0)+(/<uses-permission\b/.test(content)?5:0)+(/<application\b/.test(content)?2:0);
  return {file,content,score};
 })
 .filter(item=>item.content.includes("<manifest"))
 .sort((a,b)=>b.score-a.score||a.file.localeCompare(b.file));

if(!candidates.length)throw new Error("Could not locate a generated Release AndroidManifest.xml after bundleRelease.");

const selected=candidates[0];
const permissions=[...new Set([...selected.content.matchAll(/<uses-permission(?:-sdk-23)?\b[^>]*android:name="([^"]+)"/g)].map(match=>match[1]))].sort();
const forbidden=permissions.filter(permission=>blocked.has(permission));
const hasInternet=permissions.includes("android.permission.INTERNET");

const relativeManifest=path.relative(process.cwd(),selected.file).replaceAll("\\","/");
const lines=[
 "SecondPart Android Release Permission Report",
 `Generated: ${new Date().toISOString()}`,
 "Expected package: com.secondpart.marketplace",
 `Merged manifest: ${relativeManifest}`,
 "",
 `Declared permissions (${permissions.length}):`,
 ...permissions.map(permission=>`- ${permission}`),
 "",
 forbidden.length
  ?`BLOCKED sensitive permissions found (${forbidden.length}): ${forbidden.join(", ")}`
  :"PASS: no release-blocked sensitive permission found."
];
fs.writeFileSync(reportPath,lines.join("\n")+"\n","utf8");

console.log(`Merged Release manifest: ${relativeManifest}`);
for(const permission of permissions)console.log(`PERMISSION: ${permission}`);

if(!hasInternet)throw new Error("Release manifest is missing android.permission.INTERNET, required by the hosted SecondPart frontend.");
if(forbidden.length)throw new Error(`Release manifest contains blocked sensitive permission(s): ${forbidden.join(", ")}`);

console.log(`PASS: ${permissions.length} merged Release permissions audited; no blocked sensitive permission found.`);
