import { clampChroma, converter, formatHex, parse } from "culori";
import { apcaContrast } from "./apca";
import type { Ramp, Stop } from "./types";

const toRgb = converter("rgb");
const toOklch = converter("oklch");

export type Rgb = { r: number; g: number; b: number; a: number };

export type SolvedColor = {
  l: number;
  c: number;
  h: number;
  hex: string;
  rgb: Rgb;
  clipped: boolean;
  channels: { r: number; g: number; b: number };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function fromOklch(l: number, c: number, h: number): SolvedColor {
  const safeL = clamp(l, 0, 1);
  const safeC = Math.max(0, c);
  const safeH = wrapHue(h);
  const source = { mode: "oklch" as const, l: safeL, c: safeC, h: safeH };
  const mapped = clampChroma(source, "oklch");
  const hex = formatHex(mapped) ?? "#000000";
  const rgb = toRgb(mapped) ?? { mode: "rgb" as const, r: 0, g: 0, b: 0 };
  const red = rgb.r ?? 0;
  const green = rgb.g ?? 0;
  const blue = rgb.b ?? 0;

  return {
    l: mapped.l ?? safeL,
    c: mapped.c ?? 0,
    h: mapped.h ?? safeH,
    hex,
    clipped: (mapped.c ?? 0) < safeC - 0.004,
    rgb: { r: red, g: green, b: blue, a: 1 },
    channels: {
      r: Math.round(red * 255),
      g: Math.round(green * 255),
      b: Math.round(blue * 255),
    },
  };
}

export function hexToOklch(hex: string): { l: number; c: number; h: number } | null {
  const parsed = parse(hex);
  if (!parsed) return null;
  const oklch = toOklch(parsed);
  if (!oklch) return null;
  return {
    l: oklch.l ?? 0,
    c: oklch.c ?? 0,
    h: oklch.h ?? 0,
  };
}

export function normalizeHex(input: string): string | null {
  const parsed = parse(input.trim());
  if (!parsed) return null;
  return formatHex(parsed) ?? null;
}

const STEP_PRESETS: Record<number, string[]> = {
  6: ["50", "100", "300", "500", "700", "900"],
  10: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"],
  11: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"],
};

export function namesForCount(count: number): string[] {
  const preset = STEP_PRESETS[count];
  if (preset) return preset;
  const total = clamp(Math.round(count), 2, 16);
  const names: string[] = [];
  const used = new Set<string>();
  for (let index = 0; index < total; index += 1) {
    let value = Math.round(50 + (900 * index) / (total - 1));
    let name = String(value);
    while (used.has(name)) {
      value += 1;
      name = String(value);
    }
    used.add(name);
    names.push(name);
  }
  return names;
}

export function referenceBackground(ramp: Ramp): string {
  if (ramp.apcaBackground === "black") return "#000000";
  if (ramp.apcaBackground === "custom") return normalizeHex(ramp.apcaCustomHex) ?? "#ffffff";
  return "#ffffff";
}

function chromaAt(ramp: Ramp, t: number): number {
  if (!ramp.easeChroma) return ramp.chroma;
  const bell = Math.sin(Math.PI * clamp(t, 0, 1));
  return ramp.chroma * (0.45 + 0.55 * bell);
}

function channelsFromHex(hex: string): { r: number; g: number; b: number } {
  const parsed = parse(hex);
  const rgb = parsed ? toRgb(parsed) : null;
  return {
    r: Math.round((rgb?.r ?? 1) * 255),
    g: Math.round((rgb?.g ?? 1) * 255),
    b: Math.round((rgb?.b ?? 1) * 255),
  };
}

function contrastAgainst(color: SolvedColor, backgroundHex: string): number {
  return apcaContrast(color.channels, channelsFromHex(backgroundHex));
}

function backgroundIsLight(backgroundHex: string): boolean {
  const parsed = parse(backgroundHex);
  const oklch = parsed ? toOklch(parsed) : null;
  return (oklch?.l ?? 1) >= 0.55;
}

function findLightness(
  hue: number,
  chroma: number,
  backgroundHex: string,
  targetLc: number,
): { color: SolvedColor; lc: number } {
  let best = fromOklch(0.5, chroma, hue);
  let bestLc = contrastAgainst(best, backgroundHex);
  let bestError = Math.abs(bestLc - targetLc);

  for (let index = 0; index <= 48; index += 1) {
    const lightness = index / 48;
    const color = fromOklch(lightness, chroma, hue);
    const lc = contrastAgainst(color, backgroundHex);
    const error = Math.abs(lc - targetLc);
    if (error < bestError) {
      best = color;
      bestLc = lc;
      bestError = error;
    }
  }

  let low = clamp(best.l - 1 / 48, 0, 1);
  let high = clamp(best.l + 1 / 48, 0, 1);
  for (let pass = 0; pass < 10; pass += 1) {
    const left = low + (high - low) / 3;
    const right = high - (high - low) / 3;
    const leftColor = fromOklch(left, chroma, hue);
    const rightColor = fromOklch(right, chroma, hue);
    const leftError = Math.abs(contrastAgainst(leftColor, backgroundHex) - targetLc);
    const rightError = Math.abs(contrastAgainst(rightColor, backgroundHex) - targetLc);
    if (leftError < rightError) high = right;
    else low = left;
  }

  const color = fromOklch((low + high) / 2, chroma, hue);
  return { color, lc: contrastAgainst(color, backgroundHex) };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function suggestStepName(names: string[]): string {
  const used = new Set(names.map((name) => name.trim()));
  const numbers = names.map((name) => Number(name.trim())).filter((value) => Number.isFinite(value));
  let candidate = numbers.length > 0 ? Math.max(...numbers) + 50 : 50;
  let name = String(candidate);
  while (used.has(name)) {
    candidate += 50;
    name = String(candidate);
  }
  return name;
}

export function generateStops(ramp: Ramp): Stop[] {
  const names = ramp.stepNames.length > 0 ? ramp.stepNames : namesForCount(11);
  const background = referenceBackground(ramp);
  const lightBackground = backgroundIsLight(background);
  const last = Math.max(names.length - 1, 1);

  return names.map((step, index) => {
    const t = index / last;
    const chroma = chromaAt(ramp, t);

    if (ramp.algorithm === "apca") {
      const min = Math.min(ramp.apcaMin, ramp.apcaMax);
      const max = Math.max(ramp.apcaMin, ramp.apcaMax);
      const magnitude = lightBackground ? lerp(min, max, t) : lerp(max, min, t);
      const targetLc = (lightBackground ? 1 : -1) * magnitude;
      const solved = findLightness(ramp.hue, chroma, background, targetLc);
      return {
        step,
        hex: solved.color.hex,
        l: solved.color.l,
        c: solved.color.c,
        h: solved.color.h,
        clipped: solved.color.clipped,
        rgb: solved.color.rgb,
        lc: solved.lc,
        targetLc,
      };
    }

    const lightness = lerp(ramp.lightnessLight, ramp.lightnessDark, t);
    const color = fromOklch(lightness, chroma, ramp.hue);
    return {
      step,
      hex: color.hex,
      l: color.l,
      c: color.c,
      h: color.h,
      clipped: color.clipped,
      rgb: color.rgb,
      lc: contrastAgainst(color, "#ffffff"),
      targetLc: null,
    };
  });
}

export function lcLabel(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
