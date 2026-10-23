export type RampAlgorithm = "oklch" | "apca";
export type ApcaBackground = "white" | "black" | "custom";

export type Ramp = {
  id: string;
  name: string;
  hue: number;
  chroma: number;
  stepNames: string[];
  easeChroma: boolean;
  algorithm: RampAlgorithm;
  lightnessLight: number;
  lightnessDark: number;
  apcaBackground: ApcaBackground;
  apcaCustomHex: string;
  apcaMin: number;
  apcaMax: number;
};

export type ColorSet = {
  id: string;
  name: string;
  ramps: Ramp[];
};

export type TypeRatioId =
  | "minor-second"
  | "major-second"
  | "minor-third"
  | "major-third"
  | "perfect-fourth"
  | "augmented-fourth"
  | "perfect-fifth"
  | "golden"
  | "custom";

export type FontFamily = {
  id: string;
  name: string;
};

export type TypeCollection = {
  id: string;
  name: string;
  baseSize: number;
  baseHeight: number;
  ratioId: TypeRatioId;
  customRatio: number;
  stepsAbove: number;
  stepsBelow: number;
  families: FontFamily[];
  wholePixels: boolean;
};

export type TypeLibrary = {
  activeCollectionId: string | null;
  collections: TypeCollection[];
};

export type SpacingMode = "linear" | "jumps" | "ratio" | "fibonacci" | "custom";

export type SpacingOrigin = {
  mode: Exclude<SpacingMode, "custom">;
  base: number;
  count: number;
  ratio: number;
  micro: boolean;
  customValues: number[];
};

export type SpacingStep = {
  id: string;
  name: string;
  px: number;
  rem: number;
  micro: boolean;
  offGrid: boolean;
};

export type SpacingScale = {
  base: number;
  mode: SpacingMode;
  count: number;
  ratio: number;
  micro: boolean;
  customValues: number[];
  customFrom: SpacingOrigin | null;
  edited: boolean;
  steps: SpacingStep[];
};

/** A corner scale uses the same steps as spacing, plus an optional pill token. */
export type RadiusScale = SpacingScale & { full: boolean };

/** Stroke widths. Same step shape as spacing, limited to 2–4 positive steps. */
export type BorderScale = SpacingScale;

/** Blur radii. Same step shape as spacing, including a 0 px step for no blur. */
export type BlurScale = SpacingScale;

export type ShadowLevel = {
  id: string;
  name: string;
  y: number;
  blur: number;
  spread: number;
  opacity: number;
};

export type ShadowScale = {
  color: string;
  baseY: number;
  baseBlur: number;
  baseSpread: number;
  ratio: number;
  count: number;
  levels: ShadowLevel[];
};

export type MotionDuration = {
  id: string;
  name: string;
  ms: number;
  step: number;
};

export type MotionCurve = {
  id: string;
  name: string;
  curve: string;
};

export type MotionScale = {
  baseMs: number;
  baseDelay: number;
  ratio: number;
  count: number;
  durations: MotionDuration[];
  delays: MotionDuration[];
  curves: MotionCurve[];
};

export type SystemStatus = "draft" | "review" | "published";

export type SystemAccent = "slate" | "blue" | "teal" | "green" | "amber" | "orange" | "red" | "violet";

export type ColorAlias = {
  id: string;
  name: string;
  rampId: string;
  step: string;
};

export type DesignSystem = {
  id: string;
  name: string;
  starred: boolean;
  accent: SystemAccent;
  status: SystemStatus;
  version: string;
  updatedAt: number;
  lastExportAt: number | null;
  lastSection: string;
  aliases: ColorAlias[];
  colors: Ramp[];
  type: TypeCollection;
  border: BorderScale;
  spacing: SpacingScale;
  radius: RadiusScale;
  shadow: ShadowScale;
  motion: MotionScale;
  blur: BlurScale;
};

export type Project = {
  version: 2;
  activeSystemId: string | null;
  tempSystemId: string | null;
  systems: DesignSystem[];
};

export type TypeExportStyle = {
  name: string;
  figmaName: string;
  size: number;
  step: number;
  description: string;
  fontFamily: string;
  fontStyle: string;
  lineHeightPercent: number;
};

export type TypeExportCollection = {
  id: string;
  name: string;
  fontFamily: string;
  fontStyle: string;
  lineHeightPercent: number;
  styles: TypeExportStyle[];
};

export type TypeExportFile = {
  source: "creator";
  kind: "type";
  collections: TypeExportCollection[];
};

export type ExportVariableType = "COLOR" | "FLOAT" | "STRING";

export type ExportVariable = {
  name: string;
  description: string;
  code: string;
  type: ExportVariableType;
  css: string;
  hex?: string;
  color?: { r: number; g: number; b: number; a: number };
  number?: number;
  text?: string;
};

export type ExportSet = {
  id: string;
  name: string;
  variables: ExportVariable[];
};

export type ExportFile = {
  source: "creator";
  kind: "system";
  id: string;
  name: string;
  sets: ExportSet[];
};

export type Stop = {
  step: string;
  hex: string;
  l: number;
  c: number;
  h: number;
  clipped: boolean;
  rgb: { r: number; g: number; b: number; a: number };
  lc: number;
  targetLc: number | null;
};
