"use client";

import { removeGarageVehicle } from "@/app/garage/actions";
import { clearStoredGarageVehicleSelection } from "@/lib/vehicle-context";
import { Trash2 } from "lucide-react";

export function GarageVehicleRemoveForm({garageVehicleId,viewerId,label}:{garageVehicleId:string;viewerId:string;label:string}){
 const action=async(formData:FormData)=>{
  const result=await removeGarageVehicle(formData);
  if(result.ok)clearStoredGarageVehicleSelection(viewerId,garageVehicleId);
 };
 return <form action={action}>
  <input type="hidden" name="id" value={garageVehicleId}/>
  <button aria-label={label} className="rounded-full border border-red-200 p-2 text-red-700 hover:bg-red-50">
   <Trash2 size={17}/>
  </button>
 </form>;
}
