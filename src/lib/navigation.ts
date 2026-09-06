export function safeInternalPath(value:unknown,fallback="/"){
 const candidate=typeof value==="string"?value.trim():"";
 if(!candidate.startsWith("/"))return fallback;
 try{
  const base="https://secondpart.invalid";
  const parsed=new URL(candidate,base);
  if(parsed.origin!==base)return fallback;
  return parsed.pathname+parsed.search+parsed.hash;
 }catch{
  return fallback;
 }
}
