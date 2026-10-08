import {createHash} from "node:crypto";
import {readFileSync,readdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const page=16384n;
// Android's loader exempts RELRO that covers the entire corresponding LOAD:
// https://android.googlesource.com/platform/bionic/+/android16-qpr2-release/linker/linker_phdr_16kib_compat.cpp
export function auditElf(data,name="native library"){
 const fail=message=>{throw new Error(`${name}: ${message}`);};
 if(data.length<16||!data.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])))fail("invalid ELF header");
 if(data[5]!==1)fail("unsupported ELF byte order");
 const wide=data[4]===2;
 if(!wide&&data[4]!==1)fail("unsupported ELF class");
 const headerSize=wide?64:52,expectedEntry=wide?56:32;
 if(data.length<headerSize)fail("truncated ELF header");
 const word=offset=>wide?data.readBigUInt64LE(offset):BigInt(data.readUInt32LE(offset));
 const tableOffset=word(wide?32:28);
 const entrySize=data.readUInt16LE(wide?54:42),count=data.readUInt16LE(wide?56:44);
 if(entrySize!==expectedEntry||count===0xffff)fail("unsupported ELF program header table");
 if(tableOffset+BigInt(entrySize)*BigInt(count)>BigInt(data.length))fail("truncated ELF program header table");
 const loads=[],relros=[];
 for(let index=0;index<count;index++){
  const start=Number(tableOffset)+index*entrySize,type=data.readUInt32LE(start);
  const segment={offset:word(start+(wide?8:4)),address:word(start+(wide?16:8)),size:word(start+(wide?40:20)),align:word(start+(wide?48:28))};
  if(type===1)loads.push(segment);
  if(type===0x6474e552)relros.push(segment);
 }
 if(!loads.length)fail("ELF has no LOAD segment");
 let previousEnd=0n;
 for(const load of loads){
  if(load.align<page||(load.align&(load.align-1n))!==0n)fail("LOAD alignment is below 16 KB or not a power of two");
  if(load.address%load.align!==load.offset%load.align)fail("LOAD offset and virtual address are not congruent");
  if(previousEnd>load.address-load.address%page)fail("LOAD pages overlap at 16 KB");
  previousEnd=load.address+load.size;
 }
 if(relros.length>1)fail("multiple RELRO segments are unsupported");
 let relroMode="absent";
 if(relros.length){
  const relro=relros[0],load=loads.find(segment=>segment.address===relro.address);
  if(!load)fail("unsupported RELRO layout");
  if(load.size<=relro.size)relroMode="entire-load";
  else if((relro.address+relro.size)%page===0n)relroMode="aligned-prefix";
  else fail("RELRO prefix end is not 16 KB aligned");
 }
 return {elfBits:wide?64:32,loadSegments:loads.length,relroMode};
}
export function auditDirectory(directory){
 const results=[];
 const walk=current=>{
  for(const entry of readdirSync(current,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const file=path.join(current,entry.name);
   if(entry.isSymbolicLink())throw new Error("Native audit directory must not contain symlinks");
   if(entry.isDirectory())walk(file);
   else if(entry.isFile()&&entry.name.endsWith(".so")){
    const data=readFileSync(file),library=path.relative(directory,file).replaceAll(path.sep,"/");
    results.push({library,sha256:createHash("sha256").update(data).digest("hex"),...auditElf(data,library)});
   }
  }
 };
 walk(directory);
 if(!results.length)throw new Error("Expected native libraries are absent from the audit directory");
 return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [directory,apk,zipalign,report,aab]=process.argv.slice(2);
  if(!directory||!apk||!zipalign||!report)throw new Error("Usage: node verify-android-16kb.mjs <native-directory> <derived.apk> <zipalign> <report.json>");
  const libraries=auditDirectory(directory);
  const alignment=spawnSync(zipalign,["-c","-P","16","4",apk],{encoding:"utf8"});
  if(alignment.error||alignment.status!==0)throw new Error("APK zipalign 16 KB verification failed");
  writeFileSync(report,JSON.stringify({schemaVersion:1,artifactOnly:true,runtimeTested:false,...(aab?{aabSha256:createHash("sha256").update(readFileSync(aab)).digest("hex")}:{}),apkSha256:createHash("sha256").update(readFileSync(apk)).digest("hex"),zipAlignment16KB:true,libraries},null,2)+"\n");
  console.log(`PASS Android 16 KB artifact audit: ${libraries.length} libraries; APK ZIP alignment verified. Runtime remains separate.`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
