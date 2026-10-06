export const VEHICLE_CONTEXT_STORAGE_KEY="secondpart.web.vehicle-context.v1";
export const VEHICLE_CONTEXT_PARAMS=["gv","cv","cy","cf","ce","vehicle","vr","vc","fit"] as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VehicleContextSelection=
 |{kind:"garage";garageVehicleId:string;fitOnly:boolean}
 |{kind:"catalogue";variantId:string;year:number;fuel?:string;engine?:number;registration?:string;colour?:string;fitOnly:boolean}
 |{kind:"legacy";vehicleId:string;registration?:string;colour?:string;fitOnly:boolean}
 |{kind:"none"}
 |{kind:"invalid-garage"};

export type StoredVehicleContext={viewerId:string;selection:Exclude<VehicleContextSelection,{kind:"none"|"invalid-garage"}>};
export const EMPTY_VEHICLE_CONTEXT_SNAPSHOT="\u0000empty-vehicle-context";
const vehicleContextListeners=new Set<()=>void>();

const notifyVehicleContextChanged=()=>vehicleContextListeners.forEach(listener=>listener());

export function subscribeVehicleContext(listener:()=>void):()=>void{
 vehicleContextListeners.add(listener);
 const onStorage=(event:StorageEvent)=>{if(event.key===VEHICLE_CONTEXT_STORAGE_KEY||event.key===null)listener();};
 if(typeof window!=="undefined")window.addEventListener("storage",onStorage);
 return ()=>{
  vehicleContextListeners.delete(listener);
  if(typeof window!=="undefined")window.removeEventListener("storage",onStorage);
 };
}

export function getStoredVehicleContextSnapshot():string{
 try{return window.localStorage.getItem(VEHICLE_CONTEXT_STORAGE_KEY)??EMPTY_VEHICLE_CONTEXT_SNAPSHOT;}
 catch{return EMPTY_VEHICLE_CONTEXT_SNAPSHOT;}
}

export function setVehicleContext(params:URLSearchParams,selection:VehicleContextSelection):URLSearchParams{
 const next=new URLSearchParams(params);
 for(const key of VEHICLE_CONTEXT_PARAMS)next.delete(key);
 if(selection.kind==="garage"){
  next.set("gv",selection.garageVehicleId);
  next.set("fit",selection.fitOnly?"1":"0");
 }else if(selection.kind==="catalogue"){
  next.set("cv",selection.variantId);next.set("cy",String(selection.year));
  if(selection.fuel)next.set("cf",selection.fuel);
  if(selection.engine!==undefined)next.set("ce",String(selection.engine));
  if(selection.registration)next.set("vr",selection.registration);
  if(selection.colour)next.set("vc",selection.colour);
  next.set("fit",selection.fitOnly?"1":"0");
 }else if(selection.kind==="legacy"){
  next.set("vehicle",selection.vehicleId);
  if(selection.registration)next.set("vr",selection.registration);
  if(selection.colour)next.set("vc",selection.colour);
  next.set("fit",selection.fitOnly?"1":"0");
 }
 return next;
}

const validYear=(value:string|null)=>{
 if(!value||!/^\d{4}$/.test(value))return undefined;
 const year=Number(value);
 return year>=1886&&year<=new Date().getUTCFullYear()+1?year:undefined;
};
const validEngine=(value:string|null)=>{
 if(value===null)return undefined;
 if(!/^\d{1,5}$/.test(value))return null;
 const engine=Number(value);
 return Number.isFinite(engine)&&engine>0?engine:null;
};
const fitOnly=(params:URLSearchParams)=>params.get("fit")!=="0";

function parseStoredSelection(value:unknown):StoredVehicleContext["selection"]|null{
 if(!value||typeof value!=="object")return null;
 const item=value as Record<string,unknown>;
 if(item.kind==="garage"&&typeof item.garageVehicleId==="string"&&UUID.test(item.garageVehicleId))return {kind:"garage",garageVehicleId:item.garageVehicleId,fitOnly:item.fitOnly!==false};
 if(item.kind==="catalogue"&&typeof item.variantId==="string"&&UUID.test(item.variantId)&&Number.isInteger(item.year)&&Number(item.year)>=1886&&Number(item.year)<=new Date().getUTCFullYear()+1){
  return {kind:"catalogue",variantId:item.variantId,year:Number(item.year),...(typeof item.fuel==="string"?{fuel:item.fuel}:{}),...(typeof item.engine==="number"&&Number.isFinite(item.engine)?{engine:item.engine}:{}),...(typeof item.registration==="string"?{registration:item.registration}:{}),...(typeof item.colour==="string"?{colour:item.colour}:{}),fitOnly:item.fitOnly!==false};
 }
 if(item.kind==="legacy"&&typeof item.vehicleId==="string"&&item.vehicleId.length>0)return {kind:"legacy",vehicleId:item.vehicleId,...(typeof item.registration==="string"?{registration:item.registration}:{}),...(typeof item.colour==="string"?{colour:item.colour}:{}),fitOnly:item.fitOnly!==false};
 return null;
}

export function readStoredVehicleContext(raw:string|null,viewerId:string|null):StoredVehicleContext|null{
 if(!raw||!viewerId)return null;
 try{
  const parsed=JSON.parse(raw) as Record<string,unknown>;
  if(parsed.viewerId!==viewerId)return null;
  const selection=parseStoredSelection(parsed.selection);
  return selection?{viewerId,selection}:null;
 }catch{return null;}
}

export function resolveVehicleContext(params:URLSearchParams,options:{viewerId:string|null;stored?:StoredVehicleContext|null;garageValid?:boolean;addVehicleMode?:boolean}):{params:URLSearchParams;selection:VehicleContextSelection;source:"url"|"storage"|"none";clearStored:boolean;needsReplace:boolean}{
 const current=new URLSearchParams(params);
 const hasGarage=current.has("gv");
 const hasCatalogue=current.has("cv")||current.has("cy")||current.has("cf")||current.has("ce");
 const hasLegacy=current.has("vehicle");
 const explicit=hasGarage||hasCatalogue||hasLegacy;
 let selection:VehicleContextSelection={kind:"none"};
 let source:"url"|"storage"|"none"="none";
 let clearStored=false;
 if(options.addVehicleMode){
  const normalized=setVehicleContext(current,{kind:"none"});
  return {params:normalized,selection,source,clearStored:false,needsReplace:normalized.toString()!==current.toString()};
 }
 if(hasGarage){
  source="url";
  const id=current.get("gv")??"";
  if(!UUID.test(id)||(options.garageValid===false)){
   selection={kind:"invalid-garage"};clearStored=true;
  }else selection={kind:"garage",garageVehicleId:id,fitOnly:fitOnly(current)};
 }else if(hasCatalogue){
  source="url";
  const variantId=current.get("cv")??"";
  const year=validYear(current.get("cy"));
  const engine=validEngine(current.get("ce"));
  if(UUID.test(variantId)&&year!==undefined&&engine!==null){
   selection={kind:"catalogue",variantId,year,...(current.get("cf")?{fuel:current.get("cf")!}:{}),...(engine!==undefined?{engine}:{}),...(current.get("vr")?{registration:current.get("vr")!}:{}),...(current.get("vc")?{colour:current.get("vc")!}:{}),fitOnly:fitOnly(current)};
  }
  clearStored=true;
 }else if(hasLegacy){
  source="url";
  const vehicleId=current.get("vehicle")??"";
  if(vehicleId)selection={kind:"legacy",vehicleId,...(current.get("vr")?{registration:current.get("vr")!}:{}),...(current.get("vc")?{colour:current.get("vc")!}:{}),fitOnly:fitOnly(current)};
  clearStored=true;
 }else if(explicit){
  source="url";clearStored=true;
 }
 if(source==="none"&&options.viewerId&&options.stored?.viewerId===options.viewerId&&!options.addVehicleMode){
  selection=options.stored.selection;source="storage";
 }
 const normalized=setVehicleContext(current,selection);
 return {params:normalized,selection,source,clearStored,needsReplace:normalized.toString()!==current.toString()};
}

export function clearStoredVehicleContext(storage?:Pick<Storage,"removeItem">){
 try{
  const resolvedStorage=storage??(typeof window==="undefined"?undefined:window.localStorage);
  if(!resolvedStorage)return;
  resolvedStorage.removeItem(VEHICLE_CONTEXT_STORAGE_KEY);
  notifyVehicleContextChanged();
 }catch{}
}

export function writeStoredVehicleContext(viewerId:string,selection:StoredVehicleContext["selection"],storage?:Pick<Storage,"setItem">):boolean{
 if(!viewerId)return false;
 try{
  const resolvedStorage=storage??(typeof window==="undefined"?undefined:window.localStorage);
  if(!resolvedStorage)return false;
  resolvedStorage.setItem(VEHICLE_CONTEXT_STORAGE_KEY,JSON.stringify({viewerId,selection} satisfies StoredVehicleContext));
  notifyVehicleContextChanged();
  return true;
 }catch{return false;}
}

export function setVehicleContextFit(params:URLSearchParams,fitOnlyValue:boolean):URLSearchParams{
 const resolved=resolveVehicleContext(params,{viewerId:null});
 const selection=resolved.selection.kind==="garage"||resolved.selection.kind==="catalogue"||resolved.selection.kind==="legacy"
  ?{...resolved.selection,fitOnly:fitOnlyValue}
  :{kind:"none" as const};
 return setVehicleContext(resolved.params,selection);
}

export function clearStoredGarageVehicleSelection(viewerId:string,garageVehicleId:string,storage?:Pick<Storage,"getItem"|"removeItem">):boolean{
 try{
  const resolvedStorage=storage??(typeof window==="undefined"?undefined:window.localStorage);
  const stored=readStoredVehicleContext(resolvedStorage?.getItem(VEHICLE_CONTEXT_STORAGE_KEY)??null,viewerId);
  if(stored?.selection.kind!=="garage"||stored.selection.garageVehicleId!==garageVehicleId)return false;
  resolvedStorage?.removeItem(VEHICLE_CONTEXT_STORAGE_KEY);
  notifyVehicleContextChanged();
  return Boolean(resolvedStorage);
 }catch{return false;}
}
