import {Header} from "@/components/header";
import {AuthConfirmationStatus,safeConfirmationReturnTo,type AuthConfirmationState} from "@/components/auth-confirmation-status";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const states:AuthConfirmationState[]=["confirmed","invalid","already-confirmed"];

export default async function ConfirmationStatusPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const requested=first(query.state);
 const state=states.includes(requested as AuthConfirmationState)?requested as AuthConfirmationState:"invalid";
 const returnTo=safeConfirmationReturnTo(first(query.returnTo));
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><AuthConfirmationStatus state={state} returnTo={returnTo}/></main></>;
}
