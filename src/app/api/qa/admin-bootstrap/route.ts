import {createHash,randomBytes,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {refundTransactionCase} from "@/lib/commerce-refunds";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime="nodejs";

const TOKEN_DIGEST="5226130fc56a12dd5396a47b6552c263a203fea8f7d65197adeaedbc3365194c";
const QA_ADMIN_NAME="SecondPart QA Admin";
const QA_ADMIN_EMAIL="qa-admin-20260915@example.com";
const QA_SELLER_NAME="SecondPart QA Seller";
const QA_BUYER_NAME="SecondPart QA Buyer";
const QA_REFUND_CASE_ID="e924aa7f-f117-4f30-849b-de611da11bdf";

type Operation="create-admin"|"login-admin"|"login-seller"|"login-buyer"|"retry-refund-e2e"|"cleanup-admin";
type AdminClient=ReturnType<typeof createSupabaseAdminClient>;

function tokenMatches(candidate:string){
 const expected=Buffer.from(TOKEN_DIGEST,"hex");
 const actual=createHash("sha256").update(candidate).digest();
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

function redirectTo(request:Request,path:string){
 return NextResponse.redirect(new URL(path,request.url),303);
}

async function findQaActorId(admin:AdminClient,target:"admin"|"seller"|"buyer"){
 if(target==="seller"){
  const {data,error}=await admin.from("sellers").select("owner_id,business_name,account_deleted_at").eq("business_name",QA_SELLER_NAME).is("account_deleted_at",null).maybeSingle();
  if(error||!data?.owner_id)throw new Error("QA seller fixture is unavailable.");
  return data.owner_id;
 }
 const displayName=target==="admin"?QA_ADMIN_NAME:QA_BUYER_NAME;
 let query=admin.from("profiles").select("id,role,display_name").eq("display_name",displayName);
 if(target==="admin")query=query.eq("role","admin");
 const {data,error}=await query.maybeSingle();
 if(error||!data?.id)throw new Error(`QA ${target} fixture is unavailable.`);
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

async function createQaAdmin(admin:AdminClient){
 const {data:existing,error:existingError}=await admin.from("profiles").select("id,role,display_name").eq("role","admin").limit(1).maybeSingle();
 if(existingError)throw new Error("QA admin preflight failed.");
 if(existing){
  if(existing.display_name!==QA_ADMIN_NAME)throw new Error("A non-QA admin already exists; bootstrap refused.");
  return existing.id;
 }
 const password=randomBytes(32).toString("base64url");
 const {data:created,error:createError}=await admin.auth.admin.createUser({
  email:QA_ADMIN_EMAIL,
  password,
  email_confirm:true,
  user_metadata:{display_name:QA_ADMIN_NAME,role:"buyer"}
 });
 const userId=created.user?.id;
 if(createError||!userId)throw new Error("QA admin Auth identity could not be created.");
 const {data:profile,error:profileError}=await admin.from("profiles").update({role:"admin",display_name:QA_ADMIN_NAME}).eq("id",userId).select("id,role,display_name").maybeSingle();
 if(profileError||profile?.role!=="admin"){
  await admin.auth.admin.deleteUser(userId);
  throw new Error("QA admin profile promotion failed.");
 }
 return userId;
}

async function retryQaRefund(admin:AdminClient){
 const {data,error}=await admin
  .from("transaction_cases")
  .select("id,status,resolution,provider_refund_id")
  .eq("id",QA_REFUND_CASE_ID)
  .eq("status","resolved")
  .eq("resolution","full_refund")
  .maybeSingle();
 if(error||!data?.provider_refund_id)throw new Error("Resolved QA refund fixture is unavailable.");
 const result=await refundTransactionCase(QA_REFUND_CASE_ID);
 if(!result.refunded||result.reason!=="already_refunded")throw new Error("QA refund retry did not remain idempotent.");
}

async function cleanupQaAdmin(admin:AdminClient){
 const {data:profile,error:profileError}=await admin.from("profiles").select("id,role,display_name").eq("role","admin").eq("display_name",QA_ADMIN_NAME).maybeSingle();
 if(profileError||!profile?.id)throw new Error("Dedicated QA admin is unavailable.");
 const {data:userData,error:userError}=await admin.auth.admin.getUserById(profile.id);
 if(userError||userData.user?.email!==QA_ADMIN_EMAIL)throw new Error("Dedicated QA admin identity check failed.");
 const sessionClient=await createSupabaseServerClient();
 await sessionClient.auth.signOut({scope:"local"});
 const {error:deleteError}=await admin.auth.admin.deleteUser(profile.id);
 if(deleteError)throw new Error("Dedicated QA admin cleanup failed.");
}

export async function POST(request:Request){
 if(process.env.VERCEL_ENV!=="preview")return new NextResponse("Not found",{status:404});
 const formData=await request.formData();
 const token=String(formData.get("token")??"");
 if(!tokenMatches(token))return new NextResponse("Forbidden",{status:403});
 const operation=String(formData.get("operation")??"") as Operation;
 const admin=createSupabaseAdminClient();
 try{
  if(operation==="create-admin"){
   const userId=await createQaAdmin(admin);
   return signInQaActor(request,admin,userId,"/admin/commerce/e2e");
  }
  if(operation==="login-admin")return signInQaActor(request,admin,await findQaActorId(admin,"admin"),"/admin/commerce/e2e");
  if(operation==="login-seller")return signInQaActor(request,admin,await findQaActorId(admin,"seller"),"/dashboard");
  if(operation==="login-buyer")return signInQaActor(request,admin,await findQaActorId(admin,"buyer"),"/account/orders");
  if(operation==="retry-refund-e2e"){
   await retryQaRefund(admin);
   return redirectTo(request,"/admin/commerce/e2e?refund_retry=verified");
  }
  if(operation==="cleanup-admin"){
   await cleanupQaAdmin(admin);
   return redirectTo(request,"/");
  }
  return new NextResponse("Unsupported operation",{status:400});
 }catch(error){
  const message=error instanceof Error?error.message:"QA bootstrap failed.";
  return new NextResponse(message,{status:409});
 }
}
