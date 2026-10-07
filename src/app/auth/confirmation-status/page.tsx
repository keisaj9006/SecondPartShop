import {Header} from "@/components/header";
import {AuthConfirmationStatus,safeConfirmationReturnTo,type AuthConfirmationState} from "@/components/auth-confirmation-status";
import {getCurrentUserState} from "@/lib/auth";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const states:AuthConfirmationState[]=["confirmed","invalid","already-confirmed"];

export default async function ConfirmationStatusPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const requested=first(query.state);
 let state:AuthConfirmationState="invalid";
 if(states.includes(requested as AuthConfirmationState)){
  const authState=await getCurrentUserState();
  if(authState.kind==="authenticated"&&authState.user.email_confirmed_at){
   state=requested as AuthConfirmationState;
  }
 }
 const returnTo=safeConfirmationReturnTo(first(query.returnTo));
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><AuthConfirmationStatus state={state} returnTo={returnTo}/></main></>;
}
