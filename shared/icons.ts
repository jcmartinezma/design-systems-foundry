export const ICON_SIZES = [16, 20, 24, 32, 48] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export const ICONS_ROOT = "icons";

const COLLECTION_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?$/;

const ICON_FILE = /^icon-(16|20|24|32|48)-([a-z0-9]+(?:-[a-z0-9]+)*)\.svg$/;
const MAX_SVG_CHARS = 200_000;

// Iconos de una sola pieza. Rechazamos scripts, imágenes externas y entidades
// que un navegador podría interpretar al abrir el SVG como documento.
const UNSAFE_SVG =
  /<script|<\/script|foreignObject|<!ENTITY|<!DOCTYPE|javascript:|&#|<iframe|<object|<embed|<image\b|<use\b|xlink:href\s*=|href\s*=\s*["'](?!#)|on[a-z]+\s*=/i;

export type IconInfo = {
  file: string;
  name: string;
  size: IconSize;
};

export type SkippedIcon = {
  file: string;
  reason: string;
};

export type IconCollectionSummary = {
  name: string;
  source: string;
  count: number;
  fonts: string[];
};

export type IconLibrary = {
  root: typeof ICONS_ROOT;
  collections: IconCollectionSummary[];
};

export type IconCatalog = {
  name: string;
  source: string;
  icons: IconInfo[];
  skipped: SkippedIcon[];
  fonts: string[];
};

export function parseCollectionName(name: string): string | null {
  return COLLECTION_NAME.test(name) ? name : null;
}

export function fontSlug(name: string): string {
  const parsed = parseCollectionName(name);
  if (!parsed) throw new Error("Nombre de colección no permitido.");
  return parsed.toLowerCase();
}

export function parseIconFile(file: string): IconInfo | null {
  const match = ICON_FILE.exec(file);
  const sizeText = match?.[1];
  const name = match?.[2];
  if (!sizeText || !name) return null;
  return { file, name, size: Number(sizeText) as IconSize };
}

export function svgSafetyError(content: string): string | null {
  if (content.length > MAX_SVG_CHARS) return "El archivo pesa demasiado.";
  if (!/<svg[\s>]/i.test(content)) return "No contiene un elemento svg.";
  if (UNSAFE_SVG.test(content)) {
    return "Incluye contenido que no es un icono simple (scripts, enlaces o imágenes).";
  }
  return null;
}

export function stripFill(content: string): string {
  return content.replace(/\sfill\s*=\s*(["'])(?:(?!\1).)*\1/gi, "");
}
