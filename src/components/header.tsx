import { cookies } from "next/headers";
import { getCurrentProfile,getCurrentUser } from "@/lib/auth";
import { getCategories } from "@/lib/data/marketplace";
import { HeaderShell } from "@/components/header-shell";

export async function Header(){
 const cookieStore=await cookies();
 if(cookieStore.get("secondpart_native")?.value==="1")return null;
 const [user,profile,categories]=await Promise.all([getCurrentUser(),getCurrentProfile(),getCategories()]);
 const seller=Boolean(profile&&(["seller","admin"] as string[]).includes(profile.role));
 return <HeaderShell categories={categories} user={Boolean(user)} displayName={profile?.displayName??null} seller={seller}/>;
}
