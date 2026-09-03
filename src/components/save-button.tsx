"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleSavedPart } from "@/app/saved/actions";
export function SaveButton({partId,initialSaved=false,compact=false}:{partId:string;initialSaved?:boolean;compact?:boolean}){const [saved,setSaved]=useState(initialSaved);const [pending,startTransition]=useTransition();const router=useRouter();return <button type="button" disabled={pending} aria-label={saved?"Remove from saved parts":"Save part"} onClick={()=>startTransition(async()=>{const result=await toggleSavedPart(partId);if(result.authRequired){router.push("/account?returnTo=/saved");return;}if(result.ok)setSaved(result.saved);})} className={compact?`rounded-full p-2.5 shadow-sm ${saved?"bg-[#173c31] text-white":"bg-white text-[#173c31]"}`:`flex items-center justify-center gap-2 rounded-xl border border-black/15 px-5 py-3 font-bold ${saved?"bg-[#173c31] text-white":"bg-white"}`}><Heart size={18} fill={saved?"currentColor":"none"}/>{!compact&&(saved?"Saved":"Save part")}</button>}
