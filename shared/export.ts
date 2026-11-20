import { generateStops } from "./color";
import { FOUNDRY_SOURCE, FOUNDRY_URL } from "./config";
import { foundationCorePath, isCoreFoundation, type CoreFoundationId } from "./dtcg";
import { shadowCss } from "./shadow";
import { figmaVariableName, slug } from "./project";
import { radiusDimensions } from "./radius";
import { formatSpacingPx, formatSpacingRem } from "./spacing";
import {
  exportTypeScale,
  familyTokenName,
  fontWeightSteps,
  hasLetterSpacingScale,
  spacingNameForPlace,
  stepsForCollection,
} from "./type";
import type {
  DesignSystem,
  ExportFile,
  ExportFoundationId,
  ExportSet,
  ExportVariable,
  TypeCollection,
  TypeExportFile,
} from "./types";

export type { ExportFoundationId };

function segment(value: string, fallback: string): string {
  return value.replace(/[.{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48) || fallback;
}

function cssName(parts: string[]): string {
  return `--${parts.map((part) => slug(part)).join("-")}`;
}

export function colorTokenNames(rampName: string, step: string): { name: string; code: string } {
  return {
    name: `color/${figmaVariableName(rampName, step)}`,
    code: cssName(["color", rampName, step]),
  };
}

function colorVariables(system: DesignSystem): ExportVariable[] {
  return system.colors.flatMap((ramp) => {
    const stops = generateStops(ramp);
    return stops.map((stop) => {
      const token = colorTokenNames(ramp.name, stop.step);
      return {
        name: token.name,
        description: `OKLCH ${stop.l.toFixed(3)} ${stop.c.toFixed(3)} ${Math.round(stop.h)}`,
        code: token.code,
        type: "COLOR" as const,
        css: stop.hex,
        hex: stop.hex,
        color: stop.rgb,
      };
    });
  });
}

function typeVariables(type: TypeCollection): ExportVariable[] {
  const variables: ExportVariable[] = [];
  const seen = new Set<string>();
  const text = (name: string, description: string, value: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    variables.push({
      name,
      description,
      code: cssName(name.split("/")),
      type: "STRING",
      css: JSON.stringify(value),
      text: value,
    });
  };
  const number = (name: string, description: string, value: number, css: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    variables.push({
      name,
      description,
      code: cssName(name.split("/")),
      type: "FLOAT",
      css,
      number: value,
    });
  };

  type.families.forEach((family, index) => {
    const value = family.name.trim();
    if (!value) return;
    text(`font/family/${familyTokenName(index)}`, `Font family ${index + 1}.`, value);
  });

  const steps = stepsForCollection(type);
  for (const step of steps) {
    const name = segment(step.name, "step");
    number(`font/size/${name}`, `${step.size} px · step ${step.step}`, step.size, `${step.size}px`);
    number(`font/height/${name}`, `${step.height} px · step ${step.step}`, step.height, `${step.height}px`);
  }

  if (hasLetterSpacingScale(type.spacingAtLowest, type.spacingAtBase, type.spacingAtLargest)) {
    // 100 = tracking at the largest size (typically the smallest value), then up the scale.
    [...steps].reverse().forEach((step, place) => {
      const name = segment(spacingNameForPlace(place), "step");
      number(`font/spacing/${name}`, `${step.spacing} px · step ${step.step}`, step.spacing, `${step.spacing}px`);
    });
  } else {
    number("font/spacing", "0 px.", 0, "0px");
  }

  for (const weight of fontWeightSteps()) {
    number(`font/weight/${weight.name}`, `${weight.value}.`, weight.value, String(weight.value));
  }

  return variables;
}

function borderVariables(system: DesignSystem): ExportVariable[] {
  return system.border.steps.map((step) => ({
    name: `border/${segment(step.name, "step")}`,
    description: `${formatSpacingPx(step.px)}px · ${formatSpacingRem(step.px)}`,
    code: cssName(["border", step.name]),
    type: "FLOAT" as const,
    css: `${formatSpacingPx(step.px)}px`,
    number: step.px,
  }));
}

function spacingVariables(system: DesignSystem): ExportVariable[] {
  return system.spacing.steps.map((step) => ({
    name: `spacing/${segment(step.name, "step")}`,
    description: `${formatSpacingPx(step.px)}px · ${formatSpacingRem(step.px)}`,
    code: cssName(["spacing", step.name]),
    type: "FLOAT" as const,
    css: `${formatSpacingPx(step.px)}px`,
    number: step.px,
  }));
}

function radiusVariables(system: DesignSystem): ExportVariable[] {
  return radiusDimensions(system.radius).map((step) => ({
    name: `radius/${segment(step.name, "step")}`,
    description: step.pill ? "Pill. The corner follows the shape." : `${formatSpacingPx(step.px)}px · ${formatSpacingRem(step.px)}`,
    code: cssName(["radius", step.name]),
    type: "FLOAT" as const,
    css: `${formatSpacingPx(step.px)}px`,
    number: step.px,
  }));
}

function shadowVariables(system: DesignSystem): ExportVariable[] {
  const color = system.shadow.color;
  const parts: { part: "y" | "blur" | "spread" | "opacity"; unit: "px" | ""; read: (level: (typeof system.shadow.levels)[number]) => number }[] = [
    { part: "y", unit: "px", read: (level) => level.y },
    { part: "blur", unit: "px", read: (level) => level.blur },
    { part: "spread", unit: "px", read: (level) => level.spread },
    { part: "opacity", unit: "", read: (level) => level.opacity },
  ];
  return parts.flatMap(({ part, unit, read }) =>
    system.shadow.levels.map((level) => {
      const name = segment(level.name, "level");
      const value = read(level);
      return {
        name: `shadow/${part}/${name}`,
        description: `${shadowCss(level, color)} · color ${color}`,
        code: cssName(["shadow", part, name]),
        type: "FLOAT" as const,
        css: unit === "px" ? `${value}px` : String(value),
        number: value,
      };
    }),
  );
}

function motionTimes(kind: "duration" | "delay", steps: DesignSystem["motion"]["durations"]): ExportVariable[] {
  const still = kind === "duration" ? "0 ms. The change is instant." : "0 ms. It starts at once.";
  return steps.map((item) => ({
    name: `motion/${kind}/${segment(item.name, kind)}`,
    description: item.ms === 0 ? still : `${item.ms} ms`,
    code: cssName(["motion", kind, item.name]),
    type: "FLOAT" as const,
    css: `${item.ms}ms`,
    number: item.ms,
  }));
}

function motionVariables(system: DesignSystem): ExportVariable[] {
  const curves: ExportVariable[] = system.motion.curves.map((item) => ({
    name: `motion/curve/${segment(item.name, "curve")}`,
    description: item.curve,
    code: cssName(["motion", "curve", item.name]),
    type: "STRING",
    css: item.curve,
    text: item.curve,
  }));
  return [...motionTimes("duration", system.motion.durations), ...motionTimes("delay", system.motion.delays), ...curves];
}

function blurVariables(system: DesignSystem): ExportVariable[] {
  return system.blur.steps.map((step) => ({
    name: `blur/${segment(step.name, "step")}`,
    description: step.px === 0 ? "No blur." : `${formatSpacingPx(step.px)}px · ${formatSpacingRem(step.px)}`,
    code: cssName(["blur", step.name]),
    type: "FLOAT" as const,
    css: `${formatSpacingPx(step.px)}px`,
    number: step.px,
  }));
}

export const EXPORT_FOUNDATION_IDS: readonly ExportFoundationId[] = [
  "color",
  "type",
  "border",
  "spacing",
  "radius",
  "shadow",
  "motion",
  "blur",
];

const foundationBuilders: Record<ExportFoundationId, (system: DesignSystem) => ExportVariable[]> = {
  color: colorVariables,
  type: (system) => typeVariables(system.type),
  border: borderVariables,
  spacing: spacingVariables,
  radius: radiusVariables,
  shadow: shadowVariables,
  motion: motionVariables,
  blur: blurVariables,
};

/** `undefined` means every foundation. An empty list means none. Unknown ids are ignored. */
export function normalizeFoundations(value: readonly string[] | undefined): ExportFoundationId[] | undefined {
  if (value === undefined) return undefined;
  const picked = new Set(value);
  return EXPORT_FOUNDATION_IDS.filter((id) => picked.has(id));
}

/** Saved on the system. Missing or invalid input defaults to every foundation; `[]` stays empty. */
export function normalizeExportFoundations(value: unknown): ExportFoundationId[] {
  if (!Array.isArray(value)) return [...EXPORT_FOUNDATION_IDS];
  const picked = new Set(value.filter((item): item is string => typeof item === "string"));
  return EXPORT_FOUNDATION_IDS.filter((id) => picked.has(id));
}

export type DownloadFileEntry = {
  name: string;
  description: string;
};

const CORE_FILE_LABEL: Record<CoreFoundationId, string> = {
  color: "Color tokens in DTCG format",
  type: "Typography tokens in DTCG format",
  border: "Border width tokens in DTCG format",
  spacing: "Spacing tokens in DTCG format",
  radius: "Radius tokens in DTCG format",
  shadow: "Shadow tokens in DTCG format",
  motion: "Motion tokens in DTCG format",
  blur: "Blur tokens in DTCG format",
};

export function downloadZipContents(foundations?: readonly string[]): DownloadFileEntry[] {
  const picked = normalizeFoundations(foundations) ?? EXPORT_FOUNDATION_IDS;
  const entries: DownloadFileEntry[] = [
    {
      name: "foundry_tokens.json",
      description: "Foundry export with Figma variables and the editable definition for the selected foundations",
    },
    {
      name: "foundations.css",
      description: "CSS custom properties for the selected foundations",
    },
    {
      name: "tokens.core.json",
      description: "All selected foundations merged into one DTCG file",
    },
  ];
  for (const id of picked) {
    if (!isCoreFoundation(id)) continue;
    entries.push({
      name: foundationCorePath(id)!,
      description: CORE_FILE_LABEL[id],
    });
  }
  return entries;
}

export function downloadFileNames(foundations?: readonly string[]): string[] {
  return downloadZipContents(foundations).map((entry) => entry.name);
}

/** Drop token data for foundations left out of the export so foundry_tokens.json matches the ticks. */
function scopeDefinition(system: DesignSystem, foundations: readonly ExportFoundationId[]): DesignSystem {
  const include = new Set(foundations);
  const definition = structuredClone(system);
  definition.exportFoundations = EXPORT_FOUNDATION_IDS.filter((id) => include.has(id));

  if (!include.has("color")) {
    definition.colors = [];
    definition.aliases = [];
  }
  if (!include.has("type")) {
    definition.type = { ...definition.type, families: [], stepsAbove: 0, stepsBelow: 0 };
  }
  if (!include.has("border")) {
    definition.border = { ...definition.border, steps: [], customValues: [] };
  }
  if (!include.has("spacing")) {
    definition.spacing = { ...definition.spacing, steps: [], customValues: [] };
  }
  if (!include.has("radius")) {
    definition.radius = { ...definition.radius, steps: [], customValues: [], full: false };
  }
  if (!include.has("shadow")) {
    definition.shadow = { ...definition.shadow, levels: [] };
  }
  if (!include.has("motion")) {
    definition.motion = { ...definition.motion, durations: [], delays: [], curves: [] };
  }
  if (!include.has("blur")) {
    definition.blur = { ...definition.blur, steps: [], customValues: [] };
  }

  return definition;
}

export function exportSystem(system: DesignSystem, foundations?: readonly string[]): ExportFile {
  const name = segment(system.name, "System");
  const picked = normalizeFoundations(foundations) ?? EXPORT_FOUNDATION_IDS;
  const include = new Set(picked);
  const variables = EXPORT_FOUNDATION_IDS.filter((id) => include.has(id)).flatMap((id) => foundationBuilders[id](system));
  return {
    source: FOUNDRY_SOURCE,
    url: FOUNDRY_URL,
    kind: "system",
    id: system.id,
    name,
    sets: [
      {
        id: system.id,
        name,
        variables,
      },
    ],
    // When foundations are passed (Copy / ZIP / publish), scope definition to the same ticks.
    // With no filter, keep the full editable system for import round-trips.
    definition: foundations === undefined ? structuredClone(system) : scopeDefinition(system, picked),
  };
}

export function cssForExport(file: ExportFile): string {
  const lines = file.sets
    .flatMap((set) => set.variables)
    .slice()
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((variable) => `  ${variable.code}: ${variable.css};`);
  return `/* ${file.name} · foundations generated by Foundry */\n:root {\n${lines.join("\n")}\n}\n`;
}

export function cssForRamp(rampName: string, entries: { step: string; hex: string }[]): string {
  return entries.map((entry) => `--${slug(rampName)}-${entry.step}: ${entry.hex};`).join("\n");
}

export type PluginSystem = {
  id: string;
  name: string;
  active: boolean;
  sets: ExportSet[];
  type: TypeExportFile;
  definition: DesignSystem;
};

export function pluginSystem(system: DesignSystem, active = false, foundations?: readonly string[]): PluginSystem {
  const picked = normalizeFoundations(foundations);
  const exported = exportSystem(system, picked);
  return {
    id: exported.id,
    name: exported.name,
    active,
    sets: exported.sets,
    type:
      picked === undefined || picked.includes("type")
        ? exportTypeScale(system.type)
        : { source: FOUNDRY_SOURCE, url: FOUNDRY_URL, kind: "type", collections: [] },
    definition: exported.definition,
  };
}

export function pluginLibrary(systems: DesignSystem[], activeId: string | null, foundations?: readonly string[]) {
  return {
    source: FOUNDRY_SOURCE,
    url: FOUNDRY_URL,
    kind: "library" as const,
    systems: systems.map((system) => pluginSystem(system, system.id === activeId, foundations)),
  };
}
