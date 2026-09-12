export function safeInternalPath(value:unknown,fallback="/"){
 const candidate=typeof value==="string"?value.trim():"";
 if(!candidate.startsWith("/"))return fallback;
 try{
  const base="https://secondpart.invalid";
  const parsed=new URL(candidate,base);
  if(parsed.origin!==base)return fallback;
  const normalized=parsed.pathname+parsed.search+parsed.hash;
  if(normalized.startsWith("//"))return fallback;
  if(new URL(normalized,base).origin!==base)return fallback;
  return normalized;
 }catch{
  return fallback;
 }
}
