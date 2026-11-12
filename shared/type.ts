import { FOUNDRY_SOURCE, FOUNDRY_URL } from "./config";
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
export const MAX_STEPS_ABOVE = 6;
export const MAX_STEPS_BELOW = 3;
/** @deprecated Prefer MAX_STEPS_ABOVE / MAX_STEPS_BELOW. */
export const MAX_STEPS = MAX_STEPS_ABOVE;
export const REM_PX = 16;
const MIN_LINE_HEIGHT = 1;
const MAX_LINE_HEIGHT = 2.5;
const MIN_LETTER_SPACING = -0.1;
const MAX_LETTER_SPACING = 0.2;
const DEFAULT_HEIGHT_AT_BASE = 1.5;
const DEFAULT_HEIGHT_AT_LARGEST = 1.1;
const DEFAULT_SPACING_AT_BASE = 0;
const DEFAULT_SPACING_AT_LARGEST = 0;

export type TypeStep = {
  step: number;
  name: string;
  size: number;
  /** Final line-height in px (size × unitless coefficient). */
  height: number;
  /** Unitless line-height coefficient for this step. */
  lineHeight: number;
  /** Letter-spacing coefficient in em for this step. */
  spacingEm: number;
  /** Final letter-spacing in px (size × spacingEm). */
  spacing: number;
};

type LegacyType = Partial<TypeCollection> & {
  fontFamily?: string;
  displayFamily?: string;
  lineHeight?: number;
  count?: number;
  /** @deprecated Absolute rem (or px) height; migrated to heightAtBase unitless. */
  baseHeight?: number;
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

/** Place 0 is the smallest step → `100`, then `200`, … Base is whichever place holds step 0. */
export function nameForStep(place: number): string {
  return String((place + 1) * 100);
}

export function ratioValue(ratioId: TypeRatioId, customRatio: number): number {
  if (ratioId === "custom") return Math.round(clamp(customRatio, 1.05, 2) * 1000) / 1000;
  return TYPE_RATIOS.find((item) => item.id === ratioId)?.value ?? 1.25;
}

export function sizeForStep(baseSize: number, ratio: number, step: number, wholePixels = false): number {
  const raw = baseSize * ratio ** step;
  return wholePixels ? Math.round(raw) : round1(raw);
}

/**
 * Interpolates an anchor value by step index `i` relative to the base (i = 0).
 * When stepsAbove is 0, every step uses `atBase`.
 */
export function interpolateByStep(step: number, stepsAbove: number, atBase: number, atLargest: number): number {
  if (stepsAbove <= 0) return atBase;
  return round3(atBase + (step * (atLargest - atBase)) / stepsAbove);
}

/** @deprecated Prefer interpolateByStep. */
export function lineHeightForStep(
  step: number,
  stepsAbove: number,
  heightAtBase: number,
  heightAtLargest: number,
): number {
  return interpolateByStep(step, stepsAbove, heightAtBase, heightAtLargest);
}

/** Line-height / letter-spacing px = size × coefficient, rounded to one decimal. */
export function heightForStep(size: number, lineHeight: number): number {
  return round1(size * lineHeight);
}

/** True when letter-spacing anchors leave the default flat zero. */
export function hasLetterSpacingScale(spacingAtBase: number, spacingAtLargest: number): boolean {
  return spacingAtBase !== 0 || spacingAtLargest !== 0;
}

export function typeSteps(input: {
  baseSize: number;
  heightAtBase: number;
  heightAtLargest: number;
  spacingAtBase?: number;
  spacingAtLargest?: number;
  ratio: number;
  stepsAbove: number;
  stepsBelow: number;
  wholePixels?: boolean;
}): TypeStep[] {
  const above = clamp(Math.round(input.stepsAbove), 0, MAX_STEPS_ABOVE);
  const below = clamp(Math.round(input.stepsBelow), 0, MAX_STEPS_BELOW);
  const baseSize = round1(clamp(input.baseSize, 4, 120));
  const heightAtBase = round3(clamp(input.heightAtBase, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT));
  const heightAtLargest = round3(clamp(input.heightAtLargest, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT));
  const spacingAtBase = round3(clamp(input.spacingAtBase ?? 0, MIN_LETTER_SPACING, MAX_LETTER_SPACING));
  const spacingAtLargest = round3(clamp(input.spacingAtLargest ?? 0, MIN_LETTER_SPACING, MAX_LETTER_SPACING));
  const ratio = Math.round(clamp(input.ratio, 1.05, 2) * 1000) / 1000;
  const wholePixels = input.wholePixels === true;
  const steps: TypeStep[] = [];
  let place = 0;
  for (let step = -below; step <= above; step += 1) {
    const size = sizeForStep(baseSize, ratio, step, wholePixels);
    const lineHeight = interpolateByStep(step, above, heightAtBase, heightAtLargest);
    const spacingEm = interpolateByStep(step, above, spacingAtBase, spacingAtLargest);
    steps.push({
      step,
      name: nameForStep(place),
      size,
      lineHeight,
      height: heightForStep(size, lineHeight),
      spacingEm,
      spacing: heightForStep(size, spacingEm),
    });
    place += 1;
  }
  return steps;
}

export function stepsForCollection(collection: TypeCollection): TypeStep[] {
  return typeSteps({
    baseSize: collection.baseSize,
    heightAtBase: collection.heightAtBase,
    heightAtLargest: collection.heightAtLargest,
    spacingAtBase: collection.spacingAtBase,
    spacingAtLargest: collection.spacingAtLargest,
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

function emptyFamilies(count: number): FontFamily[] {
  return Array.from({ length: count }, () => ({ id: crypto.randomUUID(), name: "" }));
}

export function createTypeCollection(name: string, id?: string): TypeCollection {
  return {
    id: id || crypto.randomUUID(),
    name,
    baseSize: 16,
    heightAtBase: DEFAULT_HEIGHT_AT_BASE,
    heightAtLargest: DEFAULT_HEIGHT_AT_LARGEST,
    spacingAtBase: DEFAULT_SPACING_AT_BASE,
    spacingAtLargest: DEFAULT_SPACING_AT_LARGEST,
    ratioId: "major-third",
    customRatio: 1.25,
    stepsAbove: 4,
    stepsBelow: 1,
    families: [{ id: crypto.randomUUID(), name: "Big Caslon" }, ...emptyFamilies(MAX_FAMILIES - 1)],
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
  const families: FontFamily[] = [];
  if (Array.isArray(raw.families)) {
    for (const item of raw.families.slice(0, MAX_FAMILIES)) {
      if (!item || typeof item !== "object") continue;
      const family = item as Partial<FontFamily>;
      families.push({ id: family.id || crypto.randomUUID(), name: fontFamilyOf(family.name) });
    }
  } else {
    const first = fontFamilyOf(raw.fontFamily) || "Big Caslon";
    const second = fontFamilyOf(raw.displayFamily);
    families.push({ id: crypto.randomUUID(), name: first });
    if (second && second !== first) families.push({ id: crypto.randomUUID(), name: second });
  }
  while (families.length < MAX_FAMILIES) {
    families.push({ id: crypto.randomUUID(), name: "" });
  }
  return families.slice(0, MAX_FAMILIES);
}

/** Old absolute rem (or px mistaken for rem) → unitless coefficient at the base size. */
function legacyHeightAtBase(source: LegacyType, baseSize: number): number {
  const raw = Number(source.baseHeight);
  if (source.baseHeight == null || !Number.isFinite(raw)) {
    const fromRatio = Number(source.lineHeight) || DEFAULT_HEIGHT_AT_BASE;
    return round3(clamp(fromRatio, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT));
  }
  const rem = raw > MAX_LINE_HEIGHT ? raw / REM_PX : raw;
  const unitless = (rem * REM_PX) / baseSize;
  return round3(clamp(unitless, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT));
}

function normalizeLineHeight(value: unknown, fallback: number): number {
  const raw = Number(value);
  if (value == null || !Number.isFinite(raw)) return fallback;
  return round3(clamp(raw, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT));
}

function normalizeLetterSpacing(value: unknown, fallback: number): number {
  const raw = Number(value);
  if (value == null || !Number.isFinite(raw)) return fallback;
  return round3(clamp(raw, MIN_LETTER_SPACING, MAX_LETTER_SPACING));
}

export function normalizeTypeCollection(raw: LegacyType | null | undefined): TypeCollection {
  const source = raw ?? {};
  const ratioId = normalizeRatioId(source.ratioId);
  const stepsBelow = clamp(Math.round(Number(source.stepsBelow) || 0), 0, MAX_STEPS_BELOW);
  const stepsAbove =
    source.stepsAbove == null
      ? clamp(Math.round(Number(source.count) || 6) - stepsBelow - 1, 0, MAX_STEPS_ABOVE)
      : clamp(Math.round(Number(source.stepsAbove) || 0), 0, MAX_STEPS_ABOVE);
  const baseSize = round1(clamp(Number(source.baseSize) || 16, 4, 120));
  const heightAtBase =
    source.heightAtBase == null
      ? legacyHeightAtBase(source, baseSize)
      : normalizeLineHeight(source.heightAtBase, DEFAULT_HEIGHT_AT_BASE);
  const heightAtLargest = normalizeLineHeight(source.heightAtLargest, DEFAULT_HEIGHT_AT_LARGEST);
  const spacingAtBase = normalizeLetterSpacing(source.spacingAtBase, DEFAULT_SPACING_AT_BASE);
  const spacingAtLargest = normalizeLetterSpacing(source.spacingAtLargest, DEFAULT_SPACING_AT_LARGEST);
  return {
    id: source.id || crypto.randomUUID(),
    name: String(source.name ?? "Typography").slice(0, 48) || "Typography",
    baseSize,
    heightAtBase,
    heightAtLargest,
    spacingAtBase,
    spacingAtLargest,
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
    source: FOUNDRY_SOURCE,
    url: FOUNDRY_URL,
    kind: "type",
    collections: library.collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      fontFamily: collection.families.find((family) => family.name.trim())?.name.trim() || "Big Caslon",
      fontStyle: "Regular",
      lineHeightPercent: 100,
      styles: [],
    })),
  };
}
