import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const env=read(".env.example");
const helper=read("src/lib/public-contact.ts");
const contact=read("src/app/contact/page.tsx");
const privacy=read("src/app/privacy/page.tsx");

const checks=[
 ["Public support email must be an explicit production environment input",env.includes("NEXT_PUBLIC_SUPPORT_EMAIL=")],
 ["Public support email must be validated before rendering",helper.includes("simpleEmail")&&helper.includes("NEXT_PUBLIC_SUPPORT_EMAIL")&&helper.includes("return simpleEmail.test(value)?value:null")],
 ["Contact page must expose configured support email without requiring auth",contact.includes("getPublicSupportEmail")&&contact.includes("Public support email")&&contact.includes("mailto:${supportEmail}")],
 ["Account-linked support form must remain separate from public email",contact.includes("Account-linked support request")&&contact.includes("SupportRequestForm")&&contact.includes("Sign in")],
 ["Privacy policy must expose the same configured public contact",privacy.includes("getPublicSupportEmail")&&privacy.includes("Public privacy/support email")&&privacy.includes("mailto:${supportEmail}")],
 ["Privacy policy must fail visibly when production contact is not configured",privacy.includes("must be configured in the Production environment before publication")],
 ["Public contact copy must warn against sending secrets",contact.includes("Do not send passwords, payment card details or API keys")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} public contact invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart public support contact baseline passed.");
