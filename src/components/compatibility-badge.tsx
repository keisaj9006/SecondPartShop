import { AlertTriangle,CheckCircle2,CircleHelp } from "lucide-react";
import type { CompatibilityInfo } from "@/lib/types";

export function CompatibilityBadge({info,compact=false}:{info:CompatibilityInfo;compact?:boolean}){
 const config=info.level==="confirmed"
  ?{icon:CheckCircle2,label:compact?"Confirmed fit":info.label,className:"bg-emerald-50 text-emerald-800 border-emerald-200"}
  :info.level==="family_match"
   ?{icon:AlertTriangle,label:compact?"Vehicle family match":info.label,className:"bg-amber-50 text-amber-900 border-amber-200"}
   :{icon:CircleHelp,label:compact?"Compatibility unverified":info.label,className:"bg-slate-50 text-slate-700 border-slate-200"};
 const Icon=config.icon;
 return <span title={info.detail} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-black ${compact?"text-[11px]":"text-xs"} ${config.className}`}><Icon size={compact?13:15}/>{config.label}</span>;
}
