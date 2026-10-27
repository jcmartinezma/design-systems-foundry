import { systemAccent } from "./accents";
import { namesForCount } from "./color";
import { normalizeBlur } from "./blur";
import { randomRampName } from "./names";
import { normalizeBorder } from "./border";
import { normalizeShadow } from "./shadow";
import { normalizeMotion } from "./motion";
import { normalizeRadius } from "./radius";
import { normalizeSpacing } from "./spacing";
import { createTypeCollection, normalizeTypeCollection, normalizeTypeLibrary } from "./type";
import type {
  ColorAlias,
  ColorSet,
  DesignSystem,
  Project,
  Ramp,
  SystemStatus,
  TypeCollection,
  TypeLibrary,
} from "./types";

function id(): string {
  return crypto.randomUUID();
}

export function createRamp(name: string, patch: Partial<Ramp> = {}): Ramp {
  return {
    id: id(),
    name,
    hue: 255,
    chroma: 0.14,
    stepNames: namesForCount(11),
    easeChroma: true,
    algorithm: "oklch",
    lightnessLight: 0.97,
    lightnessDark: 0.22,
    apcaBackground: "white",
    apcaCustomHex: "#f4f4f5",
    apcaMin: 8,
    apcaMax: 100,
    ...patch,
  };
}

export function normalizeRamp(raw: Partial<Ramp> & { steps?: number }): Ramp {
  const fallback = createRamp(raw.name || "Color");
  const stepNames =
    Array.isArray(raw.stepNames) && raw.stepNames.length > 0
      ? raw.stepNames.map((name) => String(name))
      : namesForCount(raw.steps ?? 11);
  return {
    id: raw.id || fallback.id,
    name: raw.name ?? fallback.name,
    hue: raw.hue ?? fallback.hue,
    chroma: raw.chroma ?? fallback.chroma,
    stepNames,
    easeChroma: raw.easeChroma ?? fallback.easeChroma,
    algorithm: "oklch",
    lightnessLight: raw.lightnessLight ?? fallback.lightnessLight,
    lightnessDark: raw.lightnessDark ?? fallback.lightnessDark,
    apcaBackground:
      raw.apcaBackground === "black" || raw.apcaBackground === "custom" ? raw.apcaBackground : "white",
    apcaCustomHex: raw.apcaCustomHex ?? fallback.apcaCustomHex,
    apcaMin: raw.apcaMin ?? fallback.apcaMin,
    apcaMax: raw.apcaMax ?? fallback.apcaMax,
  };
}

function cleanSystemName(value: string): string {
  const cleaned = value.replace(/[{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
  return cleaned || "System";
}

function typeFromLegacy(raw: unknown): TypeCollection {
  if (raw && typeof raw === "object" && Array.isArray((raw as TypeLibrary).collections)) {
    const library = normalizeTypeLibrary(raw as TypeLibrary);
    return (
      library.collections.find((collection) => collection.id === library.activeCollectionId) ??
      library.collections[0] ??
      createTypeCollection("Text")
    );
  }
  return normalizeTypeCollection(raw as Partial<TypeCollection>);
}

function colorsFromSets(sets: ColorSet[]): Ramp[] {
  const used = new Set<string>();
  const ramps: Ramp[] = [];
  for (const set of sets) {
    for (const ramp of set.ramps) {
      const next = normalizeRamp(ramp);
      const key = next.name.trim().toLowerCase();
      if (key && used.has(key)) next.name = `${set.name} ${next.name}`.trim();
      used.add(next.name.trim().toLowerCase());
      ramps.push(next);
    }
  }
  return ramps;
}

function systemStatus(value: unknown): SystemStatus {
  return value === "review" || value === "published" ? value : "draft";
}

function normalizeAliases(value: unknown): ColorAlias[] {
  if (!Array.isArray(value)) return [];
  const aliases: ColorAlias[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const alias = item as Partial<ColorAlias>;
    const name = String(alias.name ?? "").trim().slice(0, 64);
    const rampId = String(alias.rampId ?? "").trim();
    const step = String(alias.step ?? "").trim().slice(0, 32);
    if (!name || !rampId || !step) continue;
    aliases.push({ id: alias.id || crypto.randomUUID(), name, rampId, step });
  }
  return aliases;
}

export function createSystem(name: string, example = false): DesignSystem {
  return {
    id: crypto.randomUUID(),
    name: cleanSystemName(name),
    starred: example,
    accent: "slate",
    status: "draft",
    version: "0.1.0",
    updatedAt: Date.now(),
    lastExportAt: null,
    lastSection: "color",
    aliases: [],
    colors: example
      ? [
          createRamp("Blue", { hue: 255, chroma: 0.15 }),
          createRamp("Blue text", { hue: 255, chroma: 0.13, lightnessLight: 0.55, lightnessDark: 0.18 }),
          createRamp("Gray", { hue: 270, chroma: 0.012, easeChroma: false }),
        ]
      : [createRamp(randomRampName([]))],
    type: createTypeCollection("Text"),
    border: normalizeBorder(null),
    spacing: normalizeSpacing(null),
    radius: normalizeRadius(null),
    shadow: normalizeShadow(null),
    motion: normalizeMotion(null),
    blur: normalizeBlur(null),
  };
}

export function normalizeSystem(raw: Partial<DesignSystem> | null | undefined): DesignSystem {
  const fallback = createSystem("System");
  const version = String(raw?.version ?? fallback.version).trim().slice(0, 16);
  // Projects saved before the rename keep their shadows under the old "elevation" key.
  const savedShadow = raw?.shadow ?? (raw as { elevation?: DesignSystem["shadow"] } | null | undefined)?.elevation;
  const savedSection = typeof raw?.lastSection === "string" ? raw.lastSection : "";
  return {
    id: raw?.id || fallback.id,
    name: cleanSystemName(String(raw?.name ?? fallback.name)),
    starred: Boolean(raw?.starred),
    accent: systemAccent(raw?.accent),
    status: systemStatus(raw?.status),
    version: version || fallback.version,
    updatedAt: typeof raw?.updatedAt === "number" && Number.isFinite(raw.updatedAt) ? raw.updatedAt : fallback.updatedAt,
    lastExportAt: typeof raw?.lastExportAt === "number" && Number.isFinite(raw.lastExportAt) ? raw.lastExportAt : null,
    lastSection: savedSection.trim()
      ? savedSection === "elevation"
        ? "shadow"
        : savedSection === "icons"
          ? "color"
          : savedSection
      : "color",
    aliases: normalizeAliases(raw?.aliases),
    colors: Array.isArray(raw?.colors) ? raw.colors.map((ramp) => normalizeRamp(ramp)) : fallback.colors,
    type: raw?.type ? normalizeTypeCollection(raw.type) : fallback.type,
    border: raw?.border ? normalizeBorder(raw.border) : fallback.border,
    spacing: raw?.spacing ? normalizeSpacing(raw.spacing) : fallback.spacing,
    radius: raw?.radius ? normalizeRadius(raw.radius) : fallback.radius,
    shadow: savedShadow ? normalizeShadow(savedShadow) : fallback.shadow,
    motion: raw?.motion ? normalizeMotion(raw.motion) : fallback.motion,
    blur: raw?.blur ? normalizeBlur(raw.blur) : fallback.blur,
  };
}

type LegacyProject = {
  version?: number;
  activeSystemId?: string | null;
  tempSystemId?: string | null;
  systems?: DesignSystem[];
  activeSetId?: string | null;
  sets?: ColorSet[];
  type?: TypeLibrary | TypeCollection;
};

export function normalizeProject(input: unknown): Project {
  const project = (input && typeof input === "object" ? input : {}) as LegacyProject;
  if (project && Array.isArray(project.systems)) {
    const systems = project.systems.map((system) => normalizeSystem(system));
    return finishProject({
      version: 2,
      activeSystemId: project.activeSystemId ?? null,
      tempSystemId: project.tempSystemId ?? null,
      systems,
    });
  }

  // Nothing saved yet (or an unreadable file): start with no systems.
  if (!Array.isArray(project.sets) && !project.type) return createDefaultProject();

  const sets = Array.isArray(project?.sets)
    ? project.sets.map((set) => ({
        id: set.id || crypto.randomUUID(),
        name: set.name ?? "Collection",
        ramps: Array.isArray(set.ramps) ? set.ramps.map((ramp) => normalizeRamp(ramp)) : [],
      }))
    : [];
  const system = createSystem(sets.length === 1 ? sets[0]?.name || "System" : "System");
  system.colors = colorsFromSets(sets);
  system.type = typeFromLegacy(project?.type);
  return finishProject({ version: 2, activeSystemId: system.id, tempSystemId: null, systems: [system] });
}

export function createSet(name: string, ramps: Ramp[] = [createRamp("Color")]): ColorSet {
  return { id: id(), name, ramps };
}

/** What a first-time user gets: no design systems at all. */
export function createDefaultProject(): Project {
  return { version: 2, activeSystemId: null, tempSystemId: null, systems: [] };
}

/** A project with one filled-in example system. Used by the self-check, never by the app. */
export function createExampleProject(): Project {
  const system = createSystem("Product", true);
  return finishProject({ version: 2, activeSystemId: system.id, tempSystemId: null, systems: [system] });
}

export function cloneSystem(source: DesignSystem): DesignSystem {
  const copy = normalizeSystem(structuredClone(source));
  const rampIds = new Map(copy.colors.map((ramp) => [ramp.id, crypto.randomUUID()]));
  copy.id = crypto.randomUUID();
  copy.name = cleanSystemName(`${source.name} copy`);
  copy.starred = false;
  copy.status = "draft";
  copy.updatedAt = Date.now();
  copy.lastExportAt = null;
  copy.lastSection = "color";
  copy.colors = copy.colors.map((ramp) => ({ ...ramp, id: rampIds.get(ramp.id) ?? crypto.randomUUID() }));
  copy.aliases = copy.aliases.map((alias) => ({
    ...alias,
    id: crypto.randomUUID(),
    rampId: rampIds.get(alias.rampId) ?? alias.rampId,
  }));
  copy.type = {
    ...copy.type,
    id: crypto.randomUUID(),
    families: copy.type.families.map((family) => ({ ...family, id: crypto.randomUUID() })),
  };
  copy.border = {
    ...copy.border,
    steps: copy.border.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
  };
  copy.spacing = {
    ...copy.spacing,
    steps: copy.spacing.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
  };
  copy.radius = {
    ...copy.radius,
    steps: copy.radius.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
  };
  copy.shadow = {
    ...copy.shadow,
    levels: copy.shadow.levels.map((level) => ({ ...level, id: crypto.randomUUID() })),
  };
  copy.motion = {
    ...copy.motion,
    durations: copy.motion.durations.map((item) => ({ ...item, id: crypto.randomUUID() })),
    delays: copy.motion.delays.map((item) => ({ ...item, id: crypto.randomUUID() })),
    curves: copy.motion.curves.map((item) => ({ ...item, id: crypto.randomUUID() })),
  };
  copy.blur = {
    ...copy.blur,
    steps: copy.blur.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
  };
  return copy;
}

function adoptImported(system: DesignSystem): DesignSystem {
  system.id = crypto.randomUUID();
  system.starred = false;
  system.updatedAt = Date.now();
  system.lastExportAt = null;
  return system;
}

/** Figma/plugin export shape: flattened variables, no editable `colors` ramps. */
function isTokenExportShape(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const value = item as { colors?: unknown; sets?: unknown; definition?: unknown };
  if (value.definition && typeof value.definition === "object") return false;
  if (Array.isArray(value.colors)) return false;
  return Array.isArray(value.sets);
}

function systemFromImportItem(item: unknown): DesignSystem {
  if (!item || typeof item !== "object") throw new Error("This JSON has no design system in it.");
  const value = item as { definition?: unknown; colors?: unknown; sets?: unknown; name?: unknown };
  if (value.definition && typeof value.definition === "object") {
    return adoptImported(normalizeSystem(value.definition as DesignSystem));
  }
  if (isTokenExportShape(value)) {
    throw new Error(
      "This export has no editable system definition. Re-export from Foundry (Copy JSON or Download ZIP) and import that file.",
    );
  }
  return adoptImported(normalizeSystem(value as DesignSystem));
}

export function systemsFromJson(input: unknown): DesignSystem[] {
  if (!input || typeof input !== "object") throw new Error("This file is not a design system.");
  const value = input as { kind?: string; systems?: unknown; definition?: unknown; name?: unknown; sets?: unknown };

  // Single-system export (tokens.json /api/export): prefer embedded definition.
  if (value.kind === "system") {
    if (value.definition && typeof value.definition === "object") {
      return [systemFromImportItem(value)];
    }
    throw new Error(
      "This export has no editable system definition. Re-export from Foundry (Copy JSON or Download ZIP) and import that file.",
    );
  }

  // Plugin library export (Copy JSON): each entry may carry a definition.
  if (value.kind === "library" && Array.isArray(value.systems)) {
    if (value.systems.length === 0) throw new Error("This JSON has no design system in it.");
    return value.systems.map((item) => systemFromImportItem(item));
  }

  const rawList = Array.isArray(value.systems) ? value.systems : typeof value.name === "string" ? [value] : null;
  if (!rawList || rawList.length === 0) throw new Error("This JSON has no design system in it.");
  return rawList.map((item) => systemFromImportItem(item));
}

export function withActiveSystem(project: Project): Project {
  const activeExists = project.systems.some((system) => system.id === project.activeSystemId);
  return {
    ...project,
    activeSystemId: activeExists ? project.activeSystemId : (project.systems[0]?.id ?? null),
  };
}

function finishProject(project: Project): Project {
  const next = withActiveSystem(project);
  const temp = next.systems.find((system) => system.id === next.tempSystemId);
  return { ...next, tempSystemId: temp && !temp.starred ? temp.id : null };
}

export function activeSystem(project: Project): DesignSystem | null {
  return project.systems.find((system) => system.id === project.activeSystemId) ?? project.systems[0] ?? null;
}

export function slug(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "color";
}

export function figmaVariableName(rampName: string, step: string): string {
  const clean = (value: string) => {
    const hyphenated = value
      .replace(/[.{}]/g, " ")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    return hyphenated;
  };
  return `${clean(rampName) || "color"}/${clean(step) || "valor"}`;
}
