const PACKAGE_NAME="com.secondpart.marketplace";

const fingerprints=()=>String(process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS??"")
 .split(",")
 .map(value=>value.trim().toUpperCase())
 .filter(value=>/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(){
 const values=fingerprints();
 const body=values.length?[{
  relation:["delegate_permission/common.handle_all_urls"],
  target:{
   namespace:"android_app",
   package_name:PACKAGE_NAME,
   sha256_cert_fingerprints:values
  }
 }]:[];
 return Response.json(body,{
  headers:{
   "Cache-Control":"public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
   "X-Content-Type-Options":"nosniff"
  }
 });
}
