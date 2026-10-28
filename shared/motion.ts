import type { MotionCurve, MotionCurveKind, MotionDuration, MotionScale } from "./types";

export const MAX_MOTION_CURVES = 6;

export const CURVE_PRESET_KINDS = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"] as const;

export type MotionCurvePresetKind = (typeof CURVE_PRESET_KINDS)[number];

export const CURVE_PRESETS: Record<
  MotionCurvePresetKind,
  { values: [number, number, number, number]; css: string }
> = {
  linear: { values: [0, 0, 1, 1], css: "linear" },
  ease: { values: [0.25, 0.1, 0.25, 1], css: "ease" },
  "ease-in": { values: [0.42, 0, 1, 1], css: "ease-in" },
  "ease-out": { values: [0, 0, 0.58, 1], css: "ease-out" },
  "ease-in-out": { values: [0.42, 0, 0.58, 1], css: "ease-in-out" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Place in the list: 0, then 100, 200, 300… */
export function motionKey(index: number): string {
  const place = Math.max(0, Math.round(index));
  return place === 0 ? "0" : String(place * 100);
}

/** Step 0 is 0 ms. Step 1 is the base. Each step after that multiplies by the ratio. */
export function durationMs(baseMs: number, ratio: number, step: number): number {
  const place = Math.round(step);
  if (place <= 0) return 0;
  const base = clamp(Math.round(finite(baseMs, 0)), 0, 1000);
  const power = clamp(finite(ratio, 1.5), 1.05, 2) ** (place - 1);
  return clamp(Math.round(base * power), 0, 4000);
}

export function generateTimes(input: {
  baseMs: number;
  ratio: number;
  count: number;
  previous?: MotionDuration[];
}): MotionDuration[] {
  const count = clamp(Math.round(finite(input.count, 3)), 1, 8);
  const ratio = Math.round(clamp(finite(input.ratio, 1.5), 1.05, 2) * 1000) / 1000;
  const baseMs = clamp(Math.round(finite(input.baseMs, 0)), 0, 1000);
  const steps: MotionDuration[] = [];
  for (let index = 0; index <= count; index += 1) {
    const previous = input.previous?.[index];
    steps.push({
      id: previous?.id || crypto.randomUUID(),
      name: motionKey(index),
      ms: durationMs(baseMs, ratio, index),
      step: index,
    });
  }
  return steps;
}

export function formatCurveValues(values: [number, number, number, number]): string {
  return values.map(formatCurveNumber).join(", ");
}

function formatCurveNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function formatCubicBezier(values: [number, number, number, number]): string {
  return `cubic-bezier(${formatCurveValues(values)})`;
}

export function curveCss(kind: MotionCurveKind, values: [number, number, number, number]): string {
  if (kind !== "custom" && kind in CURVE_PRESETS) {
    return CURVE_PRESETS[kind as MotionCurvePresetKind].css;
  }
  return formatCubicBezier(values);
}

export function parseCurveValues(raw: string): [number, number, number, number] | null {
  const parts = raw
    .trim()
    .replace(/^cubic-bezier\(/i, "")
    .replace(/\)$/, "")
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 4) return null;
  const values = parts.map((part) => Number(part));
  if (values.some((value) => !Number.isFinite(value))) return null;
  return values.map((value) => Math.round(value * 1000) / 1000) as [number, number, number, number];
}

function sameValues(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a.every((value, index) => Math.abs(value - b[index]) < 0.0005);
}

function isPresetKind(value: string): value is MotionCurvePresetKind {
  return (CURVE_PRESET_KINDS as readonly string[]).includes(value);
}

export function makePresetCurve(kind: MotionCurvePresetKind, id: string = crypto.randomUUID()): MotionCurve {
  const preset = CURVE_PRESETS[kind];
  return {
    id,
    name: kind,
    kind,
    values: [...preset.values] as [number, number, number, number],
    curve: preset.css,
  };
}

export function makeCustomCurve(
  name: string,
  values: [number, number, number, number],
  id: string = crypto.randomUUID(),
): MotionCurve {
  return {
    id,
    name,
    kind: "custom",
    values: [...values] as [number, number, number, number],
    curve: formatCubicBezier(values),
  };
}

export function nextCustomCurveName(curves: MotionCurve[]): string {
  const used = new Set(curves.map((item) => normalizeCurveName(item.name)));
  let place = 1;
  while (used.has(String(place * 100))) place += 1;
  return String(place * 100);
}

export function normalizeCurveName(name: string): string {
  return name.trim().toLowerCase();
}

export function isCurveNameTaken(curves: MotionCurve[], name: string, exceptId?: string): boolean {
  const key = normalizeCurveName(name);
  if (!key) return false;
  return curves.some((item) => item.id !== exceptId && normalizeCurveName(item.name) === key);
}

function ensureLinearCurve(curves: MotionCurve[]): MotionCurve[] {
  const linear = curves.find((item) => item.kind === "linear");
  const rest = curves.filter((item) => item.kind !== "linear");
  if (linear) {
    const locked: MotionCurve = {
      ...linear,
      name: "linear",
      kind: "linear",
      values: [...CURVE_PRESETS.linear.values] as [number, number, number, number],
      curve: "linear",
    };
    return [locked, ...rest].slice(0, MAX_MOTION_CURVES);
  }
  return [makePresetCurve("linear"), ...rest].slice(0, MAX_MOTION_CURVES);
}

function usedPresetKinds(curves: MotionCurve[], exceptId?: string): Set<MotionCurvePresetKind> {
  const used = new Set<MotionCurvePresetKind>();
  for (const item of curves) {
    if (item.id === exceptId) continue;
    if (item.kind !== "custom") used.add(item.kind);
  }
  return used;
}

export function availableCurveKinds(curves: MotionCurve[], exceptId?: string): MotionCurveKind[] {
  const current = curves.find((item) => item.id === exceptId);
  if (current?.kind === "linear") return ["linear"];

  const used = usedPresetKinds(curves, exceptId);
  const presets = CURVE_PRESET_KINDS.filter((kind) => kind !== "linear" && (!used.has(kind) || current?.kind === kind));
  return [...presets, "custom"];
}

export function addMotionCurve(scale: MotionScale): MotionScale {
  if (scale.curves.length >= MAX_MOTION_CURVES) return scale;
  const used = usedPresetKinds(scale.curves);
  const nextKind = CURVE_PRESET_KINDS.find((kind) => kind !== "linear" && !used.has(kind));
  const curve = nextKind
    ? makePresetCurve(nextKind)
    : makeCustomCurve(nextCustomCurveName(scale.curves), [...CURVE_PRESETS.ease.values]);
  return { ...scale, curves: ensureLinearCurve([...scale.curves, curve]) };
}

export function removeMotionCurve(scale: MotionScale, id: string): MotionScale {
  const target = scale.curves.find((item) => item.id === id);
  if (!target || target.kind === "linear") return scale;
  return { ...scale, curves: ensureLinearCurve(scale.curves.filter((item) => item.id !== id)) };
}

export function setMotionCurveKind(scale: MotionScale, id: string, kind: MotionCurveKind): MotionScale {
  const target = scale.curves.find((item) => item.id === id);
  if (!target) return scale;
  if (target.kind === "linear" && kind !== "linear") return scale;
  if (kind === "linear" && target.kind !== "linear") return scale;
  if (kind !== "custom" && isCurveNameTaken(scale.curves, kind, id)) return scale;

  const next: MotionCurve =
    kind === "custom"
      ? makeCustomCurve(
          target.kind === "custom" ? target.name : nextCustomCurveName(scale.curves.filter((item) => item.id !== id)),
          target.values,
          target.id,
        )
      : { ...makePresetCurve(kind, target.id) };

  return {
    ...scale,
    curves: ensureLinearCurve(scale.curves.map((item) => (item.id === id ? next : item))),
  };
}

export function setMotionCurveValues(
  scale: MotionScale,
  id: string,
  values: [number, number, number, number],
): MotionScale {
  const target = scale.curves.find((item) => item.id === id);
  if (!target) return scale;

  if (target.kind === "linear") return scale;

  if (target.kind === "custom") {
    if (sameValues(target.values, values)) return scale;
    return {
      ...scale,
      curves: scale.curves.map((item) => (item.id === id ? makeCustomCurve(item.name, values, item.id) : item)),
    };
  }

  if (sameValues(target.values, values)) return scale;

  const others = scale.curves.filter((item) => item.id !== id);
  const next = makeCustomCurve(nextCustomCurveName(others), values, target.id);
  return { ...scale, curves: ensureLinearCurve(scale.curves.map((item) => (item.id === id ? next : item))) };
}

export type RenameCurveResult =
  | { ok: true; scale: MotionScale }
  | { ok: false; reason: "empty" | "duplicate" | "locked" };

export function renameMotionCurve(scale: MotionScale, id: string, rawName: string): RenameCurveResult {
  const target = scale.curves.find((item) => item.id === id);
  if (!target) return { ok: false, reason: "empty" };
  if (target.kind !== "custom") return { ok: false, reason: "locked" };

  const name = rawName.trim().slice(0, 48);
  if (!name) return { ok: false, reason: "empty" };
  if (isCurveNameTaken(scale.curves, name, id)) return { ok: false, reason: "duplicate" };

  return {
    ok: true,
    scale: {
      ...scale,
      curves: scale.curves.map((item) => (item.id === id ? { ...item, name } : item)),
    },
  };
}

function parseLegacyCurve(raw: unknown): { kind: MotionCurveKind; values: [number, number, number, number]; curve: string; name?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    id?: string;
    name?: string;
    kind?: string;
    curve?: string;
    values?: unknown;
  };

  if (Array.isArray(item.values) && item.values.length === 4) {
    const values = item.values.map((value) => Math.round(Number(value) * 1000) / 1000) as [number, number, number, number];
    if (values.some((value) => !Number.isFinite(value))) return null;
    if (item.kind === "custom") {
      return { kind: "custom", values, curve: formatCubicBezier(values), name: String(item.name ?? "").trim() || undefined };
    }
    if (isPresetKind(String(item.kind ?? "")) && String(item.kind) !== "custom") {
      const kind = item.kind as MotionCurvePresetKind;
      return { kind, values: [...CURVE_PRESETS[kind].values], curve: CURVE_PRESETS[kind].css, name: kind };
    }
  }

  const curveText = String(item.curve ?? "").trim().slice(0, 80);
  if (!curveText) return null;

  if (isPresetKind(curveText)) {
    const preset = CURVE_PRESETS[curveText];
    return { kind: curveText, values: [...preset.values], curve: preset.css, name: curveText };
  }

  const values = parseCurveValues(curveText);
  if (!values) {
    return { kind: "custom", values: [...CURVE_PRESETS.ease.values], curve: curveText, name: String(item.name ?? "").trim() || undefined };
  }

  for (const kind of CURVE_PRESET_KINDS) {
    if (sameValues(values, CURVE_PRESETS[kind].values)) {
      return { kind, values: [...CURVE_PRESETS[kind].values], curve: CURVE_PRESETS[kind].css, name: kind };
    }
  }

  return { kind: "custom", values, curve: formatCubicBezier(values), name: String(item.name ?? "").trim() || undefined };
}

function normalizeCurves(raw: unknown): MotionCurve[] {
  const source = Array.isArray(raw) ? raw.slice(0, MAX_MOTION_CURVES) : [];
  const curves: MotionCurve[] = [];
  const usedNames = new Set<string>();
  const usedKinds = new Set<MotionCurvePresetKind>();

  for (const entry of source) {
    const parsed = parseLegacyCurve(entry);
    if (!parsed) continue;
    const id = (entry as { id?: string }).id || crypto.randomUUID();

    if (parsed.kind !== "custom") {
      if (usedKinds.has(parsed.kind)) continue;
      usedKinds.add(parsed.kind);
      usedNames.add(parsed.kind);
      curves.push(makePresetCurve(parsed.kind, id));
      continue;
    }

    let name = parsed.name && !isPresetKind(normalizeCurveName(parsed.name)) ? parsed.name : "";
    if (!name || usedNames.has(normalizeCurveName(name))) {
      let place = 1;
      while (usedNames.has(String(place * 100))) place += 1;
      name = String(place * 100);
    }
    usedNames.add(normalizeCurveName(name));
    curves.push(makeCustomCurve(name, parsed.values, id));
  }

  return ensureLinearCurve(curves);
}

export function createMotionScale(): MotionScale {
  const scale: MotionScale = {
    baseMs: 160,
    baseDelay: 80,
    ratio: 1.5,
    count: 3,
    durations: [],
    delays: [],
    curves: [makePresetCurve("linear")],
  };
  return {
    ...scale,
    durations: generateTimes(scale),
    delays: generateTimes({ ...scale, baseMs: scale.baseDelay }),
  };
}

export function normalizeMotion(
  raw:
    | (Partial<Omit<MotionScale, "curves">> & {
        curves?: unknown;
        easings?: unknown;
      })
    | null
    | undefined,
): MotionScale {
  if (!raw) return createMotionScale();
  const legacy = raw;
  const count = clamp(Math.round(finite(Number(raw.count), 3)), 1, 8);
  const ratio = Math.round(clamp(finite(Number(raw.ratio), 1.5), 1.05, 2) * 1000) / 1000;
  const baseMs = clamp(Math.round(finite(Number(raw.baseMs), 160)), 40, 1000);
  const baseDelay = clamp(Math.round(finite(Number(raw.baseDelay), 80)), 0, 1000);
  const previousDurations = Array.isArray(raw.durations) ? raw.durations : [];
  const previousDelays = Array.isArray(raw.delays) ? raw.delays : [];
  return {
    baseMs,
    baseDelay,
    ratio,
    count,
    durations: generateTimes({ baseMs, ratio, count, previous: previousDurations }),
    delays: generateTimes({ baseMs: baseDelay, ratio, count, previous: previousDelays }),
    curves: normalizeCurves(raw.curves ?? legacy.easings),
  };
}
