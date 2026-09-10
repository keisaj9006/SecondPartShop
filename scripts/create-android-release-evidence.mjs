import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const required=(name)=>{
 const value=process.env[name]?.trim();
 if(!value)throw new Error(`${name} is required to generate release evidence.`);
 return value;
};

const aabPath=path.resolve(process.env.ANDROID_AAB_PATH?.trim()||"android/app/build/outputs/bundle/release/app-release.aab");
const permissionsPath=path.resolve(process.env.ANDROID_PERMISSION_REPORT_PATH?.trim()||"android-release-permissions.txt");
const outputPath=path.resolve(process.env.ANDROID_RELEASE_EVIDENCE_PATH?.trim()||"android-release-evidence.json");
const summaryPath=path.resolve(process.env.ANDROID_RELEASE_EVIDENCE_SUMMARY_PATH?.trim()||"android-release-evidence.txt");

if(!fs.existsSync(aabPath)||!fs.statSync(aabPath).isFile()||fs.statSync(aabPath).size<1)throw new Error("Release AAB is missing or empty.");
if(!fs.existsSync(permissionsPath)||!fs.statSync(permissionsPath).isFile())throw new Error("Android permission audit report is missing.");

const config=JSON.parse(fs.readFileSync("capacitor.config.json","utf8"));
if(config.appId!=="com.secondpart.marketplace")throw new Error(`Unexpected production package: ${config.appId}`);

const productionUrl=required("SECOND_PART_PRODUCTION_URL");
const parsedUrl=new URL(productionUrl);
if(parsedUrl.protocol!=="https:")throw new Error("Production URL must use HTTPS.");
if(/preview|localhost|127\.0\.0\.1/i.test(parsedUrl.hostname))throw new Error("Release evidence cannot be generated for a preview/local production URL.");

const versionName=required("SECOND_PART_VERSION_NAME");
const versionCode=required("SECOND_PART_VERSION_CODE");
const signerSha256=required("ANDROID_AAB_SIGNER_SHA256").replaceAll(":","").toLowerCase();
if(!/^[0-9a-f]{64}$/.test(signerSha256))throw new Error("ANDROID_AAB_SIGNER_SHA256 must be a SHA-256 certificate fingerprint.");

const aab=fs.readFileSync(aabPath);
const aabSha256=crypto.createHash("sha256").update(aab).digest("hex");
const permissionReport=fs.readFileSync(permissionsPath,"utf8");
if(!permissionReport.includes("PASS: no release-blocked sensitive permission found."))throw new Error("Permission report does not contain a passing sensitive-permission audit.");

const permissions=[...permissionReport.matchAll(/^- (android\.permission\.[^\r\n]+)$/gm)].map(match=>match[1]).sort();
const generatedAt=new Date().toISOString();
const commitSha=(process.env.GITHUB_SHA?.trim()||process.env.VERCEL_GIT_COMMIT_SHA?.trim()||"unknown").toLowerCase();
const workflowRunId=process.env.GITHUB_RUN_ID?.trim()||null;
const workflowRunNumber=process.env.GITHUB_RUN_NUMBER?.trim()||null;

const evidence={
 schemaVersion:1,
 product:"SecondPart",
 packageName:config.appId,
 versionName,
 versionCode,
 productionOrigin:parsedUrl.origin,
 commitSha,
 aabFile:path.basename(aabPath),
 aabBytes:aab.length,
 aabSha256,
 signerCertificateSha256:signerSha256,
 permissions,
 permissionCount:permissions.length,
 permissionAuditPassed:true,
 workflowRunId,
 workflowRunNumber,
 generatedAt
};

fs.writeFileSync(outputPath,JSON.stringify(evidence,null,2)+"\n","utf8");

const summary=[
 "SecondPart Android Release Evidence",
 `Generated: ${generatedAt}`,
 `Package: ${evidence.packageName}`,
 `Version: ${versionName} (${versionCode})`,
 `Production origin: ${evidence.productionOrigin}`,
 `Commit: ${commitSha}`,
 `AAB: ${evidence.aabFile}`,
 `AAB size: ${aab.length} bytes`,
 `AAB SHA-256: ${aabSha256}`,
 `Signer certificate SHA-256: ${signerSha256}`,
 `Merged permissions: ${permissions.length}`,
 `Permission audit: PASS`,
 workflowRunId?`GitHub run: ${workflowRunId}${workflowRunNumber?` (#${workflowRunNumber})`:""}`:"GitHub run: unavailable",
 "",
 "This evidence file intentionally excludes credentials, tokens, signing passwords and Firebase configuration."
];
fs.writeFileSync(summaryPath,summary.join("\n")+"\n","utf8");

console.log(`Release evidence written to ${path.relative(process.cwd(),outputPath)}`);
console.log(`AAB SHA-256: ${aabSha256}`);
console.log(`Signer SHA-256: ${signerSha256}`);
