"use client";

import {useTransition} from "react";
import {useRouter} from "next/navigation";

export function AccountDashboardRetry(){
 const router=useRouter();
 const [isPending,startTransition]=useTransition();
 return <div className="mt-2"><button type="button" disabled={isPending} onClick={()=>startTransition(()=>router.refresh())} className="rounded-lg bg-[#173c31] px-3 py-2 text-sm font-bold text-white disabled:opacity-60">{isPending?"Retrying…":"Retry"}</button><span role="status" className="sr-only">{isPending?"Refreshing account data.":""}</span></div>;
}
