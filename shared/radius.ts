import {
  configureSpacing,
  createSpacingScale,
  editSpacingValue,
  formatSpacingPx,
  formatSpacingRem,
  normalizeSpacing,
  addCustomValue,
  removeCustomValue,
  restoreSpacing,
  selectSpacingMode,
} from "./spacing";
import type { RadiusScale, SpacingMode, SpacingScale, SpacingStep } from "./types";

/** A pill corner. Larger than any generated step, so the shape — not this number — decides the curve. */
export const FULL_PX = 9999;

/** Positive corners only. Step 0 and radius/full sit outside this range. */
export const RADIUS_COUNT_MIN = 1;
export const RADIUS_COUNT_MAX = 4;

export type RadiusSpecimen = {
  id: "button" | "field" | "card" | "dialog" | "chip" | "avatar";
  label: string;
  note: string;
  token: string;
  px: number;
  pill: boolean;
};

type RadiusPatch = {
  base?: number;
  mode?: SpacingMode;
  count?: number;
  ratio?: number;
  full?: boolean;
  customValues?: number[];
  customFrom?: RadiusScale["customFrom"];
  edited?: boolean;
};

function clampCount(value: number | undefined): number {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return RADIUS_COUNT_MAX;
  return Math.min(RADIUS_COUNT_MAX, Math.max(RADIUS_COUNT_MIN, next));
}

/** Spacing cannot generate fewer than 4 steps, so radius builds 4 and keeps the first N. */
function limit(scale: SpacingScale, count: number): SpacingScale {
  const wanted = clampCount(count);
  const zero = scale.steps.find((step) => step.px === 0);
  const positive = scale.steps.filter((step) => step.px > 0).slice(0, scale.mode === "custom" ? RADIUS_COUNT_MAX : wanted);
  const customFrom = scale.customFrom ? { ...scale.customFrom, count: clampCount(scale.customFrom.count) } : null;
  return {
    ...scale,
    count: wanted,
    steps: [...(zero ? [zero] : []), ...positive],
    customValues: scale.mode === "custom" ? positive.map((step) => step.px) : scale.customValues.slice(0, RADIUS_COUNT_MAX),
    customFrom,
  };
}

function shape(scale: SpacingScale, full: boolean, count?: number): RadiusScale {
  const limited = limit(scale, count ?? scale.count);
  return {
    ...limited,
    micro: false,
    full,
    steps: limited.steps.map((step) => ({ ...step, id: `radius-${step.name}` })),
  };
}

export function createRadiusScale(): RadiusScale {
  return shape(configureSpacing(createSpacingScale(), { count: RADIUS_COUNT_MAX, micro: false }), true, RADIUS_COUNT_MAX);
}

export function configureRadius(scale: RadiusScale, patch: RadiusPatch): RadiusScale {
  const full = patch.full ?? scale.full;
  const count = clampCount(patch.count ?? scale.count);
  const customValues = (patch.customValues ?? scale.customValues).slice(0, RADIUS_COUNT_MAX);
  const next = configureSpacing({ ...scale, micro: false }, { ...patch, micro: false, count: Math.max(4, count), customValues });
  return shape(next, full, count);
}

export function selectRadiusMode(scale: RadiusScale, mode: SpacingMode): RadiusScale {
  const count = clampCount(scale.count);
  const next = selectSpacingMode({ ...scale, micro: false, count: Math.max(4, count) }, mode);
  return shape(next, scale.full, count);
}

export type RadiusEditResult =
  | { ok: true; scale: RadiusScale; changed: boolean }
  | { ok: false; reason: "invalid" | "duplicate" };

function keepCount(scale: SpacingScale, count: number): SpacingScale {
  if (!scale.customFrom) return scale;
  return { ...scale, customFrom: { ...scale.customFrom, count } };
}

export function editRadiusValue(scale: RadiusScale, stepName: string, raw: number): RadiusEditResult {
  if (stepName === "0" || stepName === "full") return { ok: false, reason: "invalid" };
  const count = clampCount(scale.count);
  const result = editSpacingValue({ ...scale, micro: false }, stepName, raw);
  if (!result.ok) return result;
  return { ok: true, changed: result.changed, scale: shape(keepCount(result.scale, count), scale.full, count) };
}

export function addRadiusValue(scale: RadiusScale): RadiusScale {
  if (scale.steps.filter((step) => step.px > 0).length >= RADIUS_COUNT_MAX) return scale;
  const count = clampCount(scale.count);
  return shape(keepCount(addCustomValue({ ...scale, micro: false }), count), scale.full, count);
}

export function removeRadiusValue(scale: RadiusScale, stepName: string): RadiusScale {
  if (scale.steps.filter((step) => step.px > 0).length <= RADIUS_COUNT_MIN) return scale;
  const count = clampCount(scale.count);
  return shape(keepCount(removeCustomValue({ ...scale, micro: false }, stepName), count), scale.full, count);
}

export function restoreRadius(scale: RadiusScale): RadiusScale {
  const count = clampCount(scale.customFrom?.count ?? scale.count);
  return shape(restoreSpacing({ ...scale, micro: false }), scale.full, count);
}

export function normalizeRadius(raw: Partial<RadiusScale> | null | undefined): RadiusScale {
  if (!raw || typeof raw !== "object" || !raw.mode) return createRadiusScale();
  const full = typeof raw.full === "boolean" ? raw.full : true;
  const count = clampCount(raw.count);
  const spacing = normalizeSpacing({ ...raw, micro: false, count: Math.max(4, count) });
  return shape(spacing, full, count);
}

export type RadiusDimension = { name: string; px: number; pill: boolean };

export function radiusDimensions(scale: RadiusScale): RadiusDimension[] {
  const steps = scale.steps.map((step) => ({ name: step.name, px: step.px, pill: false }));
  if (scale.full) steps.push({ name: "full", px: FULL_PX, pill: true });
  return steps;
}

export function radiusDtcg(scale: RadiusScale): { radius: Record<string, { $type: "dimension"; $value: string; $extensions: { "com.dsfoundry.rem": string } }> } {
  const radius: Record<string, { $type: "dimension"; $value: string; $extensions: { "com.dsfoundry.rem": string } }> = {};
  for (const step of radiusDimensions(scale)) {
    radius[step.name] = {
      $type: "dimension",
      $value: `${formatSpacingPx(step.px)}px`,
      $extensions: { "com.dsfoundry.rem": formatSpacingRem(step.px) },
    };
  }
  return { radius };
}

export function radiusSpecimens(scale: RadiusScale): RadiusSpecimen[] {
  const steps = scale.steps.filter((step) => step.px > 0);
  const at = (fraction: number): SpacingStep => {
    if (steps.length === 0) return scale.steps[0] ?? { id: "radius-0", name: "0", px: 0, rem: 0, micro: false, offGrid: false };
    const index = Math.min(steps.length - 1, Math.max(0, Math.round((steps.length - 1) * fraction)));
    return steps[index]!;
  };
  const small = at(0);
  const mid = at(0.45);
  const dialog = at(0.85);
  const largest = at(1);
  const round = scale.full ? { name: "full", px: FULL_PX, pill: true } : { name: largest.name, px: largest.px, pill: false };
  return [
    { id: "button", label: "Button", note: "Controls use a small step.", token: `radius/${small.name}`, px: small.px, pill: false },
    { id: "field", label: "Field", note: "Fields share that small step.", token: `radius/${small.name}`, px: small.px, pill: false },
    { id: "card", label: "Card", note: "Cards use a middle step.", token: `radius/${mid.name}`, px: mid.px, pill: false },
    {
      id: "dialog",
      label: "Dialog",
      note: "The window uses a larger step. Buttons inside keep the small one.",
      token: `radius/${dialog.name}`,
      px: dialog.px,
      pill: false,
    },
    {
      id: "chip",
      label: "Chip",
      note: scale.full ? "Chips use Full, so the ends are round." : "Full is off, so the chip uses the largest step.",
      token: `radius/${round.name}`,
      px: round.px,
      pill: round.pill,
    },
    {
      id: "avatar",
      label: "Avatar",
      note: scale.full ? "Avatars use Full and become a circle." : "Full is off, so the avatar uses the largest step.",
      token: `radius/${round.name}`,
      px: round.px,
      pill: round.pill,
    },
  ];
}
