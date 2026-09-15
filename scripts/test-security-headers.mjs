import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

async function loadConfig({ vercelEnv, nodeEnv = "production", supabaseUrl = "https://abc.supabase.co" }) {
  const source = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const tempDirectory = await mkdtemp(join(tmpdir(), "secondpart-security-headers-"));
  const modulePath = join(tempDirectory, "next-config.mjs");
  await writeFile(modulePath, compiled, "utf8");

  const previous = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };

  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
  process.env.NODE_ENV = nodeEnv;
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;

  try {
    const imported = await import(`${pathToFileURL(modulePath).href}?env=${encodeURIComponent(vercelEnv ?? "local")}-${Date.now()}-${Math.random()}`);
    return imported.default;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function headerMap(config) {
  assert.equal(typeof config.headers, "function", "next.config.ts must define a central headers() policy");
  const entries = await config.headers();
  const global = entries.find((entry) => entry.source === "/:path*");
  assert.ok(global, "security headers must apply to every route through /:path*");
  return new Map(global.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

function assertBaseHeaders(headers) {
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("permissions-policy"), "camera=(self), geolocation=(self), microphone=()");
}

function assertDirective(csp, directive) {
  assert.ok(csp.split(";").map((value) => value.trim()).includes(directive), `missing CSP directive: ${directive}`);
}

test("production security policy is restrictive and allows only the app plus configured Supabase browser traffic", async () => {
  const config = await loadConfig({ vercelEnv: "production" });
  const headers = await headerMap(config);
  assertBaseHeaders(headers);

  const csp = headers.get("content-security-policy");
  assert.ok(csp, "Content-Security-Policy header is required");
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://abc.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "frame-src 'none'",
  ]) assertDirective(csp, directive);

  assert.ok(!csp.includes("'unsafe-eval'"), "production must not enable unsafe-eval");
  assert.ok(!csp.includes("vercel.live"), "production must not inherit Preview toolbar exceptions");
  assert.ok(!csp.includes("stripe.com"), "server-side Stripe redirects do not require Stripe domains in browser CSP");
  assert.ok(!/(^|\s)\*(\s|;|$)/.test(csp), "CSP must not use a blanket wildcard source");
});

test("Preview adds only the documented Vercel Toolbar exceptions", async () => {
  const config = await loadConfig({ vercelEnv: "preview" });
  const headers = await headerMap(config);
  assertBaseHeaders(headers);
  const csp = headers.get("content-security-policy");

  assertDirective(csp, "script-src 'self' 'unsafe-inline' https://vercel.live");
  assertDirective(csp, "style-src 'self' 'unsafe-inline' https://vercel.live");
  assertDirective(csp, "img-src 'self' data: blob: https://abc.supabase.co https://vercel.live https://vercel.com");
  assertDirective(csp, "font-src 'self' data: https://vercel.live https://assets.vercel.com");
  assertDirective(csp, "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co https://vercel.live wss://ws-us3.pusher.com");
  assertDirective(csp, "frame-src https://vercel.live");
  assert.ok(!csp.includes("'unsafe-eval'"), "Preview must not enable unsafe-eval");
});

test("local development alone may use unsafe-eval for the Next.js development runtime", async () => {
  const config = await loadConfig({ vercelEnv: undefined, nodeEnv: "development" });
  const headers = await headerMap(config);
  const csp = headers.get("content-security-policy");
  assert.ok(csp.includes("script-src 'self' 'unsafe-inline' 'unsafe-eval'"));
  assert.ok(!csp.includes("vercel.live"));
});
