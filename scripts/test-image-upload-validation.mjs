import assert from "node:assert/strict";
import {File} from "node:buffer";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";

const exports={};
const code=ts.transpileModule(fs.readFileSync("src/lib/image-upload.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
vm.runInNewContext(code,{exports,Buffer,require(name){if(name==="server-only")return {};if(name==="sharp")return sharp;throw Error(name);}});
const validate=exports.validateImageUpload;

for(const [mime,bytes] of [
 ["image/jpeg",[0xff,0xd8,0xff]],
 ["image/png",[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]],
 ["image/webp",[...Buffer.from("RIFF"),0,0,0,0,...Buffer.from("WEBP")]]
])test(`signature-only ${mime} is rejected instead of being stored as an image`,async()=>{
 await assert.rejects(validate(new File([new Uint8Array(bytes)],"broken-photo",{type:mime})),/valid.*image/i);
});

for(const [format,mime] of [["jpeg","image/jpeg"],["png","image/png"],["webp","image/webp"]])
 test(`real ${format} pixels are accepted regardless of filename extension`,async()=>{
  const bytes=await sharp({create:{width:2,height:3,channels:3,background:"white"}}).toFormat(format).toBuffer();
  const result=await validate(new File([bytes],"misleading.txt",{type:mime}));
  assert.equal(result.mimeType,mime);
  assert.equal(result.extension,format==="jpeg"?"jpg":format);
 });

test("truncated real JPEG pixel data is rejected with a safe error",async()=>{
 const bytes=await sharp({create:{width:10,height:10,channels:3,background:"white"}}).jpeg().toBuffer();
 await assert.rejects(validate(new File([bytes.subarray(0,Math.floor(bytes.length/2))],"truncated.jpg",{type:"image/jpeg"})),/valid.*image/i);
});

test("MIME spoofing and an empty image remain rejected",async()=>{
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).jpeg().toBuffer();
 await assert.rejects(validate(new File([bytes],"fake.png",{type:"image/png"})),/valid.*image/i);
 await assert.rejects(validate(new File([],"empty.png",{type:"image/png"})),/non-empty/i);
});

test("a tiny PNG declaring enormous dimensions is rejected before decompression",async()=>{
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).png().toBuffer();
 bytes.writeUInt32BE(50000,16);
 bytes.writeUInt32BE(50000,20);
 // Recompute IHDR CRC so rejection is about dimensions, not a broken header.
 let crc=0xffffffff;
 for(const byte of bytes.subarray(12,29)){
  crc^=byte;
  for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 bytes.writeUInt32BE((crc^0xffffffff)>>>0,29);
 await assert.rejects(validate(new File([bytes],"huge.png",{type:"image/png"})),/50 megapixel/);
});

test("valid JPEG metadata does not conceal truncated pixel data",async()=>{
 const bytes=await sharp({create:{width:200,height:200,channels:3,background:"white"}}).jpeg().toBuffer();
 const truncated=bytes.subarray(0,bytes.length-20);
 assert.equal((await sharp(truncated).metadata()).width,200);
 await assert.rejects(validate(new File([truncated],"truncated-pixels.jpg",{type:"image/jpeg"})),/valid.*image/i);
});

test("all animated WebP frames are decoded, while valid animation remains accepted",async()=>{
 const chunk=(tag,data)=>{
  const header=Buffer.alloc(8);header.write(tag);header.writeUInt32LE(data.length,4);
  return Buffer.concat([header,data,Buffer.alloc(data.length%2)]);
 };
 const frames=[];
 for(const color of ["white","red"]){
  const image=await sharp({create:{width:100,height:100,channels:3,background:color}}).webp().toBuffer();
  const header=Buffer.alloc(16);header.writeUIntLE(99,6,3);header.writeUIntLE(99,9,3);header.writeUIntLE(100,12,3);
  frames.push(chunk("ANMF",Buffer.concat([header,image.subarray(12)])));
 }
 const extended=Buffer.alloc(10);extended[0]=2;extended.writeUIntLE(99,4,3);extended.writeUIntLE(99,7,3);
 const body=Buffer.concat([Buffer.from("WEBP"),chunk("VP8X",extended),chunk("ANIM",Buffer.alloc(6)),...frames]);
 const header=Buffer.alloc(8);header.write("RIFF");header.writeUInt32LE(body.length,4);
 const bytes=Buffer.concat([header,body]);
 assert.equal((await validate(new File([bytes],"animated.webp",{type:"image/webp"}))).extension,"webp");
 const first=bytes.indexOf(Buffer.from("ANMF"));
 const second=bytes.indexOf(Buffer.from("ANMF"),first+4);
 bytes.fill(255,second+8+16+8+10);
 // Its first frame still decodes: only checking page 1 would miss the damage.
 await sharp(bytes,{pages:1,failOn:"warning"}).stats();
 await assert.rejects(validate(new File([bytes],"corrupt-animation.webp",{type:"image/webp"})),/valid.*image/i);
});
