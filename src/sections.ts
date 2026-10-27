import type { DesignSystem, SystemStatus } from "../shared/types";

export const FOUNDATIONS = [
  { id: "color", index: "01", label: "Color" },
  { id: "type", index: "02", label: "Typography" },
  { id: "border", index: "03", label: "Border" },
  { id: "spacing", index: "04", label: "Spacing" },
  { id: "radius", index: "05", label: "Radius" },
  { id: "shadow", index: "06", label: "Shadow" },
  { id: "motion", index: "07", label: "Motion" },
  { id: "blur", index: "08", label: "Blur" },
] as const;

export type FoundationId = (typeof FOUNDATIONS)[number]["id"];
export type SectionId = FoundationId | "tokens" | "export";

const FOUNDATION_IDS = new Set<string>(FOUNDATIONS.map((item) => item.id));

export function isFoundation(value: string): value is FoundationId {
  return FOUNDATION_IDS.has(value);
}

export function sectionLabel(section: SectionId): string {
  if (section === "tokens") return "Tokens Review";
  if (section === "export") return "Export";
  return FOUNDATIONS.find((item) => item.id === section)?.label ?? "Color";
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "DS";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
}

export function statusLabel(status: SystemStatus): string {
  if (status === "review") return "In review";
  if (status === "published") return "Published";
  return "Draft";
}

export function formatAgo(value: number | null): string {
  if (!value) return "Not exported";
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function foundationCount(system: DesignSystem, id: FoundationId): number | null {
  switch (id) {
    case "color":
      return system.colors.length;
    case "type":
      return system.type.stepsAbove + system.type.stepsBelow + 1;
    case "border":
      return system.border.steps.length;
    case "spacing":
      return system.spacing.steps.length;
    case "radius":
      return system.radius.steps.length + (system.radius.full ? 1 : 0);
    case "shadow":
      return system.shadow.levels.length;
    case "motion":
      return system.motion.durations.length + system.motion.delays.length + system.motion.curves.length;
    case "blur":
      return system.blur.steps.length;
    default:
      return null;
  }
}

export const FOUNDATION_TOTAL = 8;

export function foundationsDone(system: DesignSystem): number {
  const ready = [
    system.colors.length > 0,
    system.type.stepsAbove + system.type.stepsBelow + 1 > 0,
    system.border.steps.length > 0,
    system.spacing.steps.length > 0,
    system.radius.steps.length > 0,
    system.shadow.levels.length > 0,
    system.motion.durations.length > 0,
    system.blur.steps.length > 0,
  ];
  return ready.filter(Boolean).length;
}
