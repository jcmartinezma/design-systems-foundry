import { blurDtcg } from "./blur";
import { borderDtcg } from "./border";
import {
  cssForExport,
  EXPORT_FOUNDATION_IDS,
  exportSystem,
  foundationDtcgName,
  normalizeFoundations,
  type ExportFoundationId,
} from "./export";
import { slug } from "./project";
import { radiusDtcg } from "./radius";
import { spacingDtcg } from "./spacing";
import type { DesignSystem } from "./types";
import { zipStore, type ZipEntry } from "./zip";

function textEntry(name: string, data: string): ZipEntry {
  return { name, data: new TextEncoder().encode(data) };
}

export function foundationZipEntries(system: DesignSystem, foundations?: readonly string[]): ZipEntry[] {
  const picked = normalizeFoundations(foundations);
  const file = exportSystem(system, picked);
  const include = new Set(picked ?? EXPORT_FOUNDATION_IDS);
  const dtcg = (id: ExportFoundationId, data: string): ZipEntry[] =>
    include.has(id) && foundationDtcgName(id) ? [textEntry(foundationDtcgName(id)!, data)] : [];

  return [
    textEntry("tokens.json", JSON.stringify(file, null, 2)),
    textEntry("foundations.css", cssForExport(file)),
    ...dtcg("border", JSON.stringify(borderDtcg(system.border), null, 2)),
    ...dtcg("spacing", JSON.stringify(spacingDtcg(system.spacing), null, 2)),
    ...dtcg("radius", JSON.stringify(radiusDtcg(system.radius), null, 2)),
    ...dtcg("blur", JSON.stringify(blurDtcg(system.blur), null, 2)),
  ];
}

export function foundationZip(system: DesignSystem, foundations?: readonly string[]): {
  filename: string;
  bytes: Uint8Array;
} {
  return {
    filename: `${slug(system.name)}-foundations.zip`,
    bytes: zipStore(foundationZipEntries(system, foundations)),
  };
}
