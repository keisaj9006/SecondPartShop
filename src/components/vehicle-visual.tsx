import { CarFront, Info } from "lucide-react";
import {
  resolveVehicleColour,
  resolveVehicleVisual,
  type VehicleBodyType,
  type VehicleBodySource,
} from "@/lib/vehicle-visual";

type VehicleVisualProps = {
  make: string;
  model: string;
  year: number;
  colour?: string | null;
  variant?: string | null;
  registration?: string | null;
  engine?: string | null;
  fuel?: string | null;
  compact?: boolean;
  modelFamily?: string | null;
  structuredBodyType?: string | null;
  bodyType?: VehicleBodyType;
  bodySource?: VehicleBodySource;
};

const readable = (value: string | null | undefined) => value?.trim() || null;

function bodyPaths(bodyType: VehicleBodyType, body: string) {
  switch (bodyType) {
    case "hatchback":
      return <>
        <path d="M67 148c8-24 22-43 45-55l74-38c15-8 31-12 48-12h75c22 0 42 7 59 21l52 43 42 11c19 5 31 18 34 38l2 17H42l4-10c4-9 11-14 21-15Z" fill={body} />
        <path d="M202 61 142 99h235l-40-34c-10-8-22-12-36-12h-65c-12 0-24 3-34 8Z" fill="#bfd1d4" />
        <path d="M268 53v46M139 101h243" fill="none" />
      </>;
    case "suv":
      return <>
        <path d="M63 145c7-24 20-42 43-51l39-16 25-34c9-12 23-18 39-18h106c18 0 33 7 46 20l38 39 50 13c18 5 30 17 33 36l2 20H43l4-11c3-10 8-16 16-18Z" fill={body} />
        <path d="m158 76 24-32c6-8 15-12 27-12h31v47h-93Zm96-44h60c14 0 25 5 35 15l29 29H254Z" fill="#bfd1d4" />
        <path d="M240 35v44M159 80h219" fill="none" />
      </>;
    case "van":
      return <>
        <path d="M45 158V48c0-13 10-23 23-23h228c14 0 26 6 35 17l50 75 61 11c23 4 36 16 39 35l2 17H44v-22Z" fill={body} />
        <path d="M292 43h12c9 0 16 4 21 12l36 55h-69Z" fill="#bfd1d4" />
        <rect x="72" y="48" width="192" height="83" rx="5" fill="none" opacity=".5" />
        <path d="M279 40v122M290 119h82M376 126v40" fill="none" />
      </>;
    case "generic":
      return <>
        <path d="M58 148c8-23 23-38 46-48l62-27 34-27c10-8 22-12 36-12h92c18 0 34 7 48 21l40 41 38 12c18 6 28 19 30 37l1 16H43l4-9c2-2 6-4 11-4Z" fill={body} />
        <path d="m207 54-43 39h221l-35-36c-9-9-20-13-34-13h-79c-13 0-22 3-30 10Z" fill="#bfd1d4" />
        <path d="M270 46v48M164 95h224" fill="none" />
      </>;
  }
}

export function VehicleVisual({
  make,
  model,
  year,
  colour,
  variant,
  registration,
  engine,
  fuel,
  compact = false,
  modelFamily,
  structuredBodyType,
  bodyType,
  bodySource,
}: VehicleVisualProps) {
  const paint = resolveVehicleColour(colour);
  const resolved = bodyType && bodySource
    ? { bodyType, source: bodySource }
    : resolveVehicleVisual({ make, model, modelFamily, structuredBodyType });
  const isVan = resolved.bodyType === "van";
  const rearWheel = isVan ? 120 : 162;
  const frontWheel = isVan ? 414 : 403;
  const reg = readable(registration)?.replace(/\s+/g, "").toUpperCase() ?? null;
  const details = [variant, engine, fuel].filter((value): value is string => Boolean(readable(value)));
  const identity = [colour, make, model, String(year)].filter(Boolean).join(" ");

  return <div className={"overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-b from-[#e9f0ed] via-[#f7f8f5] to-white " + (compact ? "p-3" : "p-5")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#63706a]"><CarFront size={13} />Vehicle preview</span>
      <div className="flex items-center gap-2">
        {colour && <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-black uppercase"><span className="h-2.5 w-2.5 rounded-full border border-black/15" style={{ backgroundColor: paint.body }} />{colour}</span>}
        {reg && <span className="rounded border border-black/20 bg-[#f6df3e] px-2 py-0.5 font-mono text-[11px] font-black tracking-[.08em] text-black">{reg}</span>}
      </div>
    </div>

    <svg viewBox="0 0 520 230" role="img" aria-label={`Representative ${resolved.bodyType} preview for ${identity}`} className={"mx-auto w-full " + (compact ? "mt-1 max-h-28" : "mt-2 max-h-44")}>
      <title>{`Representative ${resolved.bodyType} visual for ${make} ${model} ${year}`}</title>
      <ellipse cx="258" cy="190" rx="191" ry="18" fill="rgba(15,23,42,.10)" />
      <g stroke="#16211e" strokeWidth="4" strokeLinejoin="round">{bodyPaths(resolved.bodyType, paint.body)}</g>
      <path d="M82 159H439l-6 10H77Z" fill={paint.shade} opacity=".8" />
      <path d={isVan ? "M76 34h184M67 151h386" : "M104 111c-11 7-20 18-26 34M420 115c22 3 38 11 48 24"} stroke={paint.highlight} strokeWidth="4" strokeLinecap="round" opacity=".65" />
      <path d={isVan ? "M51 128v22" : "M57 143h48"} stroke={isVan ? "#c2413d" : "#f8fafc"} strokeWidth="9" strokeLinecap="round" />
      <path d="M432 143h48" stroke="#f4d44d" strokeWidth="9" strokeLinecap="round" />
      <path d={isVan ? "M238 119h23M319 123h22" : "M171 113h38M293 113h38"} stroke="#16211e" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      <path d={`M${rearWheel-53} 172c4-30 24-49 53-49s50 19 54 49M${frontWheel-53} 172c4-30 24-49 53-49s50 19 54 49`} fill="none" stroke="#16211e" strokeWidth="5" />
      <circle cx={rearWheel} cy="171" r="31" fill="#171c1b" /><circle cx={rearWheel} cy="171" r="17" fill="#9aa4aa" /><circle cx={rearWheel} cy="171" r="6" fill="#dce2e5" />
      <circle cx={frontWheel} cy="171" r="31" fill="#171c1b" /><circle cx={frontWheel} cy="171" r="17" fill="#9aa4aa" /><circle cx={frontWheel} cy="171" r="6" fill="#dce2e5" />
      {reg && <g><rect x="238" y="148" width="72" height="19" rx="3" fill="#f6df3e" stroke="#17221f" strokeWidth="1.5" /><text x="274" y="161.5" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="800" fill="#111">{reg.slice(0, 8)}</text></g>}
    </svg>

    <p className="sr-only">Illustrative representative vehicle shape. It does not confirm exact body style, trim, or fitment.</p>
    {!compact && <div className="text-center">
      <p className="text-base font-black">{make} {model}</p>
      <p className="mt-0.5 text-xs font-bold text-[#56625d]">{year}{variant ? " · " + variant : ""}{colour ? " · " + colour : ""}</p>
      {details.length > 1 && <p className="mt-1 text-[11px] text-[#7a8580]">{details.slice(1).join(" · ")}</p>}
      <p className="mx-auto mt-3 flex max-w-md items-start justify-center gap-1.5 text-[10px] leading-4 text-[#7a8580]"><Info size={11} className="mt-0.5 shrink-0" />Representative {resolved.bodyType} visual for confirmation only. Exact body shape, trim, and wheels may differ from this example.</p>
    </div>}
  </div>;
}
