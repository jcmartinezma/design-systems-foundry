import { generateStops } from "./color";
import { shadowCss } from "./shadow";
import { figmaVariableName, slug } from "./project";
import { radiusDimensions } from "./radius";
import { formatSpacingPx, formatSpacingRem } from "./spacing";
import { exportTypeScale, familyTokenName, fontWeightSteps, stepsForCollection } from "./type";
import type { DesignSystem, ExportFile, ExportSet, ExportVariable, TypeCollection, TypeExportFile } from "./types";

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

  for (const step of stepsForCollection(type)) {
    const name = segment(step.name, "step");
    number(`font/size/${name}`, `${step.size} px · step ${step.step}`, step.size, `${step.size}px`);
    number(`font/height/${name}`, `${step.height} rem · step ${step.step}`, step.height, `${step.height}rem`);
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
  return system.shadow.levels.flatMap((level) => {
    const name = segment(level.name, "level");
    const shadow = shadowCss(level, color);
    const shared = `${shadow} · color ${color}`;
    const number = (part: string, value: number, unit: string): ExportVariable => ({
      name: `shadow/${name}/${part}`,
      description: shared,
      code: cssName(["shadow", name, part]),
      type: "FLOAT",
      css: unit === "px" ? `${value}px` : String(value),
      number: value,
    });
    return [
      number("y", level.y, "px"),
      number("blur", level.blur, "px"),
      number("spread", level.spread, "px"),
      number("opacity", level.opacity, ""),
      {
        name: `shadow/${name}`,
        description: shared,
        code: cssName(["shadow", name]),
        type: "STRING",
        css: shadow,
        text: shadow,
      },
    ];
  });
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

export function exportSystem(system: DesignSystem): ExportFile {
  const name = segment(system.name, "System");
  const variables = [
    ...colorVariables(system),
    ...typeVariables(system.type),
    ...borderVariables(system),
    ...spacingVariables(system),
    ...radiusVariables(system),
    ...shadowVariables(system),
    ...motionVariables(system),
    ...blurVariables(system),
  ];
  return {
    source: "creator",
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
  };
}

export function cssForExport(file: ExportFile): string {
  const lines = file.sets.flatMap((set) => set.variables.map((variable) => `  ${variable.code}: ${variable.css};`));
  return `/* ${file.name} · foundations generated by DSfoundry */\n:root {\n${lines.join("\n")}\n}\n`;
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
};

export function pluginSystem(system: DesignSystem, active = false): PluginSystem {
  const exported = exportSystem(system);
  return {
    id: exported.id,
    name: exported.name,
    active,
    sets: exported.sets,
    type: exportTypeScale(system.type),
  };
}

export function pluginLibrary(systems: DesignSystem[], activeId: string | null) {
  return {
    source: "creator" as const,
    kind: "library" as const,
    systems: systems.map((system) => pluginSystem(system, system.id === activeId)),
  };
}
