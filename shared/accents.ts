import type { SystemAccent } from "./types";

export const SYSTEM_ACCENTS: { id: SystemAccent; label: string; bg: string; fg: string }[] = [
  { id: "slate", label: "None", bg: "transparent", fg: "var(--text)" },
  { id: "blue", label: "Blue", bg: "#2F6BFF", fg: "#FFFFFF" },
  { id: "teal", label: "Teal", bg: "#14C8B4", fg: "#032421" },
  { id: "green", label: "Green", bg: "#2FD16B", fg: "#04210F" },
  { id: "amber", label: "Amber", bg: "#FFB020", fg: "#2B1B00" },
  { id: "orange", label: "Orange", bg: "#FF6A1F", fg: "#2A0F00" },
  { id: "red", label: "Red", bg: "#EF3E4A", fg: "#FFFFFF" },
  { id: "violet", label: "Violet", bg: "#8B5CFF", fg: "#FFFFFF" },
];

const ACCENT_IDS = new Set<string>(SYSTEM_ACCENTS.map((item) => item.id));

export function systemAccent(value: unknown): SystemAccent {
  return typeof value === "string" && ACCENT_IDS.has(value) ? (value as SystemAccent) : "slate";
}

/** Mark / border color for the system. Transparent when no accent is chosen. */
export function accentMark(id: SystemAccent): string {
  const tone = SYSTEM_ACCENTS.find((item) => item.id === id) ?? SYSTEM_ACCENTS[0]!;
  return tone.bg;
}

/** Fill styles for rail avatars. Transparent accent falls back to the default avatar look. */
export function accentStyle(id: SystemAccent): { background: string; color: string } {
  const tone = SYSTEM_ACCENTS.find((item) => item.id === id) ?? SYSTEM_ACCENTS[0]!;
  if (tone.bg === "transparent") {
    return { background: "var(--avatar)", color: "var(--text)" };
  }
  return { background: tone.bg, color: tone.fg };
}
