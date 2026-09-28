import { apcaContrast } from "./apca";
import { fromOklch, generateStops } from "./color";
import { fontSlug, parseCollectionName, parseIconFile, stripFill, svgSafetyError } from "./icons";
import { zipStore } from "../server/zip";
import { createDefaultProject } from "./project";

const blackOnWhite = apcaContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
const whiteOnBlack = apcaContrast({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
const same = apcaContrast({ r: 120, g: 120, b: 120 }, { r: 120, g: 120, b: 120 });

if (blackOnWhite < 100 || blackOnWhite > 112) {
  throw new Error(`APCA negro sobre blanco inesperado: ${blackOnWhite}`);
}
if (whiteOnBlack > -100 || whiteOnBlack < -112) {
  throw new Error(`APCA blanco sobre negro inesperado: ${whiteOnBlack}`);
}
if (same !== 0) {
  throw new Error(`APCA del mismo color debería ser 0, fue ${same}`);
}

const blue = fromOklch(0.62, 0.15, 255);
if (blue.channels.b <= blue.channels.r) {
  throw new Error(`OKLCH 255 no parece azul: ${blue.hex}`);
}

const project = createDefaultProject();
const oklchRamp = project.sets[0]?.ramps[0];
const apcaRamp = project.sets[0]?.ramps[1];
if (!oklchRamp || !apcaRamp) throw new Error("Faltan rampas de ejemplo");

const oklchStops = generateStops(oklchRamp);
if (oklchStops[0]!.l <= oklchStops.at(-1)!.l) {
  throw new Error("La rampa OKLCH debería ir de clara a oscura");
}

const apcaStops = generateStops(apcaRamp);
const first = Math.abs(apcaStops[0]!.lc);
const last = Math.abs(apcaStops.at(-1)!.lc);
if (last <= first) {
  throw new Error(`La rampa APCA no aumenta el contraste: ${first} → ${last}`);
}

const icon = parseIconFile("icon-24-arrow-download.svg");
if (!icon || icon.size !== 24 || icon.name !== "arrow-download") {
  throw new Error("El nombre icon-24-arrow-download.svg no se ha leído bien.");
}
if (parseIconFile("../secret.svg") || parseIconFile("icon-18-add.svg") || parseIconFile("icon-24-Add.svg")) {
  throw new Error("Un nombre de icono inseguro ha pasado el filtro.");
}
if (svgSafetyError('<svg><script>alert(1)</script></svg>') === null) {
  throw new Error("Un SVG con script ha pasado el filtro.");
}
const clean = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
if (svgSafetyError(clean) !== null) throw new Error("Un SVG simple se ha rechazado.");
if (stripFill('<svg><path fill="#000" d="M0 0"/></svg>').includes("fill")) {
  throw new Error("No se ha quitado el fill del SVG.");
}
if (parseCollectionName("coleccion1") !== "coleccion1" || fontSlug("Coleccion1") !== "coleccion1") {
  throw new Error("El nombre de la colección no se ha leído bien.");
}
if (parseCollectionName("../icons") || parseCollectionName("a/b") || parseCollectionName("-hola") || parseCollectionName("hola-")) {
  throw new Error("Un nombre de colección inseguro ha pasado el filtro.");
}
const zip = zipStore([{ name: "hola.txt", data: Buffer.from("hola") }]);
if (zip.readUInt32LE(0) !== 0x04034b50 || !zip.includes(Buffer.from("hola.txt"))) {
  throw new Error("El ZIP no tiene el formato esperado.");
}
let rejected = false;
try {
  zipStore([{ name: "../secreto.txt", data: Buffer.from("no") }]);
} catch {
  rejected = true;
}
if (!rejected) throw new Error("El ZIP ha aceptado una ruta fuera de la carpeta.");

console.log(
  `ok apca ${blackOnWhite.toFixed(2)} / ${whiteOnBlack.toFixed(2)} azul ${blue.hex} pasos ${oklchStops.length}`,
);
