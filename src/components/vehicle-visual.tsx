import { CarFront,Info } from "lucide-react";

const colours:Record<string,{body:string;shade:string;highlight:string}>={
 black:{body:"#202325",shade:"#0f1112",highlight:"#4a4f52"},
 blue:{body:"#2563eb",shade:"#1748aa",highlight:"#60a5fa"},
 brown:{body:"#795548",shade:"#53382f",highlight:"#a57a69"},
 beige:{body:"#d6c7a1",shade:"#aa9b78",highlight:"#eee5cf"},
 cream:{body:"#f3ead3",shade:"#c9bea4",highlight:"#fffaf0"},
 gold:{body:"#c8a64b",shade:"#96782c",highlight:"#ead47f"},
 green:{body:"#2f7d4a",shade:"#1f5a34",highlight:"#66a879"},
 grey:{body:"#6b7280",shade:"#4b515c",highlight:"#9ca3af"},
 gray:{body:"#6b7280",shade:"#4b515c",highlight:"#9ca3af"},
 maroon:{body:"#7f1d1d",shade:"#561313",highlight:"#a94a4a"},
 orange:{body:"#ea580c",shade:"#a83d07",highlight:"#fb923c"},
 pink:{body:"#db6b9a",shade:"#a54970",highlight:"#efa2c0"},
 purple:{body:"#7c3aed",shade:"#5824b4",highlight:"#a78bfa"},
 red:{body:"#dc2626",shade:"#991b1b",highlight:"#f87171"},
 silver:{body:"#a8b0b8",shade:"#747e87",highlight:"#d8dde1"},
 white:{body:"#f8fafc",shade:"#cbd5e1",highlight:"#ffffff"},
 yellow:{body:"#eab308",shade:"#a87e05",highlight:"#fde047"}
};

const vehicleColour=(value:string|null|undefined)=>{
 const key=value?.trim().toLowerCase()??"";
 return colours[key]??{body:"#94a3b8",shade:"#64748b",highlight:"#cbd5e1"};
};

const readable=(value:string|null|undefined)=>value?.trim()||null;

export function VehicleVisual({
 make,
 model,
 year,
 colour,
 variant,
 registration,
 engine,
 fuel,
 compact=false
}:{
 make:string;
 model:string;
 year:number;
 colour?:string|null;
 variant?:string|null;
 registration?:string|null;
 engine?:string|null;
 fuel?:string|null;
 compact?:boolean;
}){
 const paint=vehicleColour(colour);
 const reg=readable(registration)?.toUpperCase()??null;
 const details=[variant,engine,fuel].filter((value):value is string=>Boolean(readable(value)));

 return <div className={"overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-b from-[#e9f0ed] via-[#f7f8f5] to-white "+(compact?"p-3":"p-5")}>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#63706a]"><CarFront size={13}/>Vehicle preview</span>
   <div className="flex items-center gap-2">
    {colour&&<span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-black uppercase"><span className="h-2.5 w-2.5 rounded-full border border-black/15" style={{backgroundColor:paint.body}}/>{colour}</span>}
    {reg&&<span className="rounded border border-black/20 bg-[#f6df3e] px-2 py-0.5 font-mono text-[10px] font-black tracking-[.08em] text-black">{reg}</span>}
   </div>
  </div>

  <svg viewBox="0 0 520 230" role="img" aria-label={"Representative preview of "+[colour,make,model,String(year)].filter(Boolean).join(" ")} className={"mx-auto w-full "+(compact?"mt-1 max-h-28":"mt-2 max-h-44")}>
   <ellipse cx="258" cy="190" rx="191" ry="18" fill="rgba(15,23,42,.10)"/>
   <path d="M67 148c8-24 22-43 45-55l74-38c15-8 31-12 48-12h75c22 0 42 7 59 21l52 43 42 11c19 5 31 18 34 38l2 17H42l4-10c4-9 11-14 21-15Z" fill={paint.body} stroke="#16211e" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M202 61 142 99h235l-40-34c-10-8-22-12-36-12h-65c-12 0-24 3-34 8Z" fill="#bfd1d4" stroke="#16211e" strokeWidth="3"/>
   <path d="M268 53v46M139 101h243" stroke="#16211e" strokeWidth="3" opacity=".75"/>
   <path d="M104 111c-11 7-20 18-26 34M420 115c22 3 38 11 48 24" stroke={paint.highlight} strokeWidth="4" strokeLinecap="round" opacity=".65"/>
   <path d="M57 143h48" stroke="#f8fafc" strokeWidth="9" strokeLinecap="round"/>
   <path d="M432 143h48" stroke="#f4d44d" strokeWidth="9" strokeLinecap="round"/>
   <path d="M171 113h38M293 113h38" stroke="#16211e" strokeWidth="3" strokeLinecap="round" opacity=".5"/>
   <path d="M109 172c4-30 24-49 53-49s50 19 54 49M350 172c4-30 24-49 53-49s50 19 54 49" fill="none" stroke="#16211e" strokeWidth="5"/>
   <circle cx="162" cy="171" r="31" fill="#171c1b"/><circle cx="162" cy="171" r="17" fill="#9aa4aa"/><circle cx="162" cy="171" r="6" fill="#dce2e5"/>
   <circle cx="403" cy="171" r="31" fill="#171c1b"/><circle cx="403" cy="171" r="17" fill="#9aa4aa"/><circle cx="403" cy="171" r="6" fill="#dce2e5"/>
   {reg&&<g><rect x="238" y="148" width="72" height="19" rx="3" fill="#f6df3e" stroke="#17221f" strokeWidth="1.5"/><text x="274" y="161.5" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="800" fill="#111">{reg.slice(0,8)}</text></g>}
  </svg>

  {!compact&&<div className="text-center">
   <p className="text-base font-black">{make} {model}</p>
   <p className="mt-0.5 text-xs font-bold text-[#56625d]">{year}{variant?" · "+variant:""}{colour?" · "+colour:""}</p>
   {details.length>1&&<p className="mt-1 text-[11px] text-[#7a8580]">{details.slice(1).join(" · ")}</p>}
   <p className="mx-auto mt-3 flex max-w-md items-start justify-center gap-1.5 text-[10px] leading-4 text-[#7a8580]"><Info size={11} className="mt-0.5 shrink-0"/>Representative visual for confirmation only. Body shape, trim and wheels may differ from the exact vehicle.</p>
  </div>}
 </div>;
}
