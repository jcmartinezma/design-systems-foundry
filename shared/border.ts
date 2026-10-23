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
import type { BorderScale, SpacingMode, SpacingScale, SpacingStep } from "./types";

/** Positive stroke widths only. There is no 0 px step. */
export const BORDER_COUNT_MIN = 2;
export const BORDER_COUNT_MAX = 4;

export type BorderSpecimen = {
  id: "divider" | "field" | "card" | "focus";
  label: string;
  note: string;
  token: string;
  px: number;
};

type BorderPatch = {
  base?: number;
  mode?: SpacingMode;
  count?: number;
  ratio?: number;
  customValues?: number[];
  customFrom?: BorderScale["customFrom"];
  edited?: boolean;
};

function clampCount(value: number | undefined): number {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return BORDER_COUNT_MAX;
  return Math.min(BORDER_COUNT_MAX, Math.max(BORDER_COUNT_MIN, next));
}

/** Spacing cannot generate fewer than 4 steps, so border builds 4 and keeps the first N. */
function limit(scale: SpacingScale, count: number): BorderScale {
  const wanted = clampCount(count);
  const positive = scale.steps.filter((step) => step.px > 0).slice(0, scale.mode === "custom" ? BORDER_COUNT_MAX : wanted);
  const customFrom = scale.customFrom ? { ...scale.customFrom, count: clampCount(scale.customFrom.count) } : null;
  return {
    ...scale,
    micro: false,
    count: wanted,
    steps: positive.map((step) => ({ ...step, id: `border-${step.name}` })),
    customValues: scale.mode === "custom" ? positive.map((step) => step.px) : scale.customValues.slice(0, BORDER_COUNT_MAX),
    customFrom,
  };
}

export function createBorderScale(): BorderScale {
  return limit(
    configureSpacing(createSpacingScale(), { base: 1, mode: "linear", count: BORDER_COUNT_MAX, ratio: 2, micro: false }),
    BORDER_COUNT_MAX,
  );
}

export function configureBorder(scale: BorderScale, patch: BorderPatch): BorderScale {
  const count = clampCount(patch.count ?? scale.count);
  const customValues = (patch.customValues ?? scale.customValues).slice(0, BORDER_COUNT_MAX);
  const next = configureSpacing({ ...scale, micro: false }, { ...patch, micro: false, count: Math.max(4, count), customValues });
  return limit(next, count);
}

export function selectBorderMode(scale: BorderScale, mode: SpacingMode): BorderScale {
  const count = clampCount(scale.count);
  const next = selectSpacingMode({ ...scale, micro: false, count }, mode);
  return limit(next, count);
}

export type BorderEditResult =
  | { ok: true; scale: BorderScale; changed: boolean }
  | { ok: false; reason: "invalid" | "duplicate" };

function keepCount(scale: SpacingScale, count: number): SpacingScale {
  if (!scale.customFrom) return scale;
  return { ...scale, customFrom: { ...scale.customFrom, count } };
}

export function editBorderValue(scale: BorderScale, stepName: string, raw: number): BorderEditResult {
  const count = clampCount(scale.count);
  const result = editSpacingValue({ ...scale, micro: false }, stepName, raw);
  if (!result.ok) return result;
  return { ok: true, changed: result.changed, scale: limit(keepCount(result.scale, count), count) };
}

export function addBorderValue(scale: BorderScale): BorderScale {
  if (scale.steps.filter((step) => step.px > 0).length >= BORDER_COUNT_MAX) return scale;
  const count = clampCount(scale.count);
  return limit(keepCount(addCustomValue({ ...scale, micro: false }), count), count);
}

export function removeBorderValue(scale: BorderScale, stepName: string): BorderScale {
  if (scale.steps.filter((step) => step.px > 0).length <= BORDER_COUNT_MIN) return scale;
  const count = clampCount(scale.count);
  return limit(keepCount(removeCustomValue({ ...scale, micro: false }, stepName), count), count);
}

export function restoreBorder(scale: BorderScale): BorderScale {
  const count = clampCount(scale.customFrom?.count ?? scale.count);
  return limit(restoreSpacing({ ...scale, micro: false }), count);
}

export function normalizeBorder(raw: Partial<BorderScale> | null | undefined): BorderScale {
  if (!raw || typeof raw !== "object" || !raw.mode) return createBorderScale();
  const count = clampCount(raw.count);
  const spacing = normalizeSpacing({ ...raw, micro: false, count: Math.max(4, count) });
  return limit(spacing, count);
}

export function borderDtcg(scale: BorderScale): { border: Record<string, { $type: "dimension"; $value: string; $extensions: { "com.dsfoundry.rem": string } }> } {
  const border: Record<string, { $type: "dimension"; $value: string; $extensions: { "com.dsfoundry.rem": string } }> = {};
  for (const step of scale.steps) {
    border[step.name] = {
      $type: "dimension",
      $value: `${formatSpacingPx(step.px)}px`,
      $extensions: { "com.dsfoundry.rem": formatSpacingRem(step.px) },
    };
  }
  return { border };
}

export function borderSpecimens(scale: BorderScale): BorderSpecimen[] {
  const steps = scale.steps.filter((step) => step.px > 0);
  const at = (fraction: number): SpacingStep => {
    if (steps.length === 0) return { id: "border-100", name: "100", px: 1, rem: 0.0625, micro: false, offGrid: false };
    const index = Math.min(steps.length - 1, Math.max(0, Math.round((steps.length - 1) * fraction)));
    return steps[index]!;
  };
  const hair = at(0);
  const control = at(0.34);
  const card = at(0.67);
  const strong = at(1);
  return [
    { id: "divider", label: "Divider", note: "Rules and separators use the thinnest step.", token: `border/${hair.name}`, px: hair.px },
    { id: "field", label: "Field", note: "Inputs use a light stroke.", token: `border/${control.name}`, px: control.px },
    { id: "card", label: "Card", note: "Cards use a middle step.", token: `border/${card.name}`, px: card.px },
    { id: "focus", label: "Focus", note: "A selected edge uses the thickest step.", token: `border/${strong.name}`, px: strong.px },
  ];
}
