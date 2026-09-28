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

export type Project = {
  version: 1;
  activeSetId: string | null;
  sets: ColorSet[];
};

export type Connections = {
  figma: {
    token: string;
    fileUrl: string;
  };
};

export type PublicConnections = {
  figma: {
    fileUrl: string;
    hasToken: boolean;
    tokenHint: string;
  };
};

export type ExportVariable = {
  name: string;
  description: string;
  code: string;
  hex: string;
  color: { r: number; g: number; b: number; a: number };
};

export type ExportSet = {
  id: string;
  name: string;
  variables: ExportVariable[];
};

export type ExportFile = {
  source: "creator";
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
