export function mobileThumbnailUrl(request:Request,sourceUrl:string,width=640,quality=72){
 try{
  const origin=new URL(request.url).origin;
  const url=new URL("/_next/image",origin);
  url.searchParams.set("url",sourceUrl);
  url.searchParams.set("w",String(width));
  url.searchParams.set("q",String(quality));
  return url.toString();
 }catch{
  return sourceUrl;
 }
}
