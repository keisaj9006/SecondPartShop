export type RootTabLoadingVariant="garage"|"purchases"|"inbox"|"account";

const lines=(count:number)=>Array.from({length:count},(_,i)=>i);

export function RootTabLoading({variant}:{variant:RootTabLoadingVariant}){
 const titles={
  garage:"Your garage",
  purchases:"Purchases",
  inbox:"Messages",
  account:"Your account"
 } as const;
 const title=titles[variant];

 return <>
  <p role="status" className="sr-only">Loading {title.toLowerCase()}</p>
  <main aria-busy="true" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
   <div aria-hidden="true" className="animate-pulse">
   <div className="h-3 w-24 rounded-full bg-[#287154]/20"/>
   <div className="mt-3 h-9 w-56 max-w-[75vw] rounded-xl bg-black/10"/>
   <div className="mt-3 h-4 w-72 max-w-[85vw] rounded-lg bg-black/5"/>

   {variant==="account"?<div className="mt-7">
    <div className="h-32 rounded-[28px] bg-[#173c31]/12"/>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {lines(6).map(i=><div key={i} className="h-36 rounded-3xl border border-black/5 bg-white"/>)}
    </div>
   </div>:<div className="mt-7 grid gap-4">
    {lines(variant==="inbox"?5:3).map(i=><div key={i} className="h-28 rounded-3xl border border-black/5 bg-white"/>)}
   </div>}
   </div>
  </main>
 </>;
}
