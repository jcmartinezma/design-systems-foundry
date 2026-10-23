import type { ShadowLevel, ShadowScale } from "./types";

const SHADOW_COUNT_MAX = 6;

function shadowKey(place: number): string {
  return place === 0 ? "0" : String(place * 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function parseHex(input: string): { r: number; g: number; b: number } | null {
  const hex = input.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function normalizeHex(input: string): string {
  const parsed = parseHex(input);
  if (!parsed) return "#000000";
  const channel = (value: number) => value.toString(16).padStart(2, "0");
  return `#${channel(parsed.r)}${channel(parsed.g)}${channel(parsed.b)}`;
}

export function shadowCss(level: Pick<ShadowLevel, "y" | "blur" | "spread" | "opacity">, color: string): string {
  if (level.y === 0 && level.blur === 0 && level.spread === 0 && level.opacity <= 0) return "none";
  const rgb = parseHex(color) ?? { r: 0, g: 0, b: 0 };
  const alpha = Math.round(clamp(level.opacity, 0, 1) * 1000) / 1000;
  return `0 ${round1(level.y)}px ${round1(level.blur)}px ${round1(level.spread)}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function generateShadow(input: {
  baseY: number;
  baseBlur: number;
  baseSpread: number;
  ratio: number;
  count: number;
  previous?: ShadowLevel[];
}): ShadowLevel[] {
  const count = clamp(Math.round(input.count), 1, SHADOW_COUNT_MAX);
  const baseY = clamp(Math.round(finite(input.baseY, 1)), 0, 64);
  const baseBlur = clamp(Math.round(finite(input.baseBlur, 2)), 0, 128);
  const baseSpread = clamp(Math.round(finite(input.baseSpread, 0)), -64, 64);
  const ratio = Math.round(clamp(input.ratio, 1.2, 3) * 100) / 100;
  const levels: ShadowLevel[] = [
    {
      id: input.previous?.[0]?.id || crypto.randomUUID(),
      name: shadowKey(0),
      y: 0,
      blur: 0,
      spread: 0,
      opacity: keptOpacity(input.previous?.[0], 0),
    },
  ];
  for (let index = 0; index < count; index += 1) {
    const previous = input.previous?.[index + 1];
    const y = Math.round(baseY * ratio ** index);
    const blur = Math.round(baseBlur * ratio ** index);
    const spread = clamp(Math.round(baseSpread * ratio ** index), -64, 64);
    levels.push({
      id: previous?.id || crypto.randomUUID(),
      name: shadowKey(index + 1),
      y,
      blur,
      spread,
      opacity: keptOpacity(previous, Math.min(0.24, 0.06 + index * 0.02)),
    });
  }
  return levels;
}

function keptOpacity(previous: ShadowLevel | undefined, fallback: number): number {
  const value = previous ? previous.opacity : fallback;
  return Math.round(clamp(finite(value, fallback), 0, 1) * 100) / 100;
}

export function createShadowScale(): ShadowScale {
  const scale: ShadowScale = {
    color: "#000000",
    baseY: 1,
    baseBlur: 2,
    baseSpread: 0,
    ratio: 2,
    count: 5,
    levels: [],
  };
  return { ...scale, levels: generateShadow(scale) };
}

function normalizeLevel(raw: Partial<ShadowLevel> | null | undefined, index: number): ShadowLevel {
  return {
    id: raw?.id || crypto.randomUUID(),
    name: shadowKey(index),
    y: round1(clamp(Number(raw?.y) || 0, -128, 128)),
    blur: round1(clamp(Number(raw?.blur) || 0, 0, 256)),
    spread: round1(clamp(Number(raw?.spread) || 0, -64, 64)),
    opacity: Math.round(clamp(Number(raw?.opacity) || 0, 0, 1) * 100) / 100,
  };
}

export function normalizeShadow(raw: Partial<ShadowScale> | null | undefined): ShadowScale {
  if (!raw) return createShadowScale();
  const count = clamp(Math.round(Number(raw.count) || 5), 1, SHADOW_COUNT_MAX);
  const levels = Array.isArray(raw.levels) ? raw.levels.slice(0, 8).map((level, index) => normalizeLevel(level, index)) : [];
  return {
    color: normalizeHex(String(raw.color ?? "#000000")),
    baseY: clamp(Math.round(finite(Number(raw.baseY), 1)), 0, 64),
    baseBlur: clamp(Math.round(finite(Number(raw.baseBlur), 2)), 0, 128),
    baseSpread: clamp(Math.round(finite(Number(raw.baseSpread), 0)), -64, 64),
    ratio: Math.round(clamp(Number(raw.ratio) || 2, 1.2, 3) * 100) / 100,
    count,
    levels: levels.length > 0 ? levels : generateShadow({ baseY: 1, baseBlur: 2, baseSpread: 0, ratio: 2, count }),
  };
}
