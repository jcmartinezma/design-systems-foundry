import type { SpacingMode, SpacingOrigin, SpacingScale, SpacingStep } from "./types";

/** Fixed multipliers for Jumps. Count is 4–16, so 16 entries are enough. */
export const JUMP_MULTIPLIERS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80];

export const RATIO_PRESETS = [1.25, 1.333, 1.5, 1.618, 2];

export const SPACING_MODE_LABEL: Record<SpacingMode, string> = {
  linear: "Linear",
  jumps: "Jumps",
  ratio: "Ratio",
  fibonacci: "Fibonacci",
  custom: "Custom",
};

const MODES: SpacingMode[] = ["linear", "jumps", "ratio", "fibonacci", "custom"];
const GENERATED_MODES = ["linear", "jumps", "ratio", "fibonacci"] as const;
const LEGACY_MULTIPLIERS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

type SpacingInput = {
  base?: number;
  mode?: SpacingMode;
  count?: number;
  ratio?: number;
  micro?: boolean;
  customValues?: number[];
  customFrom?: SpacingOrigin | null;
  edited?: boolean;
};

export function formatSpacingPx(px: number): string {
  const rounded = roundPx(px);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatSpacingRem(px: number): string {
  const rem = Math.round((roundPx(px) / 16) * 10000) / 10000;
  return `${rem}rem`;
}

export function createSpacingScale(): SpacingScale {
  return materialize({ base: 4, mode: "jumps", count: 10, ratio: 1.5, micro: false, customValues: [] });
}

export function materialize(input: SpacingInput): SpacingScale {
  const base = clampInt(input.base, 1, 64, 4);
  const mode = isMode(input.mode) ? input.mode : "jumps";
  const count = clampInt(input.count, 4, 16, 10);
  const ratio = clampRatio(input.ratio);
  const micro = Boolean(input.micro);
  const customValues = sanitizeValues(input.customValues);
  const customFrom = normalizeOrigin(input.customFrom);
  const values = composeValues({ base, mode, count, ratio, micro, customValues });
  return {
    base,
    mode,
    count,
    ratio,
    micro,
    customValues,
    customFrom: mode === "custom" ? customFrom : null,
    edited: mode === "custom" && Boolean(input.edited),
    steps: nameSteps(values, micro ? microPixels(base) : [], base),
  };
}

export function configureSpacing(scale: SpacingScale, patch: SpacingInput): SpacingScale {
  return materialize({ ...scale, ...patch });
}

export function selectSpacingMode(scale: SpacingScale, mode: SpacingMode): SpacingScale {
  if (mode === scale.mode) return scale;
  if (mode !== "custom") return materialize({ ...scale, mode, edited: false });
  const customValues =
    scale.customValues.length > 0
      ? scale.customValues
      : scale.steps.filter((step) => step.px > 0 && !step.micro).map((step) => step.px);
  return materialize({
    ...scale,
    mode: "custom",
    customValues,
    edited: false,
    customFrom: scale.customFrom ?? snapshot(scale),
  });
}

export type SpacingEditResult =
  | { ok: true; scale: SpacingScale; changed: boolean }
  | { ok: false; reason: "invalid" | "duplicate" };

export function editSpacingValue(scale: SpacingScale, stepName: string, raw: number): SpacingEditResult {
  if (stepName === "0") return { ok: false, reason: "invalid" };
  const current = scale.steps.find((step) => step.name === stepName);
  if (!current) return { ok: false, reason: "invalid" };
  const nextPx = roundPx(raw);
  if (!(nextPx > 0) || nextPx > 4096) return { ok: false, reason: "invalid" };
  if (nextPx === current.px) return { ok: true, scale, changed: false };

  if (scale.mode !== "custom") {
    const positive = scale.steps.map((step) => (step.name === stepName ? nextPx : step.px)).filter((px) => px > 0);
    if (new Set(positive).size !== positive.length) return { ok: false, reason: "duplicate" };
    return {
      ok: true,
      changed: true,
      scale: materialize({
        ...scale,
        mode: "custom",
        micro: false,
        customValues: positive,
        customFrom: snapshot(scale),
        edited: true,
      }),
    };
  }

  if (current.micro && scale.micro) {
    const positive = scale.steps.map((step) => (step.name === stepName ? nextPx : step.px)).filter((px) => px > 0);
    if (new Set(positive).size !== positive.length) return { ok: false, reason: "duplicate" };
    return {
      ok: true,
      changed: true,
      scale: materialize({ ...scale, micro: false, customValues: positive }),
    };
  }

  const customValues = scale.customValues.map((px) => (px === current.px ? nextPx : px));
  const composed = composeValues({
    base: scale.base,
    mode: "custom",
    count: scale.count,
    ratio: scale.ratio,
    micro: scale.micro,
    customValues,
  });
  if (composed.length !== scale.steps.length) return { ok: false, reason: "duplicate" };
  return { ok: true, changed: true, scale: materialize({ ...scale, customValues }) };
}

export function addCustomValue(scale: SpacingScale): SpacingScale {
  if (scale.steps.filter((step) => step.px > 0).length >= 32) return scale;
  const existing = new Set(scale.steps.map((step) => step.px));
  const quantum = roundPx(scale.base / 2);
  let value = roundPx((scale.steps.at(-1)?.px ?? 0) + quantum);
  while (existing.has(value)) value = roundPx(value + quantum);
  return materialize({
    ...scale,
    mode: "custom",
    customValues: [...scale.customValues, value],
    customFrom: scale.mode === "custom" ? scale.customFrom : snapshot(scale),
    edited: scale.mode === "custom" ? scale.edited : false,
  });
}

export function removeCustomValue(scale: SpacingScale, stepName: string): SpacingScale {
  const removed = scale.steps.find((step) => step.name === stepName);
  if (!removed || removed.px <= 0) return scale;
  if (removed.micro && scale.micro) {
    return materialize({
      ...scale,
      mode: "custom",
      micro: false,
      customValues: scale.steps.filter((step) => step.name !== stepName && step.px > 0).map((step) => step.px),
      customFrom: scale.mode === "custom" ? scale.customFrom : snapshot(scale),
      edited: scale.mode === "custom" ? scale.edited : false,
    });
  }
  return materialize({
    ...scale,
    mode: "custom",
    customValues: scale.customValues.filter((px) => px !== removed.px),
    customFrom: scale.mode === "custom" ? scale.customFrom : snapshot(scale),
    edited: scale.mode === "custom" ? scale.edited : false,
  });
}

export function restoreSpacing(scale: SpacingScale): SpacingScale {
  if (!scale.customFrom) return scale;
  const origin = scale.customFrom;
  return materialize({
    base: origin.base,
    mode: origin.mode,
    count: origin.count,
    ratio: origin.ratio,
    micro: origin.micro,
    customValues: origin.customValues,
    customFrom: null,
    edited: false,
  });
}

export type SpacingDtcgToken = {
  $type: "dimension";
  $value: string;
  $extensions: { "com.foundry.rem": string };
};

export function spacingDtcg(scale: SpacingScale): { spacing: Record<string, SpacingDtcgToken> } {
  const spacing: Record<string, SpacingDtcgToken> = {};
  for (const step of scale.steps) {
    spacing[step.name] = {
      $type: "dimension",
      $value: `${formatSpacingPx(step.px)}px`,
      $extensions: { "com.foundry.rem": formatSpacingRem(step.px) },
    };
  }
  return { spacing };
}

type LooseStep = { multiplier?: number; px?: number };
type LooseScale = SpacingInput & { steps?: LooseStep[] };

export function normalizeSpacing(raw: LooseScale | Partial<SpacingScale> | null | undefined): SpacingScale {
  if (!raw || typeof raw !== "object") return createSpacingScale();
  const source = raw as LooseScale;
  const base = clampInt(source.base, 1, 64, 4);
  if (!isMode(source.mode)) {
    const legacy = legacyPixels(source.steps, base);
    if (legacy.stock) return materialize({ base, mode: "jumps", count: 10, ratio: 1.5, micro: false, customValues: [] });
    return materialize({ base, mode: "custom", count: 10, ratio: 1.5, micro: false, customValues: legacy.values });
  }
  const customValues =
    Array.isArray(source.customValues) && source.customValues.length > 0
      ? source.customValues
      : source.mode === "custom"
        ? (source.steps ?? []).map((step) => Number(step?.px)).filter((px) => px > 0)
        : source.customValues;
  return materialize({ ...source, base, customValues });
}

export function generatedSpacingValues(mode: Exclude<SpacingMode, "custom">, base: number, count: number, ratio: number): number[] {
  return generatedBody(mode, clampInt(base, 1, 64, 4), clampInt(count, 4, 16, 10), clampRatio(ratio));
}

function composeValues(input: {
  base: number;
  mode: SpacingMode;
  count: number;
  ratio: number;
  micro: boolean;
  customValues: number[];
}): number[] {
  const body = input.mode === "custom" ? input.customValues : generatedBody(input.mode, input.base, input.count, input.ratio);
  const micros = input.micro ? microPixels(input.base) : [];
  return strictlyIncreasing([0, ...micros, ...body]);
}

function generatedBody(mode: Exclude<SpacingMode, "custom">, base: number, count: number, ratio: number): number[] {
  if (mode === "linear") return Array.from({ length: count }, (_, index) => roundPx(base * (index + 1)));
  if (mode === "jumps") return JUMP_MULTIPLIERS.slice(0, count).map((multiplier) => roundPx(base * multiplier));
  if (mode === "fibonacci") return fibonacciMultipliers(count).map((multiplier) => roundPx(base * multiplier));
  return ratioValues(base, count, ratio);
}

function ratioValues(base: number, count: number, ratio: number): number[] {
  // Geometric: base × ratio^i. Snap to whole px when the base is an integer so even
  // bases stay on the pixel grid; otherwise keep half-pixels. If two steps would
  // collide after rounding, bump by 1 px (or 0.5) so the scale still grows — but do
  // not snap every step to base/2, or small ratios (1.01–1.333 with base 4) all look
  // identical (4, 6, 8, 10…).
  const unit = Number.isInteger(roundPx(base)) ? 1 : 0.5;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const raw = base * ratio ** index;
    let next = unit === 1 ? Math.round(raw) : roundPx(raw);
    const previous = values[values.length - 1];
    if (previous !== undefined && next <= previous) next = roundPx(previous + unit);
    values.push(next);
  }
  return values;
}

function fibonacciMultipliers(count: number): number[] {
  const sequence = [1, 2];
  while (sequence.length < count) {
    sequence.push(sequence[sequence.length - 1]! + sequence[sequence.length - 2]!);
  }
  return sequence.slice(0, count);
}

function microPixels(base: number): number[] {
  const half = roundPx(base / 2);
  const values = [half];
  if (base === 4) values.push(6);
  return values;
}

function nameSteps(values: number[], micros: number[], base: number): SpacingStep[] {
  const microSet = new Set(micros);
  const leading = new Set<number>();
  for (const px of values) {
    if (px === 0) continue;
    if (microSet.has(px)) leading.add(px);
    else break;
  }
  let regular = 0;
  let microSlot = 0;
  return values.map((px) => {
    let name = "0";
    if (px !== 0 && leading.has(px)) {
      microSlot += 1;
      name = microSlot === 1 ? "50" : "75";
    } else if (px !== 0) {
      regular += 1;
      name = String(regular * 100);
    }
    return {
      id: `spacing-${name}`,
      name,
      px,
      rem: Math.round((px / 16) * 10000) / 10000,
      micro: microSet.has(px),
      offGrid: px > 0 && !isMultiple(px, base / 2),
    };
  });
}

function strictlyIncreasing(values: number[]): number[] {
  const sorted = values.map((value) => roundPx(value)).filter((value) => Number.isFinite(value) && value >= 0);
  sorted.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    if (unique.length === 0 || value > unique[unique.length - 1]!) unique.push(value);
  }
  if (unique[0] !== 0) unique.unshift(0);
  return unique;
}

function snapshot(scale: SpacingScale): SpacingOrigin | null {
  if (!isGenerated(scale.mode)) return null;
  return {
    mode: scale.mode,
    base: scale.base,
    count: scale.count,
    ratio: scale.ratio,
    micro: scale.micro,
    customValues: [...scale.customValues],
  };
}

function legacyPixels(steps: LooseStep[] | undefined, base: number): { values: number[]; stock: boolean } {
  if (!Array.isArray(steps) || steps.length === 0) return { values: [], stock: true };
  const stock =
    steps.length === LEGACY_MULTIPLIERS.length &&
    steps.every((step, index) => Number(step.multiplier) === LEGACY_MULTIPLIERS[index] && Number(step.px) === base * LEGACY_MULTIPLIERS[index]!);
  const values = steps.map((step) => Number(step.px)).filter((px) => Number.isFinite(px) && px > 0);
  return { values, stock };
}

function normalizeOrigin(raw: SpacingOrigin | null | undefined): SpacingOrigin | null {
  if (!raw || !isGenerated(raw.mode)) return null;
  return {
    mode: raw.mode,
    base: clampInt(raw.base, 1, 64, 4),
    count: clampInt(raw.count, 4, 16, 10),
    ratio: clampRatio(raw.ratio),
    micro: Boolean(raw.micro),
    customValues: sanitizeValues(raw.customValues),
  };
}

function sanitizeValues(values: number[] | undefined): number[] {
  return strictlyIncreasing((values ?? []).map((value) => Number(value))).filter((value) => value > 0 && value <= 4096).slice(0, 32);
}

function isMultiple(value: number, quantum: number): boolean {
  if (!(quantum > 0)) return true;
  const units = value / quantum;
  return Math.abs(units - Math.round(units)) < 1e-6;
}

function roundPx(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 2) / 2;
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function clampRatio(value: number | undefined): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return 1.5;
  return Math.round(Math.min(4, Math.max(1.01, next)) * 1000) / 1000;
}

function isMode(value: unknown): value is SpacingMode {
  return typeof value === "string" && MODES.includes(value as SpacingMode);
}

function isGenerated(value: SpacingMode): value is (typeof GENERATED_MODES)[number] {
  return (GENERATED_MODES as readonly string[]).includes(value);
}
