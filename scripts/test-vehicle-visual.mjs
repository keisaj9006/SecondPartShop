import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const Module = require("node:module");

async function loadTypeScriptModule(modulePath, aliasResolver) {
  const source = await readFile(modulePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const transpiledModule = new Module(modulePath);
  transpiledModule.paths = Module._nodeModulePaths(path.dirname(modulePath));
  const defaultRequire = transpiledModule.require.bind(transpiledModule);
  transpiledModule.require = (specifier) => aliasResolver?.(specifier) ?? defaultRequire(specifier);
  transpiledModule._compile(compiled.outputText, modulePath);
  return transpiledModule.exports;
}

const vehicleVisualModule = await loadTypeScriptModule(
  fileURLToPath(new URL("../src/lib/vehicle-visual.ts", import.meta.url)),
);
const { resolveVehicleColour, resolveVehicleVisual } = vehicleVisualModule;

async function loadVehicleVisual() {
  const componentPath = fileURLToPath(new URL("../src/components/vehicle-visual.tsx", import.meta.url));
  const componentModule = await loadTypeScriptModule(
    componentPath,
    (specifier) => specifier === "@/lib/vehicle-visual" ? vehicleVisualModule : undefined,
  );
  return componentModule.VehicleVisual;
}

test("supported structured body metadata takes priority over curated identity", () => {
  assert.deepEqual(
    resolveVehicleVisual({ make: "Honda", model: "Jazz", structuredBodyType: "SUV" }),
    { bodyType: "suv", source: "structured" },
  );
});

test("exact normalized curated identities select representative body shapes", () => {
  assert.deepEqual(resolveVehicleVisual({ make: "RENAULT", model: "Trafic" }), {
    bodyType: "van",
    source: "curated",
  });
  assert.deepEqual(resolveVehicleVisual({ make: "Ford", model: "Transit Custom" }), {
    bodyType: "generic",
    source: "generic",
  });
  assert.deepEqual(resolveVehicleVisual({ make: "Volkswagen", model: "Transporter" }), {
    bodyType: "van",
    source: "curated",
  });
  assert.deepEqual(resolveVehicleVisual({ make: "Honda", model: "Jazz" }), {
    bodyType: "hatchback",
    source: "curated",
  });
  assert.deepEqual(resolveVehicleVisual({ make: "Nissan", model: "Qashqai" }), {
    bodyType: "suv",
    source: "curated",
  });
  assert.deepEqual(resolveVehicleVisual({ make: "Unknown", model: "Family" }), {
    bodyType: "generic",
    source: "generic",
  });
});

test("unsupported structured categories and broad catalogue classes do not imply hatchback", () => {
  assert.deepEqual(
    resolveVehicleVisual({ make: "Honda", model: "Jazz", structuredBodyType: "estate", modelFamily: "Cars" }),
    { bodyType: "hatchback", source: "curated" },
  );
  assert.deepEqual(
    resolveVehicleVisual({ make: "Unknown", model: "Family", modelFamily: "Cars" }),
    { bodyType: "generic", source: "generic" },
  );
});

test("colour mapping preserves the controlled palette and neutral fallback", () => {
  assert.deepEqual(resolveVehicleColour("  GREY "), resolveVehicleColour("gray"));
  assert.deepEqual(resolveVehicleColour("light"), resolveVehicleColour("white"));
  assert.deepEqual(resolveVehicleColour("dark"), resolveVehicleColour("black"));
  for (const colour of [
    "black", "blue", "brown", "beige", "cream", "gold", "green", "grey", "gray",
    "maroon", "orange", "pink", "purple", "red", "silver", "white", "yellow",
  ]) {
    assert.notDeepEqual(resolveVehicleColour(colour), {
      body: "#94a3b8",
      shade: "#64748b",
      highlight: "#cbd5e1",
    });
  }
  assert.deepEqual(resolveVehicleColour("not-a-colour"), {
    body: "#94a3b8",
    shade: "#64748b",
    highlight: "#cbd5e1",
  });
});

test("VehicleVisual uses local SVG, identity text, and representative accessible copy", async () => {
  const source = await readFile(new URL("../src/components/vehicle-visual.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-label=.*Representative/i);
  assert.match(source, /role="img"/);
  assert.match(source, /representative/i);
  assert.match(source, /\{make\} \{model\}/);
  assert.match(source, /\{year\}/);
  assert.doesNotMatch(source, /\b(?:src|href)=\s*\{?\s*["'`]https?:\/\//i);
  assert.doesNotMatch(source, /<image\b/i);
  for (const bodyType of ["hatchback", "suv", "van", "generic"]) {
    assert.match(source, new RegExp(`case ["']${bodyType}["']`));
  }
});

test("Renault Trafic renders a grey representative van with identity and private plate", async () => {
  const VehicleVisual = await loadVehicleVisual();
  const markup = renderToStaticMarkup(React.createElement(VehicleVisual, {
    make: "RENAULT",
    model: "Trafic",
    year: 2019,
    colour: "grey",
    registration: " ab12 cde ",
  }));
  assert.match(markup, /aria-label="Representative van preview for grey RENAULT Trafic 2019"/);
  assert.match(markup, /RENAULT Trafic/);
  assert.match(markup, /2019 · grey/);
  assert.match(markup, /Representative van visual for confirmation only/);
  assert.match(markup, /AB12CDE/);
  assert.match(markup, /fill="#6b7280"/);
  assert.doesNotMatch(markup, /\b(?:href|src)="https?:\/\//i);
  assert.doesNotMatch(markup, /<image\b/i);
});

test("compact previews retain a representative accessible label", async () => {
  const VehicleVisual = await loadVehicleVisual();
  const markup = renderToStaticMarkup(React.createElement(VehicleVisual, {
    make: "Nissan",
    model: "Qashqai",
    year: 2022,
    compact: true,
  }));
  assert.match(markup, /aria-label="Representative suv preview for Nissan Qashqai 2022"/);
  assert.match(markup, /Illustrative representative vehicle shape/);
});
