import {
  addCustomValue,
  configureSpacing,
  createSpacingScale,
  editSpacingValue,
  formatSpacingPx,
  formatSpacingRem,
  normalizeSpacing,
  removeCustomValue,
  restoreSpacing,
  selectSpacingMode,
} from "./spacing";
import type { BlurScale, SpacingMode, SpacingScale, SpacingStep } from "./types";

/** Positive blur radii only. Step 0 (no blur) sits outside this range. */
export const BLUR_COUNT_MIN = 1;
export const BLUR_COUNT_MAX = 4;

export type BlurSpecimen = {
  id: "tooltip" | "topnav" | "popover" | "overlay";
  label: string;
  note: string;
  token: string;
  px: number;
};

type BlurPatch = {
  base?: number;
  mode?: SpacingMode;
  count?: number;
  ratio?: number;
  customValues?: number[];
  customFrom?: BlurScale["customFrom"];
  edited?: boolean;
};

function clampCount(value: number | undefined): number {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return BLUR_COUNT_MAX;
  return Math.min(BLUR_COUNT_MAX, Math.max(BLUR_COUNT_MIN, next));
}

/** Spacing cannot generate fewer than 4 steps, so blur builds 4 and keeps the first N. */
function limit(scale: SpacingScale, count: number): BlurScale {
  const wanted = clampCount(count);
  const zero = scale.steps.find((step) => step.px === 0);
  const positive = scale.steps.filter((step) => step.px > 0).slice(0, scale.mode === "custom" ? BLUR_COUNT_MAX : wanted);
  const customFrom = scale.customFrom ? { ...scale.customFrom, count: clampCount(scale.customFrom.count) } : null;
  return {
    ...scale,
    micro: false,
    count: wanted,
    steps: [...(zero ? [zero] : []), ...positive].map((step) => ({ ...step, id: `blur-${step.name}` })),
    customValues: scale.mode === "custom" ? positive.map((step) => step.px) : scale.customValues.slice(0, BLUR_COUNT_MAX),
    customFrom,
  };
}

export function createBlurScale(): BlurScale {
  return limit(configureSpacing(createSpacingScale(), { count: BLUR_COUNT_MAX, micro: false }), BLUR_COUNT_MAX);
}

export function configureBlur(scale: BlurScale, patch: BlurPatch): BlurScale {
  const count = clampCount(patch.count ?? scale.count);
  const customValues = (patch.customValues ?? scale.customValues).slice(0, BLUR_COUNT_MAX);
  const next = configureSpacing({ ...scale, micro: false }, { ...patch, micro: false, count: Math.max(4, count), customValues });
  return limit(next, count);
}

export function selectBlurMode(scale: BlurScale, mode: SpacingMode): BlurScale {
  const count = clampCount(scale.count);
  const next = selectSpacingMode({ ...scale, micro: false, count: Math.max(4, count) }, mode);
  return limit(next, count);
}

export type BlurEditResult =
  | { ok: true; scale: BlurScale; changed: boolean }
  | { ok: false; reason: "invalid" | "duplicate" };

function keepCount(scale: SpacingScale, count: number): SpacingScale {
  if (!scale.customFrom) return scale;
  return { ...scale, customFrom: { ...scale.customFrom, count } };
}

export function editBlurValue(scale: BlurScale, stepName: string, raw: number): BlurEditResult {
  if (stepName === "0") return { ok: false, reason: "invalid" };
  const count = clampCount(scale.count);
  const result = editSpacingValue({ ...scale, micro: false }, stepName, raw);
  if (!result.ok) return result;
  return { ok: true, changed: result.changed, scale: limit(keepCount(result.scale, count), count) };
}

export function addBlurValue(scale: BlurScale): BlurScale {
  if (scale.steps.filter((step) => step.px > 0).length >= BLUR_COUNT_MAX) return scale;
  const count = clampCount(scale.count);
  return limit(keepCount(addCustomValue({ ...scale, micro: false }), count), count);
}

export function removeBlurValue(scale: BlurScale, stepName: string): BlurScale {
  if (scale.steps.filter((step) => step.px > 0).length <= BLUR_COUNT_MIN) return scale;
  const count = clampCount(scale.count);
  return limit(keepCount(removeCustomValue({ ...scale, micro: false }, stepName), count), count);
}

export function restoreBlur(scale: BlurScale): BlurScale {
  const count = clampCount(scale.customFrom?.count ?? scale.count);
  return limit(restoreSpacing({ ...scale, micro: false }), count);
}

export function normalizeBlur(raw: Partial<BlurScale> | null | undefined): BlurScale {
  if (!raw || typeof raw !== "object" || !raw.mode) return createBlurScale();
  const count = clampCount(raw.count);
  const spacing = normalizeSpacing({ ...raw, micro: false, count: Math.max(4, count) });
  return limit(spacing, count);
}

export function blurDtcg(scale: BlurScale): { blur: Record<string, { $type: "dimension"; $value: string; $extensions: { "com.dsfoundry.rem": string } }> } {
  const blur: Record<string, { $type: "dimension"; $value: string; $extensions: { "com.dsfoundry.rem": string } }> = {};
  for (const step of scale.steps) {
    blur[step.name] = {
      $type: "dimension",
      $value: `${formatSpacingPx(step.px)}px`,
      $extensions: { "com.dsfoundry.rem": formatSpacingRem(step.px) },
    };
  }
  return { blur };
}

export function blurSpecimens(scale: BlurScale): BlurSpecimen[] {
  const steps = scale.steps.filter((step) => step.px > 0);
  const at = (fraction: number): SpacingStep => {
    if (steps.length === 0) return scale.steps[0] ?? { id: "blur-0", name: "0", px: 0, rem: 0, micro: false, offGrid: false };
    const index = Math.min(steps.length - 1, Math.max(0, Math.round((steps.length - 1) * fraction)));
    return steps[index]!;
  };
  const tooltip = at(0);
  const topnav = at(0.34);
  const popover = at(0.67);
  const overlay = at(1);
  return [
    { id: "tooltip", label: "Tooltip", note: "A small bubble uses the smallest step, so the page behind stays readable.", token: `blur/${tooltip.name}`, px: tooltip.px },
    { id: "topnav", label: "Top nav", note: "A bar pinned to the top softens the content that scrolls under it.", token: `blur/${topnav.name}`, px: topnav.px },
    { id: "popover", label: "Popover", note: "A floating menu uses a larger step to separate it from the page.", token: `blur/${popover.name}`, px: popover.px },
    { id: "overlay", label: "Overlay", note: "A loading veil hides the content behind it, so it uses the largest step.", token: `blur/${overlay.name}`, px: overlay.px },
  ];
}
