import "server-only";
import sharp from "sharp";

const MAX_IMAGE_BYTES=5*1024*1024;
// Includes typical 48 MP camera photos, but bounds decompression of tiny files.
const MAX_IMAGE_PIXELS=50_000_000;

const MIME_EXTENSION={
 "image/jpeg":"jpg",
 "image/png":"png",
 "image/webp":"webp"
} as const;

type SupportedImageMime=keyof typeof MIME_EXTENSION;

const startsWith=(bytes:Uint8Array,signature:number[])=>signature.every((value,index)=>bytes[index]===value);
const ascii=(bytes:Uint8Array,start:number,length:number)=>String.fromCharCode(...bytes.slice(start,start+length));

export type ValidatedImageUpload={
 extension:"jpg"|"png"|"webp";
 mimeType:SupportedImageMime;
};

export async function validateImageUpload(file:File):Promise<ValidatedImageUpload>{
 if(file.size<=0)throw new Error("Choose a non-empty image file.");
 if(file.size>MAX_IMAGE_BYTES)throw new Error("Each image must be 5 MB or smaller.");

 const mime=file.type as SupportedImageMime;
 const extension=MIME_EXTENSION[mime];
 if(!extension)throw new Error("Use JPG, PNG or WebP images.");

 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const matches=
  mime==="image/jpeg"
   ?startsWith(bytes,[0xff,0xd8,0xff])
   :mime==="image/png"
    ?startsWith(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
    :ascii(bytes,0,4)==="RIFF"&&ascii(bytes,8,4)==="WEBP";

 if(!matches)throw new Error("The selected file does not contain a valid "+(mime==="image/jpeg"?"JPG":mime==="image/png"?"PNG":"WebP")+" image.");

 const input=Buffer.from(await file.arrayBuffer());
 const image=sharp(input,{failOn:"warning",limitInputPixels:MAX_IMAGE_PIXELS,pages:-1});
 try{
  const metadata=await image.metadata();
  if(!metadata.width||!metadata.height||metadata.width*metadata.height>MAX_IMAGE_PIXELS){
   throw new Error("Image dimensions exceed the supported limit.");
  }
  // Metadata alone can accept an image whose pixel stream is truncated.
  // stats decodes that stream without creating a second encoded upload.
  await image.stats();
 }catch{
  throw new Error("The selected file does not contain a valid image within the 50 megapixel limit. Choose a smaller, undamaged JPG, PNG or WebP photo.");
 }

 return {extension,mimeType:mime};
}
