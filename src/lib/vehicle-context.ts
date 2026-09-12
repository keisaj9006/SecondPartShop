export const VEHICLE_CONTEXT_STORAGE_KEY="secondpart.web.vehicle-context.v1";
export const VEHICLE_CONTEXT_PARAMS=["cv","cy","cf","ce","vr","vc","fit"] as const;

export function clearStoredVehicleContext(storage?:Pick<Storage,"removeItem">){
 try{
  const resolvedStorage=storage??(typeof window==="undefined"?undefined:window.localStorage);
  resolvedStorage?.removeItem(VEHICLE_CONTEXT_STORAGE_KEY);
 }catch{}
}
