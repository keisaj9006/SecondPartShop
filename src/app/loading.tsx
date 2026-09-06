export default function Loading(){return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
 <div className="animate-pulse">
  <div className="h-3 w-24 rounded-full bg-[#287154]/20"/>
  <div className="mt-3 h-9 w-64 max-w-[80vw] rounded-xl bg-black/10"/>
  <div className="mt-3 h-4 w-full max-w-xl rounded-lg bg-black/5"/>
  <div className="mt-7 rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
   <div className="h-12 rounded-2xl bg-black/5"/>
   <div className="mt-3 flex gap-2"><div className="h-9 w-32 rounded-full bg-black/5"/><div className="h-9 w-24 rounded-full bg-black/5"/></div>
  </div>
  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i=><div key={i} className="overflow-hidden rounded-3xl border border-black/5 bg-white"><div className="h-44 bg-black/5 sm:h-52"/><div className="p-4"><div className="h-5 w-2/3 rounded bg-black/10"/><div className="mt-3 h-4 w-1/2 rounded bg-black/5"/><div className="mt-6 h-10 rounded-xl bg-black/5"/></div></div>)}</div>
 </div>
</main>}
