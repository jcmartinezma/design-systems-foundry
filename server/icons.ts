import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fontSlug,
  ICONS_ROOT,
  parseCollectionName,
  parseIconFile,
  stripFill,
  svgSafetyError,
  type IconCatalog,
  type IconCollectionSummary,
  type IconInfo,
  type SkippedIcon,
} from "../shared/icons";
import { zipStore } from "./zip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsRoot = path.join(root, ICONS_ROOT);

export type FontBuild = {
  count: number;
  files: string[];
  skipped: SkippedIcon[];
};

export type FigmaIcon = IconInfo & { svg: string };

let running: { name: string; promise: Promise<FontBuild> } | null = null;

export function listCollections(): IconCollectionSummary[] {
  if (!fs.existsSync(iconsRoot)) return [];
  const collections: IconCollectionSummary[] = [];
  for (const entry of fs.readdirSync(iconsRoot)) {
    if (!parseCollectionName(entry)) continue;
    try {
      const catalog = listIcons(entry);
      collections.push({
        name: catalog.name,
        source: catalog.source,
        count: catalog.icons.length,
        fonts: catalog.fonts,
      });
    } catch {
      continue;
    }
  }
  collections.sort((a, b) => a.name.localeCompare(b.name));
  return collections;
}

export function listIcons(collection: string): IconCatalog {
  const dir = collectionDir(collection);
  const name = path.basename(dir);
  const icons: IconInfo[] = [];
  const skipped: SkippedIcon[] = [];

  for (const entry of fs.readdirSync(dir)) {
    if (!entry.toLowerCase().endsWith(".svg")) continue;
    const parsed = parseIconFile(entry);
    if (!parsed) {
      skipped.push({
        file: entry,
        reason: "El nombre debe ser icon-16|20|24|32|48-nombre.svg, en minúsculas.",
      });
      continue;
    }
    try {
      readContained(dir, parsed.file);
      icons.push(parsed);
    } catch (error) {
      skipped.push({ file: entry, reason: error instanceof Error ? error.message : "No se pudo leer." });
    }
  }

  icons.sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));
  return {
    name,
    source: `${ICONS_ROOT}/${name}`,
    icons,
    skipped,
    fonts: readyFontFiles(name),
  };
}

export function readIconSvg(collection: string, file: string): string {
  return readContained(collectionDir(collection), file);
}

export function figmaIcons(collection: string): FigmaIcon[] {
  const catalog = listIcons(collection);
  return catalog.icons.map((icon) => ({ ...icon, svg: readIconSvg(catalog.name, icon.file) }));
}

export function fontFilePath(collection: string, file: string): string | null {
  const name = collectionDir(collection);
  const folder = path.basename(name);
  const allowed = new Set(fontFileNames(fontSlug(folder)));
  if (!allowed.has(file)) return null;
  const full = path.join(outputDir(folder), file);
  return fs.existsSync(full) ? full : null;
}

export type FontArchive = {
  filename: string;
  body: Buffer;
};

export function fontArchive(collection: string): FontArchive {
  const folder = path.basename(collectionDir(collection));
  const slug = fontSlug(folder);
  const dir = outputDir(folder);
  const files = fontFileNames(slug).filter((name) => fs.existsSync(path.join(dir, name)));
  if (!files.includes(`${slug}.css`)) {
    throw new Error("Genera la fuente de esta colección antes de descargar el ZIP.");
  }

  const css = fs.readFileSync(path.join(dir, `${slug}.css`), "utf8");
  const classes = [...css.matchAll(/^\.(icon-\d+-[a-z0-9-]+)::before/gm)].map((match) => match[1] ?? "");
  const meta: FontMeta = {
    collection: folder,
    source: `${ICONS_ROOT}/${folder}`,
    generatedAt: readGeneratedAt(dir, `${slug}.css`),
    iconCount: classes.length,
    fontFamily: slug,
    files,
  };
  const entries = [
    ...files.map((name) => ({ name, data: fs.readFileSync(path.join(dir, name)) })),
    { name: "README.md", data: Buffer.from(buildReadme(meta, classes), "utf8") },
    { name: "ejemplo.html", data: Buffer.from(buildExample(meta, classes), "utf8") },
    { name: "meta.json", data: Buffer.from(`${JSON.stringify(meta, null, 2)}\n`, "utf8") },
  ];
  return { filename: `${slug}-fuente.zip`, body: zipStore(entries) };
}

export function generateFonts(collection: string): Promise<FontBuild> {
  const name = path.basename(collectionDir(collection));
  if (running?.name === name) return running.promise;
  if (running) throw new Error("Espera a que termine la fuente que ya se está generando.");
  const promise = runGenerate(name).finally(() => {
    running = null;
  });
  running = { name, promise };
  return promise;
}

function outputDir(collection: string): string {
  return path.join(root, ".data", ICONS_ROOT, fontSlug(collection));
}

function fontFileNames(slug: string): string[] {
  return [`${slug}.woff2`, `${slug}.woff`, `${slug}.ttf`, `${slug}.css`];
}

function readyFontFiles(collection: string): string[] {
  const dir = outputDir(collection);
  if (!fs.existsSync(dir)) return [];
  return fontFileNames(fontSlug(collection)).filter((name) => fs.existsSync(path.join(dir, name)));
}

function collectionDir(collection: string): string {
  const name = parseCollectionName(collection);
  if (!name) throw new Error("Nombre de colección no permitido.");
  if (!fs.existsSync(iconsRoot)) throw new Error("No existe la carpeta icons.");
  const full = path.resolve(iconsRoot, name);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("No es una colección.");
  const realRoot = fs.realpathSync(iconsRoot);
  const realDir = fs.realpathSync(full);
  const relative = path.relative(realRoot, realDir);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) {
    throw new Error("La colección apunta fuera de icons.");
  }
  return realDir;
}

function readContained(dir: string, file: string): string {
  const parsed = parseIconFile(file);
  if (!parsed) throw new Error("Nombre de icono no permitido.");

  const full = path.resolve(dir, parsed.file);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("No es un archivo.");
  if (stat.size > 200_000) throw new Error("El archivo pesa demasiado.");

  const realDir = fs.realpathSync(dir);
  const realFile = fs.realpathSync(full);
  const relative = path.relative(realDir, realFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("El archivo apunta fuera de la colección.");
  }

  const content = fs.readFileSync(realFile, "utf8");
  const problem = svgSafetyError(content);
  if (problem) throw new Error(problem);
  return content;
}

async function runGenerate(collection: string): Promise<FontBuild> {
  const catalog = listIcons(collection);
  if (catalog.icons.length === 0) {
    throw new Error("Esta colección no tiene iconos válidos.");
  }

  const slug = fontSlug(catalog.name);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "creator-icons-"));
  const src = path.join(temp, "svg");
  const dist = path.join(temp, "font");
  fs.mkdirSync(src, { recursive: true });

  try {
    const dir = collectionDir(catalog.name);
    for (const icon of catalog.icons) {
      fs.writeFileSync(path.join(src, icon.file), stripFill(readContained(dir, icon.file)));
    }

    process.env.TTF2WOFF2_VERSION = "wasm";
    const { default: svgtofont } = await import("svgtofont");
    await svgtofont({
      src,
      dist,
      fontName: slug,
      startUnicode: 0xea01,
      css: { include: /\.css$/, hasTimestamp: false, fontSize: false },
      emptyDist: true,
      excludeFormat: ["eot", "svg", "symbol.svg"],
      outSVGReact: false,
      outSVGVue: false,
      outSVGPath: false,
      generateInfoData: false,
      log: false,
      svgicons2svgfont: { fontHeight: 1000, normalize: true },
    });

    const destination = outputDir(catalog.name);
    fs.mkdirSync(destination, { recursive: true });
    const files: string[] = [];
    for (const name of fontFileNames(slug)) {
      const from = path.join(dist, name);
      if (!fs.existsSync(from)) continue;
      const raw = fs.readFileSync(from);
      const body = name.endsWith(".css") ? normalizeCss(raw.toString("utf8"), slug) : raw;
      fs.writeFileSync(path.join(destination, name), body);
      files.push(name);
    }

    if (!files.includes(`${slug}.css`) || !files.some((name) => name.endsWith(".woff2") || name.endsWith(".woff") || name.endsWith(".ttf"))) {
      throw new Error("svgtofont terminó sin dejar una fuente usable.");
    }

    const meta: FontMeta = {
      collection: catalog.name,
      source: `${ICONS_ROOT}/${catalog.name}`,
      generatedAt: new Date().toISOString(),
      iconCount: catalog.icons.length,
      fontFamily: slug,
      files,
    };
    fs.writeFileSync(path.join(destination, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

    return { count: catalog.icons.length, files, skipped: catalog.skipped };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function normalizeCss(css: string, fontName: string): string {
  const prefix = `${fontName}-`;
  const normalized = css
    .replaceAll(`.${prefix}`, ".")
    .replaceAll(`"${prefix}`, `"icon-`)
    .replaceAll(` ${prefix}`, " icon-");
  const sizes = [16, 20, 24, 32, 48]
    .map((size) => `[class^="icon-${size}-"], [class*=" icon-${size}-"] { font-size: ${size}px; }`)
    .join("\n");
  return `${normalized.trim()}\n\n${sizes}\n`;
}

type FontMeta = {
  collection: string;
  source: string;
  generatedAt: string;
  iconCount: number;
  fontFamily: string;
  files: string[];
};

function readGeneratedAt(dir: string, cssName: string): string {
  const metaPath = path.join(dir, "meta.json");
  if (fs.existsSync(metaPath)) {
    try {
      const stored = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { generatedAt?: string };
      if (stored.generatedAt) return stored.generatedAt;
    } catch {
      // Si el meta está roto, usamos la fecha del CSS.
    }
  }
  return fs.statSync(path.join(dir, cssName)).mtime.toISOString();
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" }).format(date);
}

function buildReadme(meta: FontMeta, classes: string[]): string {
  const css = `${meta.fontFamily}.css`;
  const sample = classes[0] ?? "icon-24-nombre";
  const fileLines = [
    ...meta.files.map((file) => `- \`${file}\`${file.endsWith(".css") ? ": clases y la declaración de la fuente." : file.endsWith(".woff2") ? ": formato para la web." : file.endsWith(".woff") ? ": respaldo para navegadores antiguos." : ": para escritorio y herramientas que no leen WOFF."}`),
    "- `ejemplo.html`: ábrelo en el navegador para ver los iconos.",
    "- `meta.json`: los mismos datos de esta ficha, para un programa.",
    "- `README.md`: esta explicación.",
  ];
  return `# Fuente ${meta.collection}

- Colección: ${meta.collection}
- Carpeta de origen: \`${meta.source}\`
- Generada: ${formatWhen(meta.generatedAt)}
- Iconos incluidos: ${meta.iconCount}
- Familia CSS: \`${meta.fontFamily}\`

## Cómo se ha generado

Creator leyó los SVG de \`${meta.source}\` y construyó esta fuente.

1. Solo entran archivos llamados \`icon-16-nombre.svg\`, \`icon-20-…\`, \`icon-24-…\`, \`icon-32-…\` o \`icon-48-…\`.
2. Se hace una copia y se quita el color fijo (\`fill\`), para que el icono use el color del texto.
3. Con esos trazos se crean los archivos WOFF2, WOFF y TTF, y el CSS de cada clase.

Los SVG originales de la carpeta no se modifican.

## Archivos

${fileLines.join("\n")}

## Cómo usarla

Deja estos archivos en la misma carpeta y enlaza el CSS:

\`\`\`html
<link rel="stylesheet" href="${css}">
<i class="${sample}"></i>
\`\`\`

El color se cambia con CSS, por ejemplo \`color: #111\`. El tamaño ya va en la clase: 16, 20, 24, 32 o 48.

## Clases

${classes.map((name) => `- \`${name}\``).join("\n")}
`;
}

function buildExample(meta: FontMeta, classes: string[]): string {
  const cards = classes
    .map((name) => `<figure><i class="${name}"></i><figcaption>${name}</figcaption></figure>`)
    .join("\n");
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Fuente ${meta.collection}</title>
  <link rel="stylesheet" href="${meta.fontFamily}.css">
  <style>
    body { margin: 24px; font: 14px/1.4 ui-sans-serif, system-ui, sans-serif; background: #141414; color: #ececec; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: #8d8d8d; margin: 0 0 20px; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
    figure { margin: 0; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 12px 8px; text-align: center; }
    figcaption { margin-top: 8px; font-size: 12px; color: #8d8d8d; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <h1>${meta.collection}</h1>
  <p>Generada el ${formatWhen(meta.generatedAt)} · ${meta.iconCount} iconos · familia ${meta.fontFamily}</p>
  <main>
${cards}
  </main>
</body>
</html>
`;
}

