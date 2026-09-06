import { CarFront } from "lucide-react";

const colours:Record<string,string>={
  black:"#171717",
  blue:"#2563eb",
  brown:"#795548",
  beige:"#d6c7a1",
  cream:"#f3ead3",
  gold:"#c8a64b",
  green:"#2f7d4a",
  grey:"#6b7280",
  gray:"#6b7280",
  maroon:"#7f1d1d",
  orange:"#ea580c",
  pink:"#db6b9a",
  purple:"#7c3aed",
  red:"#dc2626",
  silver:"#a8b0b8",
  white:"#f8fafc",
  yellow:"#eab308"
};

const vehicleColour=(value:string|null|undefined)=>{
  if(!value)return "#94a3b8";
  const key=value.trim().toLowerCase();
  return colours[key]??"#94a3b8";
};

export function VehicleVisual({
  make,
  model,
  year,
  colour,
  compact=false
}:{
  make:string;
  model:string;
  year:number;
  colour?:string|null;
  compact?:boolean;
}){
  const fill=vehicleColour(colour);
  return <div className={`overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-b from-[#eef3f0] to-white ${compact?"p-3":"p-5"}`}>
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#63706a]"><CarFront size={13}/>Representative vehicle preview</span>
      {colour&&<span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-black uppercase">{colour}</span>}
    </div>
    <svg viewBox="0 0 420 190" role="img" aria-label={`Representative ${colour??""} ${make} ${model} ${year}`} className={`mx-auto w-full ${compact?"mt-1 max-h-24":"mt-2 max-h-40"}`}>
      <ellipse cx="210" cy="157" rx="154" ry="13" fill="rgba(15,23,42,.08)"/>
      <path d="M76 128c5-18 15-33 31-45l44-34c10-8 21-12 34-12h63c15 0 29 5 40 15l40 36 31 8c16 4 25 14 27 30l2 15H52l3-8c4-12 10-20 21-25Z" fill={fill} stroke="#17221f" strokeWidth="4" strokeLinejoin="round"/>
      <path d="m159 55-37 31h177l-31-29c-7-6-15-9-25-9h-57c-10 0-19 2-27 7Z" fill="#dbe7e5" stroke="#17221f" strokeWidth="3"/>
      <path d="M208 48v38M119 87h182" stroke="#17221f" strokeWidth="3" opacity=".75"/>
      <path d="M70 116h39M322 116h49" stroke="#f8fafc" strokeWidth="7" strokeLinecap="round"/>
      <circle cx="123" cy="142" r="26" fill="#17221f"/><circle cx="123" cy="142" r="12" fill="#cbd5e1"/>
      <circle cx="315" cy="142" r="26" fill="#17221f"/><circle cx="315" cy="142" r="12" fill="#cbd5e1"/>
      <path d="M177 101h34M242 101h34" stroke="#17221f" strokeWidth="3" strokeLinecap="round" opacity=".55"/>
    </svg>
    {!compact&&<div className="text-center"><p className="text-sm font-black">{make} {model}</p><p className="mt-0.5 text-xs text-[#63706a]">{year}{colour?` · ${colour}`:""}</p></div>}
  </div>;
}
