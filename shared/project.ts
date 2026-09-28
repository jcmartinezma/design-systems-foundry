import { namesForCount } from "./color";
import type { ColorSet, Connections, Project, PublicConnections, Ramp } from "./types";

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
    algorithm: raw.algorithm === "apca" ? "apca" : "oklch",
    lightnessLight: raw.lightnessLight ?? fallback.lightnessLight,
    lightnessDark: raw.lightnessDark ?? fallback.lightnessDark,
    apcaBackground:
      raw.apcaBackground === "black" || raw.apcaBackground === "custom" ? raw.apcaBackground : "white",
    apcaCustomHex: raw.apcaCustomHex ?? fallback.apcaCustomHex,
    apcaMin: raw.apcaMin ?? fallback.apcaMin,
    apcaMax: raw.apcaMax ?? fallback.apcaMax,
  };
}

export function normalizeProject(project: Partial<Project> | null | undefined): Project {
  const sets = Array.isArray(project?.sets) ? project.sets : [];
  return withActiveSet({
    version: 1,
    activeSetId: project?.activeSetId ?? null,
    sets: sets.map((set) => ({
      id: set.id || crypto.randomUUID(),
      name: set.name ?? "Collection",
      ramps: Array.isArray(set.ramps) ? set.ramps.map((ramp) => normalizeRamp(ramp)) : [],
    })),
  });
}

export function createSet(name: string, ramps: Ramp[] = [createRamp("Color")]): ColorSet {
  return { id: id(), name, ramps };
}

export function createDefaultProject(): Project {
  return {
    version: 1,
    activeSetId: null,
    sets: [
      createSet("Marca", [
        createRamp("Azul", { hue: 255, chroma: 0.15 }),
        createRamp("Azul texto", {
          hue: 255,
          chroma: 0.13,
          algorithm: "apca",
          apcaBackground: "white",
          apcaMin: 60,
          apcaMax: 95,
        }),
      ]),
      createSet("Neutros", [
        createRamp("Gris", { hue: 270, chroma: 0.012, easeChroma: false }),
      ]),
    ],
  };
}

export function withActiveSet(project: Project): Project {
  const activeExists = project.sets.some((set) => set.id === project.activeSetId);
  return {
    ...project,
    activeSetId: activeExists ? project.activeSetId : (project.sets[0]?.id ?? null),
  };
}

export function defaultConnections(): Connections {
  return {
    figma: {
      token: "",
      fileUrl: "",
    },
  };
}

export function toPublicConnections(connections: Connections): PublicConnections {
  const token = connections.figma.token.trim();
  return {
    figma: {
      fileUrl: connections.figma.fileUrl,
      hasToken: token.length > 0,
      tokenHint: token.length >= 4 ? token.slice(-4) : "",
    },
  };
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
  const clean = (value: string) => value.replace(/[.{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
  return `${clean(rampName) || "color"}/${clean(step) || "valor"}`;
}
