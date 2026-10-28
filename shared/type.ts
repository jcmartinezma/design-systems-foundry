import type { FontFamily, TypeCollection, TypeExportFile, TypeLibrary, TypeRatioId } from "./types";

export const TYPE_RATIOS: { id: TypeRatioId; name: string; value: number | null }[] = [
  { id: "minor-second", name: "Minor second", value: 1.067 },
  { id: "major-second", name: "Major second", value: 1.125 },
  { id: "minor-third", name: "Minor third", value: 1.2 },
  { id: "major-third", name: "Major third", value: 1.25 },
  { id: "perfect-fourth", name: "Perfect fourth", value: 1.333 },
  { id: "augmented-fourth", name: "Augmented fourth", value: 1.414 },
  { id: "perfect-fifth", name: "Perfect fifth", value: 1.5 },
  { id: "golden", name: "Golden ratio", value: 1.618 },
  { id: "custom", name: "Custom", value: null },
];

export const MAX_FAMILIES = 3;
export const MAX_STEPS = 8;
export const REM_PX = 16;
const MIN_HEIGHT_REM = 0.5;
const MAX_HEIGHT_REM = 3;

const LARGER = ["lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];
const SMALLER = ["sm", "xs", "2xs", "3xs", "4xs", "5xs"];

export type TypeStep = {
  step: number;
  name: string;
  size: number;
  height: number;
};

type LegacyType = Partial<TypeCollection> & {
  fontFamily?: string;
  displayFamily?: string;
  lineHeight?: number;
  count?: number;
};

export type FontWeightStep = {
  name: string;
  value: number;
};

export function fontWeightSteps(): FontWeightStep[] {
  const steps: FontWeightStep[] = [];
  for (let value = 200; value <= 900; value += 100) {
    steps.push({ name: String((value - 100) / 100).padStart(2, "0"), value });
  }
  return steps;
}

export function familyTokenName(index: number): string {
  return `font-${index + 1}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function nameForStep(step: number): string {
  if (step === 0) return "base";
  if (step > 0) return LARGER[step - 1] ?? `step-${step}`;
  return SMALLER[-step - 1] ?? `step${step}`;
}

export function ratioValue(ratioId: TypeRatioId, customRatio: number): number {
  if (ratioId === "custom") return Math.round(clamp(customRatio, 1.05, 2) * 1000) / 1000;
  return TYPE_RATIOS.find((item) => item.id === ratioId)?.value ?? 1.25;
}

export function sizeForStep(baseSize: number, ratio: number, step: number, wholePixels = false): number {
  const raw = baseSize * ratio ** step;
  return wholePixels ? Math.round(raw) : round1(raw);
}

export function heightForStep(baseHeight: number, ratio: number, step: number): number {
  return round3(baseHeight * ratio ** step);
}

export function typeSteps(input: {
  baseSize: number;
  baseHeight: number;
  ratio: number;
  stepsAbove: number;
  stepsBelow: number;
  wholePixels?: boolean;
}): TypeStep[] {
  const above = clamp(Math.round(input.stepsAbove), 0, MAX_STEPS);
  const below = clamp(Math.round(input.stepsBelow), 0, MAX_STEPS);
  const baseSize = round1(clamp(input.baseSize, 4, 120));
  const baseHeight = round3(clamp(input.baseHeight, MIN_HEIGHT_REM, MAX_HEIGHT_REM));
  const ratio = Math.round(clamp(input.ratio, 1.05, 2) * 1000) / 1000;
  const wholePixels = input.wholePixels === true;
  const steps: TypeStep[] = [];
  for (let step = -below; step <= above; step += 1) {
    steps.push({
      step,
      name: nameForStep(step),
      size: sizeForStep(baseSize, ratio, step, wholePixels),
      height: heightForStep(baseHeight, ratio, step),
    });
  }
  return steps;
}

export function stepsForCollection(collection: TypeCollection): TypeStep[] {
  return typeSteps({
    baseSize: collection.baseSize,
    baseHeight: collection.baseHeight,
    ratio: ratioValue(collection.ratioId, collection.customRatio),
    stepsAbove: collection.stepsAbove,
    stepsBelow: collection.stepsBelow,
    wholePixels: collection.wholePixels,
  });
}

export function figmaTextStyleName(collectionName: string, styleName: string): string {
  const clean = (value: string, fallback: string) =>
    value.replace(/[./{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48) || fallback;
  return `${clean(collectionName, "Tipo")}/${clean(styleName, "estilo")}`;
}

export function createTypeCollection(name: string, id?: string): TypeCollection {
  return {
    id: id || crypto.randomUUID(),
    name,
    baseSize: 16,
    baseHeight: 1.5,
    ratioId: "major-third",
    customRatio: 1.25,
    stepsAbove: 4,
    stepsBelow: 1,
    families: [{ id: crypto.randomUUID(), name: "Inter" }],
    wholePixels: false,
  };
}

/** Letters, numbers, and spaces only — blocks CSS-breaking symbols. */
export function sanitizeFontFamilyInput(value: string): string {
  return value
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/ {2,}/g, " ")
    .replace(/^ +/, "")
    .slice(0, 80);
}

export function sanitizeFontFamily(value: unknown): string {
  return sanitizeFontFamilyInput(String(value ?? "")).trim();
}

function fontFamilyOf(value: unknown): string {
  return sanitizeFontFamily(value);
}

function normalizeRatioId(value: unknown): TypeRatioId {
  return TYPE_RATIOS.some((item) => item.id === value) ? (value as TypeRatioId) : "major-third";
}

function normalizeFamilies(raw: LegacyType): FontFamily[] {
  if (Array.isArray(raw.families)) {
    return raw.families.slice(0, MAX_FAMILIES).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const family = item as Partial<FontFamily>;
      return [{ id: family.id || crypto.randomUUID(), name: fontFamilyOf(family.name) }];
    });
  }
  const first = fontFamilyOf(raw.fontFamily) || "Inter";
  const second = fontFamilyOf(raw.displayFamily);
  const families: FontFamily[] = [{ id: crypto.randomUUID(), name: first }];
  if (second && second !== first) families.push({ id: crypto.randomUUID(), name: second });
  return families;
}

function baseHeightRem(source: LegacyType, baseSize: number): number {
  const raw = Number(source.baseHeight);
  if (source.baseHeight == null || !Number.isFinite(raw)) {
    const fromRatio = (baseSize * (Number(source.lineHeight) || 1.4)) / REM_PX;
    return round3(clamp(fromRatio, MIN_HEIGHT_REM, MAX_HEIGHT_REM));
  }
  const rem = raw > MAX_HEIGHT_REM ? raw / REM_PX : raw;
  return round3(clamp(rem, MIN_HEIGHT_REM, MAX_HEIGHT_REM));
}

export function normalizeTypeCollection(raw: LegacyType | null | undefined): TypeCollection {
  const source = raw ?? {};
  const ratioId = normalizeRatioId(source.ratioId);
  const stepsBelow = clamp(Math.round(Number(source.stepsBelow) || 0), 0, MAX_STEPS);
  const stepsAbove =
    source.stepsAbove == null
      ? clamp(Math.round(Number(source.count) || 6) - stepsBelow - 1, 0, MAX_STEPS)
      : clamp(Math.round(Number(source.stepsAbove) || 0), 0, MAX_STEPS);
  const baseSize = round1(clamp(Number(source.baseSize) || 16, 4, 120));
  const baseHeight = baseHeightRem(source, baseSize);
  return {
    id: source.id || crypto.randomUUID(),
    name: String(source.name ?? "Typography").slice(0, 48) || "Typography",
    baseSize,
    baseHeight,
    ratioId,
    customRatio: Math.round(clamp(Number(source.customRatio) || 1.25, 1.05, 2) * 1000) / 1000,
    stepsAbove,
    stepsBelow,
    families: normalizeFamilies(source),
    wholePixels: source.wholePixels === true,
  };
}

export function createDefaultTypeLibrary(): TypeLibrary {
  const collection = createTypeCollection("Text", "type-text");
  return { activeCollectionId: collection.id, collections: [collection] };
}

export function normalizeTypeLibrary(raw: Partial<TypeLibrary> | null | undefined): TypeLibrary {
  if (!raw || !Array.isArray(raw.collections)) return createDefaultTypeLibrary();
  const collections = raw.collections.map((collection) => normalizeTypeCollection(collection));
  const activeExists = collections.some((collection) => collection.id === raw.activeCollectionId);
  return {
    activeCollectionId: activeExists ? (raw.activeCollectionId ?? null) : (collections[0]?.id ?? null),
    collections,
  };
}

export function exportTypeScale(scale: TypeCollection): TypeExportFile {
  return exportTypeLibrary({ activeCollectionId: scale.id, collections: [scale] });
}

export function exportTypeLibrary(library: TypeLibrary): TypeExportFile {
  return {
    source: "creator",
    kind: "type",
    collections: library.collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      fontFamily: collection.families.find((family) => family.name.trim())?.name.trim() || "Inter",
      fontStyle: "Regular",
      lineHeightPercent: 100,
      styles: [],
    })),
  };
}
