export type VehicleBodyType = "hatchback" | "suv" | "van" | "generic";
export type VehicleBodySource = "structured" | "curated" | "generic";

export type VehicleVisualResolution = {
  bodyType: VehicleBodyType;
  source: VehicleBodySource;
};

export type VehicleVisualInput = {
  make: string;
  model: string;
  modelFamily?: string | null;
  structuredBodyType?: string | null;
};

export type VehicleColour = {
  body: string;
  shade: string;
  highlight: string;
};

const supportedBodyTypes = new Set<VehicleBodyType>(["hatchback", "suv", "van"]);

const curatedBodies: Readonly<Record<string, VehicleBodyType>> = {
  "FORD|TRANSIT": "van",
  "HONDA|JAZZ": "hatchback",
  "NISSAN|QASHQAI": "suv",
  "RENAULT|TRAFIC": "van",
  "VOLKSWAGEN|TRANSPORTER": "van",
};

const normalizeToken = (value: string | null | undefined) =>
  value?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";

export function resolveVehicleVisual(input: VehicleVisualInput): VehicleVisualResolution {
  const structured = normalizeToken(input.structuredBodyType).toLowerCase() as VehicleBodyType;
  if (supportedBodyTypes.has(structured)) {
    return { bodyType: structured, source: "structured" };
  }

  const make = normalizeToken(input.make);
  const family = normalizeToken(input.modelFamily);
  const model = normalizeToken(input.model);
  const curated = curatedBodies[`${make}|${family}`] ?? curatedBodies[`${make}|${model}`];
  return curated
    ? { bodyType: curated, source: "curated" }
    : { bodyType: "generic", source: "generic" };
}

const palette: Readonly<Record<string, VehicleColour>> = {
  black: { body: "#202325", shade: "#0f1112", highlight: "#4a4f52" },
  blue: { body: "#2563eb", shade: "#1748aa", highlight: "#60a5fa" },
  brown: { body: "#795548", shade: "#53382f", highlight: "#a57a69" },
  beige: { body: "#d6c7a1", shade: "#aa9b78", highlight: "#eee5cf" },
  cream: { body: "#f3ead3", shade: "#c9bea4", highlight: "#fffaf0" },
  gold: { body: "#c8a64b", shade: "#96782c", highlight: "#ead47f" },
  green: { body: "#2f7d4a", shade: "#1f5a34", highlight: "#66a879" },
  grey: { body: "#6b7280", shade: "#4b515c", highlight: "#9ca3af" },
  gray: { body: "#6b7280", shade: "#4b515c", highlight: "#9ca3af" },
  maroon: { body: "#7f1d1d", shade: "#561313", highlight: "#a94a4a" },
  orange: { body: "#ea580c", shade: "#a83d07", highlight: "#fb923c" },
  pink: { body: "#db6b9a", shade: "#a54970", highlight: "#efa2c0" },
  purple: { body: "#7c3aed", shade: "#5824b4", highlight: "#a78bfa" },
  red: { body: "#dc2626", shade: "#991b1b", highlight: "#f87171" },
  silver: { body: "#a8b0b8", shade: "#747e87", highlight: "#d8dde1" },
  white: { body: "#f8fafc", shade: "#cbd5e1", highlight: "#ffffff" },
  yellow: { body: "#eab308", shade: "#a87e05", highlight: "#fde047" },
};

const neutralColour: VehicleColour = {
  body: "#94a3b8",
  shade: "#64748b",
  highlight: "#cbd5e1",
};

const colourAliases: Readonly<Record<string, string>> = {
  dark: "black",
  light: "white",
};

export function resolveVehicleColour(value: string | null | undefined): VehicleColour {
  const key = value?.trim().toLowerCase() ?? "";
  return palette[colourAliases[key] ?? key] ?? neutralColour;
}
