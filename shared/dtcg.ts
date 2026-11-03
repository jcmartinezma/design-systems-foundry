import { generateStops } from "./color";
import { blurDtcg } from "./blur";
import { borderDtcg } from "./border";
import { parseHex } from "./shadow";
import { radiusDtcg } from "./radius";
import { dimensionToken, spacingDtcg } from "./spacing";
import { familyTokenName, fontWeightSteps, stepsForCollection } from "./type";
import type {
  DesignSystem,
  ExportFoundationId,
  MotionScale,
  Ramp,
  ShadowScale,
  TypeCollection,
} from "./types";

/** Official DTCG Format Module 2025.10 JSON Schema. */
export const DTCG_FORMAT_SCHEMA = "https://www.designtokens.org/schemas/2025.10/format.json";

export type DtcgColorValue = {
  colorSpace: "srgb";
  components: [number, number, number];
  alpha: number;
  hex?: string;
};

export type DtcgColorToken = {
  $type: "color";
  $value: DtcgColorValue;
  $description?: string;
};

export type DtcgDocument = {
  $schema: string;
  [group: string]: unknown;
};

/** Group / token names must not contain `.` `{` `}` per DTCG. */
export function dtcgName(value: string, fallback = "token"): string {
  const cleaned = value.replace(/[.{}]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function srgbColor(r: number, g: number, b: number, alpha = 1, hex?: string): DtcgColorValue {
  const components: [number, number, number] = [round4(r), round4(g), round4(b)];
  const value: DtcgColorValue = { colorSpace: "srgb", components, alpha: round4(alpha) };
  if (hex) value.hex = hex.toLowerCase();
  return value;
}

export function colorDtcg(ramps: Ramp[]): { color: Record<string, Record<string, DtcgColorToken>> } {
  const color: Record<string, Record<string, DtcgColorToken>> = {};
  for (const ramp of ramps) {
    const rampName = dtcgName(ramp.name, "color");
    const steps: Record<string, DtcgColorToken> = {};
    for (const stop of generateStops(ramp)) {
      const stepName = dtcgName(stop.step, "step");
      steps[stepName] = {
        $type: "color",
        $description: `OKLCH ${stop.l.toFixed(3)} ${stop.c.toFixed(3)} ${Math.round(stop.h)}`,
        $value: srgbColor(stop.rgb.r, stop.rgb.g, stop.rgb.b, stop.rgb.a, stop.hex),
      };
    }
    color[rampName] = steps;
  }
  return { color };
}

export function typeDtcg(type: TypeCollection): {
  font: {
    family: Record<string, { $type: "fontFamily"; $value: string; $description?: string }>;
    size: Record<string, ReturnType<typeof dimensionToken> & { $description?: string }>;
    height: Record<string, { $type: "number"; $value: number; $description?: string }>;
    weight: Record<string, { $type: "fontWeight"; $value: number; $description?: string }>;
  };
} {
  const family: Record<string, { $type: "fontFamily"; $value: string; $description?: string }> = {};
  type.families.forEach((item, index) => {
    const value = item.name.trim();
    if (!value) return;
    const name = dtcgName(familyTokenName(index), `font-${index + 1}`);
    family[name] = {
      $type: "fontFamily",
      $value: value,
      $description: `Font family ${index + 1}.`,
    };
  });

  const size: Record<string, ReturnType<typeof dimensionToken> & { $description?: string }> = {};
  const height: Record<string, { $type: "number"; $value: number; $description?: string }> = {};
  for (const step of stepsForCollection(type)) {
    const name = dtcgName(step.name, "step");
    size[name] = {
      ...dimensionToken(step.size),
      $description: `${step.size} px · step ${step.step}`,
    };
    height[name] = {
      $type: "number",
      $value: step.height,
      $description: `${step.height} rem · step ${step.step}`,
    };
  }

  const weight: Record<string, { $type: "fontWeight"; $value: number; $description?: string }> = {};
  for (const step of fontWeightSteps()) {
    weight[dtcgName(step.name, "weight")] = {
      $type: "fontWeight",
      $value: step.value,
      $description: `${step.value}.`,
    };
  }

  return { font: { family, size, height, weight } };
}

export function shadowDtcg(scale: ShadowScale): {
  shadow: Record<
    string,
    {
      $type: "shadow";
      $value: {
        color: DtcgColorValue;
        offsetX: { value: number; unit: "px" };
        offsetY: { value: number; unit: "px" };
        blur: { value: number; unit: "px" };
        spread: { value: number; unit: "px" };
      };
      $description?: string;
    }
  >;
} {
  const rgb = parseHex(scale.color) ?? { r: 0, g: 0, b: 0 };
  const shadow: Record<
    string,
    {
      $type: "shadow";
      $value: {
        color: DtcgColorValue;
        offsetX: { value: number; unit: "px" };
        offsetY: { value: number; unit: "px" };
        blur: { value: number; unit: "px" };
        spread: { value: number; unit: "px" };
      };
      $description?: string;
    }
  > = {};

  for (const level of scale.levels) {
    const name = dtcgName(level.name, "level");
    shadow[name] = {
      $type: "shadow",
      $description: `color ${scale.color}`,
      $value: {
        color: srgbColor(rgb.r / 255, rgb.g / 255, rgb.b / 255, level.opacity, scale.color),
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: level.y, unit: "px" },
        blur: { value: level.blur, unit: "px" },
        spread: { value: level.spread, unit: "px" },
      },
    };
  }
  return { shadow };
}

export function motionDtcg(scale: MotionScale): {
  motion: {
    duration: Record<string, { $type: "duration"; $value: { value: number; unit: "ms" }; $description?: string }>;
    delay: Record<string, { $type: "duration"; $value: { value: number; unit: "ms" }; $description?: string }>;
    curve: Record<string, { $type: "cubicBezier"; $value: [number, number, number, number]; $description?: string }>;
  };
} {
  const duration: Record<string, { $type: "duration"; $value: { value: number; unit: "ms" }; $description?: string }> = {};
  for (const item of scale.durations) {
    duration[dtcgName(item.name, "duration")] = {
      $type: "duration",
      $value: { value: item.ms, unit: "ms" },
      $description: item.ms === 0 ? "0 ms. The change is instant." : `${item.ms} ms`,
    };
  }

  const delay: Record<string, { $type: "duration"; $value: { value: number; unit: "ms" }; $description?: string }> = {};
  for (const item of scale.delays) {
    delay[dtcgName(item.name, "delay")] = {
      $type: "duration",
      $value: { value: item.ms, unit: "ms" },
      $description: item.ms === 0 ? "0 ms. It starts at once." : `${item.ms} ms`,
    };
  }

  const curve: Record<string, { $type: "cubicBezier"; $value: [number, number, number, number]; $description?: string }> = {};
  for (const item of scale.curves) {
    curve[dtcgName(item.name, "curve")] = {
      $type: "cubicBezier",
      $value: [...item.values] as [number, number, number, number],
      $description: item.curve,
    };
  }

  return { motion: { duration, delay, curve } };
}

export function withDtcgSchema(groups: Record<string, unknown>): DtcgDocument {
  return { $schema: DTCG_FORMAT_SCHEMA, ...groups };
}

/** Every foundation that emits a DTCG core file. */
export const CORE_FOUNDATION_IDS = [
  "color",
  "type",
  "border",
  "spacing",
  "radius",
  "shadow",
  "motion",
  "blur",
] as const satisfies readonly ExportFoundationId[];

export type CoreFoundationId = (typeof CORE_FOUNDATION_IDS)[number];

export function isCoreFoundation(id: string): id is CoreFoundationId {
  return (CORE_FOUNDATION_IDS as readonly string[]).includes(id);
}

export function foundationCorePath(id: ExportFoundationId): string | null {
  if (!isCoreFoundation(id)) return null;
  return `core/${id}.core.json`;
}

export function coreGroupsFor(system: DesignSystem, id: CoreFoundationId): Record<string, unknown> {
  switch (id) {
    case "color":
      return colorDtcg(system.colors);
    case "type":
      return typeDtcg(system.type);
    case "border":
      return borderDtcg(system.border);
    case "spacing":
      return spacingDtcg(system.spacing);
    case "radius":
      return radiusDtcg(system.radius);
    case "shadow":
      return shadowDtcg(system.shadow);
    case "motion":
      return motionDtcg(system.motion);
    case "blur":
      return blurDtcg(system.blur);
  }
}

export function coreDocumentFor(system: DesignSystem, id: CoreFoundationId): DtcgDocument {
  return withDtcgSchema(coreGroupsFor(system, id));
}

/** Merged DTCG file for the selected foundations (`core/tokens.core.json`). */
export function tokensCoreDocument(system: DesignSystem, foundations?: readonly ExportFoundationId[]): DtcgDocument {
  const include = foundations === undefined ? null : new Set(foundations);
  const groups: Record<string, unknown> = {};
  for (const id of CORE_FOUNDATION_IDS) {
    if (include && !include.has(id)) continue;
    Object.assign(groups, coreGroupsFor(system, id));
  }
  return withDtcgSchema(groups);
}
