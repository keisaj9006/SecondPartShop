export type AuthErrorContext = "signin" | "signup" | "resend-confirmation" | "password-reset" | "update-password";

export type AuthProviderError = {
 status?: number;
 code?: string;
 message?: string;
};

const genericMessages:Record<AuthErrorContext,string>={
 signin:"We could not sign you in right now. Please try again.",
 signup:"We could not create your account right now. Please try again.",
 "resend-confirmation":"We could not request a confirmation email right now. Please try again shortly.",
 "password-reset":"We could not request a password reset right now. Please try again.",
 "update-password":"We could not update your password right now. Please try again."
};

function normalizedError(error:AuthProviderError){
 return {
  status:typeof error?.status==="number"?error.status:undefined,
  code:typeof error?.code==="string"?error.code.toLowerCase():"",
  message:typeof error?.message==="string"?error.message.toLowerCase():""
 };
}

export function isDuplicateSignupError(error:AuthProviderError):boolean{
 const value=normalizedError(error);
 return value.code==="user_already_exists"||value.code==="email_exists"||/user already registered|user already exists|email already registered|email already exists/.test(value.message);
}

export function authErrorMessage(error:AuthProviderError,context:AuthErrorContext):string{
 const value=normalizedError(error);
 const rateLimited=value.status===429||/rate.?limit|too_many_requests/.test(`${value.code} ${value.message}`);
 if(rateLimited){
  if(context==="resend-confirmation")return "Please wait before requesting another email, then try again.";
  if(context==="password-reset")return "Please wait before requesting another reset email, then try again.";
  if(context==="signup")return "Please wait a little before trying to create your account again.";
  if(context==="signin")return "Too many sign-in attempts. Please wait a moment and try again.";
  return "Please wait a moment before trying to update your password again.";
 }
 if(context==="signin"&&(value.code==="invalid_credentials"||value.code==="invalid_login_credentials"||/invalid login credentials/.test(value.message))){
  return "Your email or password is incorrect. Check them and try again.";
 }
 if(context==="signup")return genericMessages.signup;
 if(context==="resend-confirmation")return genericMessages[context];
 if(context==="password-reset")return genericMessages[context];
 if(context==="update-password"&&(value.code==="session_not_found"||value.code==="otp_expired"||value.code==="invalid_grant")){
  return "This reset session has expired. Request a new password reset link.";
 }
 return genericMessages[context];
}
