export const SUPABASE_AUTH_COOKIE_PRESENT_HEADER="x-secondpart-auth-cookie-present";

export function hasSupabaseAuthCookieName(names:string[],url:string){
 const storageKey=`sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
 return names.some(name=>name===storageKey||name.startsWith(`${storageKey}.`));
}
