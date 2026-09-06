(()=>{
"use strict";

const config=window.SecondPartConfig;
const Native=window.SecondPartNative;
if(!config)throw new Error("SecondPart client configuration is missing.");
if(!Native)throw new Error("SecondPart native bridge is missing.");

const SESSION_KEY="mobile_session_v1";
const LEGACY_SESSION_KEY="secondpart.mobile.session.v1";
const state={
 session:null,
 sessionReady:false,
 me:null,
 savedIds:new Set(),
 unreadNotifications:0,
 activeVehicle:null,
 vehicleCompatibleOnly:true,
 currentSearch:"",
 currentView:"home"
};

const escapeHtml=(value)=>String(value??"")
 .replaceAll("&","&amp;")
 .replaceAll("<","&lt;")
 .replaceAll(">","&gt;")
 .replaceAll('"',"&quot;")
 .replaceAll("'","&#039;");

const money=(pence,currency="GBP")=>{
 try{return new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(Number(pence||0)/100);}
 catch{return "£"+(Number(pence||0)/100).toFixed(2);}
};

const dateTime=(value)=>{
 if(!value)return "";
 try{return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
 catch{return String(value);}
};

const dateOnly=(value)=>{
 if(!value)return "";
 try{return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium"}).format(new Date(value));}
 catch{return String(value);}
};

const human=(value)=>String(value??"").replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

const safeHttpUrl=(value)=>{
 try{
  const url=new URL(String(value??""));
  return ["http:","https:"].includes(url.protocol)?url.href:"";
 }catch{return "";}
};

const validSession=(parsed)=>Boolean(
 parsed&&
 typeof parsed==="object"&&
 typeof parsed.accessToken==="string"&&
 typeof parsed.refreshToken==="string"&&
 Number.isFinite(Number(parsed.expiresAt))
);

const loadSession=async()=>{
 try{
  const raw=await Native.storage.get(SESSION_KEY);
  if(raw){
   const parsed=JSON.parse(raw);
   if(validSession(parsed)){state.session=parsed;return parsed;}
  }

  if(Native.isNative){
   const legacy=localStorage.getItem(LEGACY_SESSION_KEY);
   if(legacy){
    try{
     const parsed=JSON.parse(legacy);
     if(validSession(parsed)){
      await Native.storage.set(SESSION_KEY,JSON.stringify(parsed));
      localStorage.removeItem(LEGACY_SESSION_KEY);
      state.session=parsed;
      return parsed;
     }
    }catch{}
    localStorage.removeItem(LEGACY_SESSION_KEY);
   }
  }
 }catch(error){
  console.error("Secure session storage unavailable",error);
 }
 state.session=null;
 return null;
};

const initializeSession=async()=>{
 if(state.sessionReady)return state.session;
 await loadSession();
 state.sessionReady=true;
 return state.session;
};

const storeSession=async(payload)=>{
 if(!payload?.access_token||!payload?.refresh_token)return null;
 const expiresIn=Number(payload.expires_in??3600);
 const session={
  accessToken:payload.access_token,
  refreshToken:payload.refresh_token,
  expiresAt:Date.now()+Math.max(60,expiresIn)*1000
 };
 await Native.storage.set(SESSION_KEY,JSON.stringify(session));
 localStorage.removeItem(LEGACY_SESSION_KEY);
 state.session=session;
 state.sessionReady=true;
 return session;
};

const clearSession=async()=>{
 state.session=null;
 state.sessionReady=true;
 state.me=null;
 state.savedIds=new Set();
 state.unreadNotifications=0;
 localStorage.removeItem(LEGACY_SESSION_KEY);
 try{await Native.storage.remove(SESSION_KEY);}catch(error){console.error("Could not clear secure session storage",error);}
};

const authFetch=async(path,{method="POST",body,accessToken}={})=>{
 const headers={"apikey":config.supabasePublishableKey,"Content-Type":"application/json"};
 if(accessToken)headers.Authorization="Bearer "+accessToken;
 const response=await fetch(config.supabaseUrl+"/auth/v1"+path,{
  method,
  headers,
  body:body===undefined?undefined:JSON.stringify(body),
  cache:"no-store"
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){
  const message=payload?.msg||payload?.message||payload?.error_description||payload?.error||"Authentication request failed.";
  const error=new Error(String(message));
  error.status=response.status;
  throw error;
 }
 return payload;
};

const refreshSession=async()=>{
 if(!state.sessionReady)await initializeSession();
 const current=state.session;
 if(!current?.refreshToken){await clearSession();return null;}
 try{
  const payload=await authFetch("/token?grant_type=refresh_token",{body:{refresh_token:current.refreshToken}});
  return await storeSession(payload);
 }catch{
  await clearSession();
  return null;
 }
};

const accessToken=async()=>{
 if(!state.sessionReady)await initializeSession();
 if(!state.session)return null;
 if(state.session.expiresAt-Date.now()<90000){
  const refreshed=await refreshSession();
  return refreshed?.accessToken??null;
 }
 return state.session.accessToken;
};

const apiUrl=(path)=>{
 const base=config.apiBaseUrl.replace(/\/$/,"");
 const clean=String(path||"").startsWith("/")?String(path):"/"+String(path||"");
 return base+"/api/mobile/"+config.apiVersion+clean;
};

const api=async(path,{method="GET",body,auth=false,retry=true}={})=>{
 const headers={"Accept":"application/json"};
 if(body!==undefined)headers["Content-Type"]="application/json";
 if(auth){
  const token=await accessToken();
  if(!token){
   const error=new Error("Sign in required.");
   error.code="unauthorized";
   error.status=401;
   throw error;
  }
  headers.Authorization="Bearer "+token;
 }

 let response;
 try{
  response=await fetch(apiUrl(path),{
   method,
   headers,
   body:body===undefined?undefined:JSON.stringify(body),
   cache:"no-store"
  });
 }catch{
  const error=new Error("SecondPart could not reach the marketplace. Check your connection.");
  error.code="network";
  throw error;
 }

 if(response.status===401&&auth&&retry){
  const refreshed=await refreshSession();
  if(refreshed)return api(path,{method,body,auth,retry:false});
  const error=new Error("Your session has expired.");
  error.code="unauthorized";
  error.status=401;
  throw error;
 }

 const payload=await response.json().catch(()=>({}));
 if(!response.ok||payload?.ok===false){
  const error=new Error(String(payload?.message||payload?.error||"Request failed."));
  error.code=payload?.error||"request_failed";
  error.status=response.status;
  error.payload=payload;
  throw error;
 }
 return payload;
};

const apiForm=async(path,{method="POST",formData,retry=true}={})=>{
 const token=await accessToken();
 if(!token){
  const error=new Error("Sign in required.");
  error.code="unauthorized";
  error.status=401;
  throw error;
 }
 let response;
 try{
  response=await fetch(apiUrl(path),{
   method,
   headers:{Accept:"application/json",Authorization:"Bearer "+token},
   body:formData,
   cache:"no-store"
  });
 }catch{
  const error=new Error("SecondPart could not upload the file. Check your connection.");
  error.code="network";
  throw error;
 }
 if(response.status===401&&retry){
  const refreshed=await refreshSession();
  if(refreshed)return apiForm(path,{method,formData,retry:false});
 }
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||payload?.ok===false){
  const error=new Error(String(payload?.message||payload?.error||"Upload failed."));
  error.code=payload?.error||"upload_failed";
  error.status=response.status;
  error.payload=payload;
  throw error;
 }
 return payload;
};

const nativePhotoFile=async(photo,prefix="secondpart")=>{
 if(!photo?.webPath)throw new Error("The selected photo could not be read.");
 const response=await fetch(photo.webPath);
 if(!response.ok)throw new Error("The selected photo could not be read.");
 const blob=await response.blob();
 const format=String(photo.format||"jpeg").toLowerCase().replace("jpg","jpeg");
 const type=blob.type||"image/"+format;
 const extension=type==="image/png"?"png":type==="image/webp"?"webp":"jpg";
 return new File([blob],prefix+"-"+Date.now()+"."+extension,{type});
};

const signIn=async(email,password)=>{
 const payload=await authFetch("/token?grant_type=password",{body:{email:String(email).trim().toLowerCase(),password}});
 await storeSession(payload);
 return payload;
};

const signUp=async({email,password,displayName,role})=>{
 const redirectTo=config.webBaseUrl.replace(/\/$/,"")+"/auth/callback?next="+encodeURIComponent(role==="seller"?"/dashboard":"/account");
 const payload=await authFetch("/signup?redirect_to="+encodeURIComponent(redirectTo),{
  body:{
   email:String(email).trim().toLowerCase(),
   password,
   data:{display_name:String(displayName).trim(),role:role==="seller"?"seller":"buyer"}
  }
 });
 if(payload?.access_token)await storeSession(payload);
 return payload;
};

const signOut=async()=>{
 const current=await accessToken();
 if(current){
  try{await authFetch("/logout",{method:"POST",accessToken:current});}catch{}
 }
 await clearSession();
};

const loadMe=async()=>{
 try{
  const payload=await api("/me",{auth:true});
  state.me=payload;
  return payload;
 }catch(error){
  if(error?.status===401)void clearSession();
  state.me=null;
  return null;
 }
};

const refreshSaved=async()=>{
 if(!state.sessionReady)await initializeSession();
 if(!state.session){state.savedIds=new Set();return [];}
 try{
  const payload=await api("/saved",{auth:true});
  state.savedIds=new Set(payload.ids??[]);
  return payload.items??[];
 }catch{return [];}
};

const refreshNotifications=async()=>{
 if(!state.sessionReady)await initializeSession();
 if(!state.session){state.unreadNotifications=0;return [];}
 try{
  const payload=await api("/notifications",{auth:true});
  state.unreadNotifications=Number(payload.unreadCount??0);
  return payload.items??[];
 }catch{
  state.unreadNotifications=0;
  return [];
 }
};

window.SecondPartCore=Object.freeze({
 config,
 Native,
 state,
 initializeSession,
 api,
 apiForm,
 nativePhotoFile,
 authFetch,
 signIn,
 signUp,
 signOut,
 refreshSession,
 accessToken,
 loadMe,
 refreshSaved,
 refreshNotifications,
 escapeHtml,
 money,
 dateTime,
 dateOnly,
 human,
 safeHttpUrl,
 clearSession
});
})();