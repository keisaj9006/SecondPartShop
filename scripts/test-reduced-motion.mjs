import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");

test("reduced motion disables smooth scrolling, entry movement, and nonessential transitions",()=>{
 const css=fs.readFileSync(path.join(root,"src/app/globals.css"),"utf8");
 const mediaMatch=/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
 const reduced=mediaMatch?.[1]??"";
 assert.match(reduced,/html\s*\{[^}]*scroll-behavior\s*:\s*auto/);
 assert.match(reduced,/\.animate-in\s*\{[^}]*animation\s*:\s*none/);
 assert.match(reduced,/transition-duration\s*:\s*(?:0|\.?0?1ms)/);
 assert.match(reduced,/button:not\(:disabled\):active[^}]*transform\s*:\s*none/);
 const reducedStart=mediaMatch?.index??-1;
 const reducedEnd=reducedStart+(mediaMatch?.[0].length??0);
 const animateRules=[...css.matchAll(/\.animate-in\s*\{([^}]*)\}/g)];
 const reducedRule=animateRules.find(rule=>(rule.index??-1)>=reducedStart&&(rule.index??-1)<reducedEnd);
 const ordinaryRules=animateRules.filter(rule=>(rule.index??-1)<reducedStart||(rule.index??-1)>=reducedEnd);
 const reducedWins=Boolean(reducedRule?.[1].includes("!important")||ordinaryRules.every(rule=>(rule.index??-1)<(reducedRule?.index??-1)));
 assert.equal(reducedWins,true,"the reduced-motion animation rule must win the CSS cascade");
});

test("reduced motion preserves static disclosure orientation and perceivable loading content",()=>{
 const css=fs.readFileSync(path.join(root,"src/app/globals.css"),"utf8");
 const selector=fs.readFileSync(path.join(root,"src/components/vehicle-selector.tsx"),"utf8");
 const reduced=css.match(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{([\s\S]*?)\n\}/)?.[1]??"";
 assert.doesNotMatch(reduced,/rotate-180[^}]*transform\s*:\s*none/);
 assert.match(selector,/rotate-180/);
 assert.match(selector,/Loading available years/);
 assert.match(selector,/role="status"/);
});
