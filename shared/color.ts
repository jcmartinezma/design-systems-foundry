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
  const last = Math.max(names.length - 1, 1);

  return names.map((step, index) => {
    const t = index / last;
    const chroma = chromaAt(ramp, t);
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

function linearChannel(value: number): number {
  const channel = value <= 1 ? value : value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export type ContrastTest = "none" | "wcag" | "apca";
export type ContrastGround = "white" | "black" | "custom";

/** Background for the shared contrast test. Black is the near-black used by the Contrast table. */
export function contrastBackgroundHex(ground: ContrastGround, customHex: string): string {
  if (ground === "black") return "#111111";
  if (ground === "custom") return normalizeHex(customHex) ?? "#ffffff";
  return "#ffffff";
}

/** WCAG 2.2 contrast ratio. Channels can be 0–1 or 0–255. Ratios did not change in 2.2. */
export function wcagContrast(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const luminance = (rgb: { r: number; g: number; b: number }) =>
    0.2126 * linearChannel(rgb.r) + 0.7152 * linearChannel(rgb.g) + 0.0722 * linearChannel(rgb.b);
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.2 text grades. 4.5 is AA for normal text, 3 is AA for large text, 7 is AAA. */
export function wcagGrade(ratio: number): string {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "Fail";
}

/** APCA Lc bands used for body text, large text, and non-text UI. */
export function apcaGrade(lc: number): string {
  const magnitude = Math.abs(lc);
  if (magnitude >= 75) return "Body";
  if (magnitude >= 60) return "Large";
  if (magnitude >= 45) return "UI";
  return "Low";
}

/** Score of one color against a background. WCAG returns the ratio. APCA returns Lc. */
export function contrastVerdict(
  rgb: { r: number; g: number; b: number },
  backgroundHex: string,
  test: Exclude<ContrastTest, "none">,
): { score: string; grade: string; passes: boolean } {
  const background = channelsFromHex(backgroundHex);
  const text = {
    r: Math.round((rgb.r <= 1 ? rgb.r : rgb.r / 255) * 255),
    g: Math.round((rgb.g <= 1 ? rgb.g : rgb.g / 255) * 255),
    b: Math.round((rgb.b <= 1 ? rgb.b : rgb.b / 255) * 255),
  };

  if (test === "wcag") {
    const ratio = wcagContrast(
      { r: text.r / 255, g: text.g / 255, b: text.b / 255 },
      { r: background.r / 255, g: background.g / 255, b: background.b / 255 },
    );
    const grade = wcagGrade(ratio);
    return { score: ratio.toFixed(2), grade, passes: grade !== "Fail" };
  }

  const lc = apcaContrast(text, background);
  const grade = apcaGrade(lc);
  return { score: lcLabel(lc), grade, passes: grade !== "Low" };
}
