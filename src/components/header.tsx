import { getCurrentProfile,getCurrentUser } from "@/lib/auth";
import { getCategories } from "@/lib/data/marketplace";
import { HeaderShell } from "@/components/header-shell";

export async function Header(){
 const [user,profile,categories]=await Promise.all([getCurrentUser(),getCurrentProfile(),getCategories()]);
 const seller=Boolean(profile&&(["seller","admin"] as string[]).includes(profile.role));
 return <HeaderShell categories={categories} user={Boolean(user)} displayName={profile?.displayName??null} seller={seller}/>;
}
