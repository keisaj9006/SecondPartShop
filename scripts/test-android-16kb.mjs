import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import {auditElf} from "./verify-android-16kb.mjs";

function elf(segments,{bits=64,endian=1}={}){
 const entrySize=bits===64?56:32, headerSize=bits===64?64:52;
 const data=Buffer.alloc(headerSize+segments.length*entrySize);
 data.set([0x7f,0x45,0x4c,0x46,bits===64?2:1,endian,1]);
 if(bits===64){data.writeBigUInt64LE(BigInt(headerSize),32);data.writeUInt16LE(entrySize,54);data.writeUInt16LE(segments.length,56);}
 else{data.writeUInt32LE(headerSize,28);data.writeUInt16LE(entrySize,42);data.writeUInt16LE(segments.length,44);}
 segments.forEach((segment,index)=>{
  const start=headerSize+index*entrySize;
  data.writeUInt32LE(segment.type??1,start);
  if(bits===64){data.writeUInt32LE(segment.flags??6,start+4);for(const [offset,value] of [[8,segment.offset??0],[16,segment.address??0],[40,segment.size??0x1000],[48,segment.align??0x4000]])data.writeBigUInt64LE(BigInt(value),start+offset);}
  else{for(const [offset,value] of [[4,segment.offset??0],[8,segment.address??0],[20,segment.size??0x1000],[24,segment.flags??6],[28,segment.align??0x4000]])data.writeUInt32LE(value,start+offset);}
 });
 return data;
}
const relro=0x6474e552;
test("64bit LOAD segments require at least 16 KB alignment",()=>assert.throws(()=>auditElf(elf([{align:0x1000}]),"fixture.so"),/LOAD alignment/));
test("32bit ELF layout is parsed independently",()=>assert.equal(auditElf(elf([{address:0x4000,offset:0x4000}],{bits:32})).loadSegments,1));
test("whole writable LOAD RELRO is safe despite nonaligned end",()=>assert.equal(auditElf(elf([{address:0x51c0,offset:0x11c0,size:0x268},{type:relro,address:0x51c0,offset:0x11c0,size:0xe40,align:1}])).relroMode,"entire-load"));
test("unsafe RELRO prefix must end on 16 KB boundary",()=>assert.throws(()=>auditElf(elf([{address:0x4000,size:0x5000},{type:relro,address:0x4000,size:0x1000,align:1}])),/RELRO prefix/));
test("aligned RELRO prefix with writable suffix is accepted",()=>assert.equal(auditElf(elf([{address:0x4000,size:0x5000},{type:relro,address:0x4000,size:0x4000,align:1}])).relroMode,"aligned-prefix"));
test("LOAD segments cannot overlap after 16 KB page rounding",()=>assert.throws(()=>auditElf(elf([{address:0,size:0x5000},{address:0x5100,offset:0x1100,size:0x1000}])),/LOAD pages overlap/));
test("ELF offset and virtual address must be congruent",()=>assert.throws(()=>auditElf(elf([{address:0x4100,offset:0}])),/offset/));
test("missing LOAD and unmatched RELRO fail closed",()=>{assert.throws(()=>auditElf(elf([])),/no LOAD/);assert.throws(()=>auditElf(elf([{address:0x4000},{type:relro,address:0x5000,size:0x1000,align:1}])),/RELRO layout/);});
test("truncated and nonELF input fail closed",()=>{assert.throws(()=>auditElf(Buffer.alloc(10)),/ELF/);assert.throws(()=>auditElf(elf([{address:0x4000}]).subarray(0,80)),/truncated/);});
test("unsupported byte order and malformed table fail closed",()=>{assert.throws(()=>auditElf(elf([{address:0x4000}],{endian:2})),/byte order/);const data=elf([{address:0x4000}]);data.writeUInt16LE(1,54);assert.throws(()=>auditElf(data),/program header/);});
test("multiple RELRO segments fail closed",()=>assert.throws(()=>auditElf(elf([{address:0x4000},{type:relro,address:0x4000,size:0x1000,align:1},{type:relro,address:0x4000,size:0x1000,align:1}])),/multiple RELRO/));

for(const name of ["android-release-check.yml","android-production-aab.yml"]){
 test(`${name} gates the actual bundle before permissions and upload`,()=>{
  const source=readFileSync(new URL(`../.github/workflows/${name}`,import.meta.url),"utf8");
  assert.match(source,/bash scripts\/audit-android-bundle-16kb\.sh android\/app\/build\/outputs\/bundle\/release\/app-release\.aab android-16kb-evidence\.json/);
  assert.ok(source.indexOf("Audit bundle native")<source.indexOf("Verify merged Release permissions"));
 });
}
test("artifact audit pins official bundletool and never reuses real signing credentials",()=>{
 const source=readFileSync(new URL("./audit-android-bundle-16kb.sh",import.meta.url),"utf8");
 assert.match(source,/bundletool\/releases\/download\/1\.18\.3/);
 assert.match(source,/a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29/);
 assert.match(source,/sha256sum --check --status/);
 assert.match(source,/Unsupported native library path/);
 assert.match(source,/entry\.filename\.startswith/);
 assert.match(source,/mktemp -d \/tmp\/secondpart-16kb/);
 assert.match(source,/--ks="\$TASK_DIR\/analysis-only\.p12"/);
 assert.doesNotMatch(source,/ANDROID_RELEASE_STORE_PASSWORD|SECOND_PART_RELEASE_KEYSTORE|secrets\.|upload-artifact/);
});
