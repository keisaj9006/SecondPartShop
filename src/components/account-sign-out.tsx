"use client";
import {signOut} from "@/app/auth/actions";
const signOutSafely=async()=>{
 const {signOutAfterNativePushWork}=await import("@/lib/native-push");
 await signOutAfterNativePushWork(signOut);
};
export function AccountSignOut({cleanupFailed=false}:{cleanupFailed?:boolean}){
 return <>{cleanupFailed&&<p role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">We could not disable notifications on this device. Check your connection and try signing out again.</p>}<form action={signOutSafely} aria-label="Sign out of SecondPart" className="mt-6"><button type="submit" className="rounded-xl border border-[#173c31]/25 px-4 py-2.5 text-sm font-black">Sign out</button></form></>;
}
