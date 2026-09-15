import {createHash,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime="nodejs";

const TOKEN_DIGEST="5226130fc56a12dd5396a47b6552c263a203fea8f7d65197adeaedbc3365194c";
const QA_SELLER_NAME="SecondPart QA Seller";
const QA_BUYER_NAME="SecondPart QA Buyer";
type Operation="login-seller"|"login-buyer";
type AdminClient=ReturnType<typeof createSupabaseAdminClient>;

function tokenMatches(candidate:string){
 const expected=Buffer.from(TOKEN_DIGEST,"hex");
 const actual=createHash("sha256").update(candidate).digest();
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

function redirectTo(request:Request,path:string){
 return NextResponse.redirect(new URL(path,request.url),303);
}

async function findQaActorId(admin:AdminClient,target:"seller"|"buyer"){
 if(target==="seller"){
  const {data,error}=await admin.from("sellers").select("owner_id,business_name,account_deleted_at").eq("business_name",QA_SELLER_NAME).is("account_deleted_at",null).maybeSingle();
  if(error||!data?.owner_id)throw new Error("QA seller fixture is unavailable.");
  return data.owner_id;
 }
 const {data,error}=await admin.from("profiles").select("id,display_name").eq("display_name",QA_BUYER_NAME).maybeSingle();
 if(error||!data?.id)throw new Error("QA buyer fixture is unavailable.");
 return data.id;
}

async function signInQaActor(request:Request,admin:AdminClient,userId:string,nextPath:string){
 const {data:userData,error:userError}=await admin.auth.admin.getUserById(userId);
 const email=userData.user?.email;
 if(userError||!email)throw new Error("QA Auth identity is unavailable.");
 const {data:linkData,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email});
 const tokenHash=linkData?.properties?.hashed_token;
 if(linkError||!tokenHash)throw new Error("QA Auth link could not be generated.");
 const sessionClient=await createSupabaseServerClient();
 const {error:verifyError}=await sessionClient.auth.verifyOtp({token_hash:tokenHash,type:"magiclink"});
 if(verifyError)throw new Error("QA Auth session could not be established.");
 return redirectTo(request,nextPath);
}

export async function POST(request:Request){
 if(process.env.VERCEL_ENV!=="preview")return new NextResponse("Not found",{status:404});
 const formData=await request.formData();
 const token=String(formData.get("token")??"");
 if(!tokenMatches(token))return new NextResponse("Forbidden",{status:403});
 const operation=String(formData.get("operation")??"") as Operation;
 const admin=createSupabaseAdminClient();
 try{
  if(operation==="login-seller")return signInQaActor(request,admin,await findQaActorId(admin,"seller"),"/dashboard");
  if(operation==="login-buyer")return signInQaActor(request,admin,await findQaActorId(admin,"buyer"),"/account/orders");
  return new NextResponse("Unsupported operation",{status:400});
 }catch(error){
  const message=error instanceof Error?error.message:"QA actor switch failed.";
  return new NextResponse(message,{status:409});
 }
}
