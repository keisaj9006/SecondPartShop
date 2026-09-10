const simpleEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getPublicSupportEmail(){
 const value=(process.env.NEXT_PUBLIC_SUPPORT_EMAIL??"").trim();
 return simpleEmail.test(value)?value:null;
}
