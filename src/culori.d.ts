declare module "culori" {
  export type CuloriColor = {
    mode: string;
    l?: number;
    c?: number;
    h?: number;
    r?: number;
    g?: number;
    b?: number;
  };

  export function clampChroma(color: CuloriColor, mode?: string): CuloriColor;
  export function formatHex(color: CuloriColor | undefined): string | undefined;
  export function parse(color: string): CuloriColor | undefined;
  export function converter(
    mode: "rgb" | "oklch",
  ): (color: CuloriColor) => CuloriColor | undefined;
}
