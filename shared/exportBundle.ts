import {
  CORE_FOUNDATION_IDS,
  coreDocumentFor,
  foundationCorePath,
  isCoreFoundation,
  tokensCoreDocument,
} from "./dtcg";
import {
  cssForExport,
  EXPORT_FOUNDATION_IDS,
  exportSystem,
  normalizeFoundations,
} from "./export";
import { slug } from "./project";
import type { DesignSystem } from "./types";
import { zipStore, type ZipEntry } from "./zip";

function textEntry(name: string, data: string): ZipEntry {
  return { name, data: new TextEncoder().encode(data) };
}

export function foundationZipEntries(system: DesignSystem, foundations?: readonly string[]): ZipEntry[] {
  const picked = normalizeFoundations(foundations);
  const file = exportSystem(system, picked);
  const include = new Set(picked ?? EXPORT_FOUNDATION_IDS);
  const coreIds = CORE_FOUNDATION_IDS.filter((id) => include.has(id));

  return [
    textEntry("foundry_tokens.json", JSON.stringify(file, null, 2)),
    textEntry("foundations.css", cssForExport(file)),
    textEntry("core/tokens.core.json", JSON.stringify(tokensCoreDocument(system, picked), null, 2)),
    ...coreIds.map((id) =>
      textEntry(foundationCorePath(id)!, JSON.stringify(coreDocumentFor(system, id), null, 2)),
    ),
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

export { isCoreFoundation };
