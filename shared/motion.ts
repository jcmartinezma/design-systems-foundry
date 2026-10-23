import type { MotionCurve, MotionDuration, MotionScale } from "./types";

const CURVE_COUNT = 4;
const DEFAULT_CURVES = [
  "cubic-bezier(0.2, 0, 0, 1)",
  "cubic-bezier(0, 0, 0, 1)",
  "cubic-bezier(0.4, 0, 1, 1)",
  "linear",
];

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

function defaultCurves(): MotionCurve[] {
  return DEFAULT_CURVES.map((curve, index) => ({
    id: crypto.randomUUID(),
    name: motionKey(index),
    curve,
  }));
}

export function createMotionScale(): MotionScale {
  const scale: MotionScale = {
    baseMs: 160,
    baseDelay: 80,
    ratio: 1.5,
    count: 3,
    durations: [],
    delays: [],
    curves: defaultCurves(),
  };
  return {
    ...scale,
    durations: generateTimes(scale),
    delays: generateTimes({ ...scale, baseMs: scale.baseDelay }),
  };
}

function normalizeCurves(raw: unknown): MotionCurve[] {
  const source = Array.isArray(raw) ? raw.slice(0, CURVE_COUNT) : [];
  return DEFAULT_CURVES.map((fallback, index) => {
    const item = source[index] as { id?: string; curve?: string } | undefined;
    const curve = String(item?.curve ?? fallback).trim().slice(0, 80) || fallback;
    return {
      id: item?.id || crypto.randomUUID(),
      name: motionKey(index),
      curve,
    };
  });
}

export function normalizeMotion(
  raw: (Partial<MotionScale> & { easings?: { id?: string; curve?: string }[] }) | null | undefined,
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
