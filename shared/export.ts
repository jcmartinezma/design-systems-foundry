import { generateStops, lcLabel } from "./color";
import { figmaVariableName, slug } from "./project";
import type { ExportFile, ExportSet, Project } from "./types";

export function exportProject(project: Project): ExportFile {
  const sets: ExportSet[] = project.sets.map((set) => ({
    id: set.id,
    name: set.name.trim() || "Colores",
    variables: set.ramps.flatMap((ramp) => {
      const stops = generateStops(ramp);
      return stops.map((stop) => {
        const code = `--${slug(ramp.name)}-${stop.step}`;
        const lc =
          ramp.algorithm === "apca"
            ? `APCA Lc ${lcLabel(stop.lc)} (objetivo ${lcLabel(stop.targetLc ?? 0)})`
            : `APCA Lc ${lcLabel(stop.lc)} sobre blanco`;
        return {
          name: figmaVariableName(ramp.name, stop.step),
          description: `OKLCH ${stop.l.toFixed(3)} ${stop.c.toFixed(3)} ${Math.round(stop.h)} · ${lc}`,
          code,
          hex: stop.hex,
          color: stop.rgb,
        };
      });
    }),
  }));

  return { source: "creator", sets };
}

export function cssForRamp(rampName: string, entries: { step: string; hex: string }[]): string {
  return entries.map((entry) => `--${slug(rampName)}-${entry.step}: ${entry.hex};`).join("\n");
}
