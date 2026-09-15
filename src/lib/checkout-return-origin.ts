type CheckoutReturnOriginInput={
 requestOrigin?:string|null;
 canonicalOrigin:string;
 vercelEnv?:string|null;
 vercelUrl?:string|null;
 vercelBranchUrl?:string|null;
};

function httpsOrigin(value:string|undefined|null){
 const raw=value?.trim();
 if(!raw)return null;
 try{
  const parsed=new URL(raw.includes("://")?raw:`https://${raw}`);
  if(parsed.protocol!=="https:")return null;
  return parsed.origin;
 }catch{return null;}
}

export function resolveCheckoutReturnOrigin(input:CheckoutReturnOriginInput){
 const canonical=httpsOrigin(input.canonicalOrigin);
 if(!canonical)throw new Error("Canonical checkout origin must use HTTPS.");
 if(input.vercelEnv!=="preview")return canonical;

 const request=httpsOrigin(input.requestOrigin);
 if(!request)return canonical;
 const allowed=new Set([
  canonical,
  httpsOrigin(input.vercelUrl),
  httpsOrigin(input.vercelBranchUrl)
 ].filter((value):value is string=>Boolean(value)));
 return allowed.has(request)?request:canonical;
}
