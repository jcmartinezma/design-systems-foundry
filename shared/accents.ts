import type { SystemAccent } from "./types";

export const SYSTEM_ACCENTS: { id: SystemAccent; label: string; bg: string; fg: string }[] = [
  { id: "slate", label: "Slate", bg: "#3A3F46", fg: "#F4F4F5" },
  { id: "blue", label: "Blue", bg: "#2F5EAE", fg: "#F3F6FC" },
  { id: "teal", label: "Teal", bg: "#0F6E66", fg: "#F2FBFA" },
  { id: "green", label: "Green", bg: "#2F6B3A", fg: "#F3FBF4" },
  { id: "amber", label: "Amber", bg: "#8A5A0A", fg: "#FFF8EB" },
  { id: "orange", label: "Orange", bg: "#B44712", fg: "#FFF6F1" },
  { id: "red", label: "Red", bg: "#B42318", fg: "#FFF5F5" },
  { id: "violet", label: "Violet", bg: "#5B3EAF", fg: "#F6F3FC" },
];

const ACCENT_IDS = new Set<string>(SYSTEM_ACCENTS.map((item) => item.id));

export function systemAccent(value: unknown): SystemAccent {
  return typeof value === "string" && ACCENT_IDS.has(value) ? (value as SystemAccent) : "slate";
}

export function accentStyle(id: SystemAccent): { background: string; color: string } {
  const tone = SYSTEM_ACCENTS.find((item) => item.id === id) ?? SYSTEM_ACCENTS[0]!;
  return { background: tone.bg, color: tone.fg };
}
