import { apcaContrast } from "./apca";
import { contrastVerdict, fromOklch, generateStops } from "./color";
import { createShadowScale, normalizeShadow, shadowCss } from "./shadow";
import { cssForExport, exportSystem, pluginLibrary } from "./export";
import { createMotionScale, durationMs, normalizeMotion } from "./motion";
import { blurDtcg, blurSpecimens, configureBlur, createBlurScale, editBlurValue } from "./blur";
import { borderDtcg, borderSpecimens, configureBorder, createBorderScale, editBorderValue } from "./border";
import { createRadiusScale, editRadiusValue, radiusDtcg, radiusSpecimens, configureRadius } from "./radius";
import { zipStore } from "./zip";
import {
  createDefaultProject,
  createExampleProject,
  createRamp,
  createSet,
  normalizeProject,
  normalizeSystem,
  systemsFromJson,
} from "./project";
import {
  createSpacingScale,
  editSpacingValue,
  generatedSpacingValues,
  materialize,
  normalizeSpacing,
  restoreSpacing,
  selectSpacingMode,
  spacingDtcg,
} from "./spacing";
import { createDefaultTypeLibrary, createTypeCollection, figmaTextStyleName, normalizeTypeCollection, sizeForStep, stepsForCollection, typeSteps } from "./type";

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

const wcagBlack = contrastVerdict({ r: 0, g: 0, b: 0 }, "#ffffff", "wcag");
if (wcagBlack.score !== "21.00" || wcagBlack.grade !== "AAA") {
  throw new Error(`WCAG negro sobre blanco inesperado: ${wcagBlack.score} ${wcagBlack.grade}`);
}
const apcaBlack = contrastVerdict({ r: 0, g: 0, b: 0 }, "#ffffff", "apca");
if (apcaBlack.grade !== "Body" || !apcaBlack.passes) {
  throw new Error(`APCA negro sobre blanco debería ser Body, fue ${apcaBlack.score} ${apcaBlack.grade}`);
}

const blue = fromOklch(0.62, 0.15, 255);
if (blue.channels.b <= blue.channels.r) {
  throw new Error(`OKLCH 255 no parece azul: ${blue.hex}`);
}

if (createDefaultProject().systems.length !== 0 || normalizeProject({}).systems.length !== 0) {
  throw new Error("Un proyecto nuevo no debería traer ningún sistema.");
}
if (normalizeProject({ version: 2, systems: [] }).systems.length !== 0) {
  throw new Error("Un proyecto vacío no debería recibir un sistema de ejemplo.");
}
const project = createExampleProject();
const oklchRamp = project.systems[0]?.colors[0];
const apcaRamp = project.systems[0]?.colors[1];
if (!oklchRamp || !apcaRamp) throw new Error("Faltan rampas de ejemplo");

const oklchStops = generateStops(oklchRamp);
if (oklchStops[0]!.l <= oklchStops.at(-1)!.l) {
  throw new Error("La rampa OKLCH debería ir de clara a oscura");
}

const textStops = generateStops(apcaRamp);
if (textStops[0]!.l <= textStops.at(-1)!.l) {
  throw new Error("La rampa de texto debería ir de clara a oscura en OKLCH");
}

const zip = zipStore([{ name: "hola.txt", data: new TextEncoder().encode("hola") }]);
const zipView = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
if (zipView.getUint32(0, true) !== 0x04034b50 || !new TextDecoder().decode(zip).includes("hola.txt")) {
  throw new Error("El ZIP no tiene el formato esperado.");
}
let rejected = false;
try {
  zipStore([{ name: "../secreto.txt", data: new TextEncoder().encode("no") }]);
} catch {
  rejected = true;
}
if (!rejected) throw new Error("El ZIP ha aceptado una ruta fuera de la carpeta.");

const scale = typeSteps({ baseSize: 16, baseHeight: 1.5, ratio: 1.25, stepsAbove: 1, stepsBelow: 1 });
if (scale.map((step) => step.size).join(",") !== "12.8,16,20") {
  throw new Error(`La escala 16 × 1.25 no cuadra: ${scale.map((step) => step.size).join(",")}`);
}
if (scale.map((step) => step.height).join(",") !== "1.2,1.5,1.875") {
  throw new Error(`La altura 1.5 rem × 1.25 no cuadra: ${scale.map((step) => step.height).join(",")}`);
}
if (scale.map((step) => step.name).join(",") !== "sm,base,lg") {
  throw new Error(`Los nombres de la escala no cuadran: ${scale.map((step) => step.name).join(",")}`);
}
if (sizeForStep(16, 1.2, -1) !== 13.3) {
  throw new Error(`16 / 1.2 debería redondear a 13.3, fue ${sizeForStep(16, 1.2, -1)}`);
}
const whole = typeSteps({ baseSize: 16, baseHeight: 1.5, ratio: 1.2, stepsAbove: 1, stepsBelow: 1, wholePixels: true });
if (whole.map((step) => step.size).join(",") !== "13,16,19") {
  throw new Error(`Los píxeles enteros no cuadran: ${whole.map((step) => step.size).join(",")}`);
}
if (whole.map((step) => step.height).join(",") !== "1.25,1.5,1.8") {
  throw new Error(`La altura en rem no debe redondearse a píxeles: ${whole.map((step) => step.height).join(",")}`);
}
const sample = createTypeCollection("Texto", "type-check");
const sampleSteps = stepsForCollection(sample);
if (sampleSteps.length !== 6 || sampleSteps[0]?.step !== -1 || !sampleSteps.some((step) => step.step === 0 && step.size === 16)) {
  throw new Error("La colección de ejemplo no tiene la base y un paso por debajo.");
}
const again = stepsForCollection({ ...sample, stepsAbove: 2, stepsBelow: 2 });
if (again.length !== 5 || again[0]?.step !== -2) {
  throw new Error("Con 2 pasos por encima y 2 por debajo, el primer paso debería ser -2.");
}
const migrated = normalizeTypeCollection({
  fontFamily: "Inter",
  displayFamily: "Georgia",
  baseSize: 16,
  lineHeight: 1.5,
  count: 6,
  stepsBelow: 1,
});
if (migrated.families.map((family) => family.name).join(",") !== "Inter,Georgia") {
  throw new Error("La migración no ha separado la familia base y la de display.");
}
if (migrated.baseHeight !== 1.5 || migrated.stepsAbove !== 4) {
  throw new Error("La migración no ha calculado la altura base ni los pasos por encima.");
}
const fromPixels = normalizeTypeCollection({ baseSize: 16, baseHeight: 19.2, stepsAbove: 1, stepsBelow: 1 });
if (fromPixels.baseHeight !== 1.2) {
  throw new Error(`Una altura guardada en píxeles no ha pasado a rem: ${fromPixels.baseHeight}`);
}
if (figmaTextStyleName("Marca", "cuerpo") !== "Marca/cuerpo") {
  throw new Error("El nombre de estilo de Figma no usa colección/estilo.");
}
if (!createExampleProject().systems[0]?.type.families.length) {
  throw new Error("El proyecto de ejemplo no trae una familia tipográfica.");
}
const linearBody = generatedSpacingValues("linear", 4, 6, 1.5).join(",");
if (linearBody !== "4,8,12,16,20,24") throw new Error(`Lineal 4 × 6: ${linearBody}`);
const linear = materialize({ base: 4, mode: "linear", count: 6, ratio: 1.5, micro: false, customValues: [] });
if (linear.steps.map((step) => step.px).join(",") !== "0,4,8,12,16,20,24") {
  throw new Error(`Lineal debería empezar en 0: ${linear.steps.map((step) => step.px).join(",")}`);
}
if (linear.steps.map((step) => step.name).join(",") !== "0,100,200,300,400,500,600") {
  throw new Error(`Los nombres no van de cien en cien: ${linear.steps.map((step) => step.name).join(",")}`);
}
const jumpsBody = generatedSpacingValues("jumps", 4, 10, 1.5).join(",");
if (jumpsBody !== "4,8,12,16,24,32,40,48,64,80") throw new Error(`Con saltos 4 × 10: ${jumpsBody}`);
const fibBody = generatedSpacingValues("fibonacci", 4, 7, 1.5).join(",");
if (fibBody !== "4,8,12,20,32,52,84") throw new Error(`Fibonacci base 4: ${fibBody}`);
const ratioBody = generatedSpacingValues("ratio", 4, 6, 1.5).join(",");
if (ratioBody !== "4,6,9,14,20,30") throw new Error(`Ratio 1.5 base 4: ${ratioBody}`);
const collapsed = generatedSpacingValues("ratio", 8, 4, 1.1).join(",");
if (collapsed !== "8,9,10,11") throw new Error(`Un ratio que se aplasta no sigue creciendo: ${collapsed}`);
const micro = materialize({ base: 4, mode: "jumps", count: 4, ratio: 1.5, micro: true, customValues: [] });
if (micro.steps.map((step) => step.px).join(",") !== "0,2,4,6,8,12,16") {
  throw new Error(`Micro con base 4: ${micro.steps.map((step) => step.px).join(",")}`);
}
if (micro.steps[1]?.name !== "50" || !micro.steps[1]?.micro) throw new Error("El primer micro debería ser spacing/50.");
if (!micro.steps.some((step) => step.px === 6 && step.micro)) throw new Error("6 px debería seguir marcado como micro.");
const half = materialize({ base: 5, mode: "ratio", count: 4, ratio: 1.5, micro: true, customValues: [] });
if (half.steps.map((step) => step.px).join(",") !== "0,2.5,5,8,11,17") {
  throw new Error(`Base impar: ${half.steps.map((step) => step.px).join(",")}`);
}
for (const mode of ["linear", "jumps", "ratio", "fibonacci"] as const) {
  const values = materialize({ base: 4, mode, count: 10, ratio: 1.333, micro: true, customValues: [] }).steps.map((step) => step.px);
  for (let index = 1; index < values.length; index += 1) {
    if (values[index]! <= values[index - 1]!) throw new Error(`${mode} repite o decrece: ${values.join(",")}`);
  }
  if (values.some((value) => !Number.isInteger(value))) throw new Error(`${mode} con base par no es entero.`);
}
const custom = materialize({ base: 4, mode: "custom", count: 10, ratio: 1.5, micro: false, customValues: [12, 4, 8, 4, 5] });
if (custom.steps.map((step) => step.px).join(",") !== "0,4,5,8,12") {
  throw new Error(`Custom no ordena: ${custom.steps.map((step) => step.px).join(",")}`);
}
if (!custom.steps.find((step) => step.px === 5)?.offGrid) throw new Error("5 px con base 4 debería avisar.");
const jumps = materialize({ base: 4, mode: "jumps", count: 10, ratio: 1.5, micro: false, customValues: [] });
const unchanged = editSpacingValue(jumps, "100", 4);
if (!unchanged.ok || unchanged.changed || unchanged.scale.mode !== "jumps") {
  throw new Error("Editar el mismo valor no debería pasar a Custom.");
}
const edited = editSpacingValue(jumps, "100", 7);
if (!edited.ok || edited.scale.mode !== "custom" || !edited.scale.edited) {
  throw new Error("Editar un salto debería pasar a Custom.");
}
if (edited.scale.steps.map((step) => step.px).join(",") !== "0,7,8,12,16,24,32,40,48,64,80") {
  throw new Error(`La edición no conservó el resto: ${edited.scale.steps.map((step) => step.px).join(",")}`);
}
const restored = restoreSpacing(edited.scale);
if (restored.mode !== "jumps" || restored.steps.map((step) => step.px).join(",") !== jumps.steps.map((step) => step.px).join(",")) {
  throw new Error("Deshacer no devolvió la escala generada.");
}
const duplicate = editSpacingValue(jumps, "200", 4);
if (duplicate.ok) throw new Error("Un valor repetido debería rechazarse.");
const ratioScale = materialize({ base: 4, mode: "ratio", count: 6, ratio: 1.5, micro: false, customValues: [] });
const ratioEdit = editSpacingValue(ratioScale, "200", 7);
if (!ratioEdit.ok || ratioEdit.scale.mode !== "custom") throw new Error("Editar Ratio debería pasar a Custom.");
const ratioPx = ratioEdit.scale.steps.map((step) => step.px);
if (ratioPx.join(",") !== "0,4,7,9,14,20,30") throw new Error(`Ratio editado: ${ratioPx.join(",")}`);
if (restoreSpacing(ratioEdit.scale).steps.map((step) => step.px).join(",") !== ratioScale.steps.map((step) => step.px).join(",")) {
  throw new Error("Restablecer no volvió al ratio generado.");
}
const kept = selectSpacingMode(materialize({ base: 4, mode: "jumps", count: 10, ratio: 1.5, micro: false, customValues: [3, 9] }), "custom");
if (kept.mode !== "custom" || kept.customValues.join(",") !== "3,9") throw new Error("Custom no conservó los valores previos.");
const back = selectSpacingMode(kept, "jumps");
if (back.mode !== "jumps" || back.customValues.join(",") !== "3,9") throw new Error("Salir de Custom borró los valores.");
const legacySpacing = normalizeSpacing({
  base: 4,
  steps: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((multiplier) => ({ multiplier, px: 4 * multiplier })),
});
if (legacySpacing.mode !== "jumps" || legacySpacing.steps.map((step) => step.px).join(",") !== jumps.steps.map((step) => step.px).join(",")) {
  throw new Error("La escala antigua por defecto no pasó a Con saltos.");
}
const legacyCustom = normalizeSpacing({ base: 4, steps: [{ multiplier: 1, px: 4 }, { multiplier: 2, px: 10 }] });
if (legacyCustom.mode !== "custom" || legacyCustom.steps.map((step) => step.px).join(",") !== "0,4,10") {
  throw new Error("Una escala antigua editada no se conservó.");
}
const fresh = createSpacingScale();
if (fresh.mode !== "jumps" || fresh.base !== 4 || fresh.count !== 10 || fresh.micro || fresh.ratio !== 1.5) {
  throw new Error("La escala nueva no usa base 4, 10 pasos, ratio 1.5 y Con saltos.");
}
const twoMicros = materialize({ base: 4, mode: "custom", count: 4, ratio: 1.5, micro: true, customValues: [8, 16] });
if (twoMicros.steps.map((step) => `${step.name}:${step.px}`).join(",") !== "0:0,50:2,75:6,100:8,200:16") {
  throw new Error(`Dos micros: ${twoMicros.steps.map((step) => `${step.name}:${step.px}`).join(",")}`);
}
const dtcg = spacingDtcg(fresh);
if (dtcg.spacing["100"]?.$type !== "dimension" || dtcg.spacing["100"]?.$value !== "4px" || dtcg.spacing["100"]?.$extensions["com.foundry.rem"] !== "0.25rem") {
  throw new Error(`DTCG de spacing/100 inesperado: ${JSON.stringify(dtcg.spacing["100"])}`);
}
if (shadowCss({ y: 0, blur: 0, spread: 0, opacity: 0 }, "#000000") !== "none") {
  throw new Error("La sombra vacía debería ser none.");
}
if (!shadowCss({ y: 4, blur: 8, spread: -1, opacity: 0.1 }, "#000000").includes("rgba(0, 0, 0, 0.1)")) {
  throw new Error("La sombra no se ha escrito en CSS.");
}
const shadow = createShadowScale();
if (shadow.levels.map((level) => level.name).join(",") !== "100,200,300,400,500") {
  throw new Error(`Las claves de sombra no van de cien en cien: ${shadow.levels.map((level) => level.name).join(",")}`);
}
if (shadow.levels.some((level) => level.y === 0 && level.blur === 0 && level.spread === 0)) {
  throw new Error("La escala de sombra no debería incluir un nivel vacío.");
}
const shadowRenamed = normalizeShadow({
  ...shadow,
  levels: shadow.levels.map((level, index) => ({ ...level, name: ["sm", "md", "lg", "xl", "2xl"][index] || "3xl" })),
});
if (shadowRenamed.levels.map((level) => level.name).join(",") !== "100,200,300,400,500") {
  throw new Error("Un nombre semántico de sombra no ha pasado a shadow/100.");
}
const shadowWithNone = normalizeShadow({
  ...shadow,
  levels: [
    { id: "empty", name: "0", y: 0, blur: 0, spread: 0, opacity: 0 },
    ...shadow.levels,
  ],
});
if (shadowWithNone.levels.map((level) => level.name).join(",") !== "100,200,300,400,500") {
  throw new Error("Un shadow/0 vacío no se ha eliminado al normalizar.");
}
const shadowToken = exportSystem(normalizeSystem({ name: "Elev", shadow })).sets[0]?.variables.find(
  (variable) => variable.name === "shadow/100",
);
if (shadowToken?.code !== "--shadow-100" || !shadowToken.css.includes("px")) {
  throw new Error(`El token shadow/100 no se ha exportado: ${shadowToken?.name} ${shadowToken?.code}`);
}
const legacyShadow = normalizeSystem({ name: "Old", elevation: { ...shadow, baseY: 7 }, lastSection: "elevation" } as never);
if (legacyShadow.shadow.baseY !== 7 || legacyShadow.lastSection !== "shadow") {
  throw new Error("Un proyecto guardado con 'elevation' no se ha migrado a 'shadow'.");
}
if (durationMs(160, 1.5, 0) !== 0 || durationMs(160, 1.5, 1) !== 160 || durationMs(160, 1.5, 2) !== 240) {
  throw new Error("La duración no sigue 0 ms, base, y base × ratio.");
}
const motion = createMotionScale();
if (motion.durations.map((item) => item.name).join(",") !== "0,100,200,300") {
  throw new Error(`Las duraciones no van de cien en cien: ${motion.durations.map((item) => item.name).join(",")}`);
}
if (motion.delays.map((item) => item.name).join(",") !== "0,100,200,300" || motion.delays[1]?.ms !== 80) {
  throw new Error("La escala de delay no arranca en motion/delay/100.");
}
if (motion.curves.map((item) => item.name).join(",") !== "0,100,200,300") {
  throw new Error("Las curvas no usan motion/curve/0, 100, 200, 300.");
}
const motionTokens = exportSystem(normalizeSystem({ name: "Move", motion })).sets[0]?.variables ?? [];
const motionName = (name: string) => motionTokens.find((variable) => variable.name === name);
if (motionName("motion/duration/100")?.css !== "160ms" || motionName("motion/duration/100")?.code !== "--motion-duration-100") {
  throw new Error("motion/duration/100 no se ha exportado.");
}
if (motionName("motion/delay/100")?.css !== "80ms" || motionName("motion/delay/100")?.code !== "--motion-delay-100") {
  throw new Error("motion/delay/100 no se ha exportado.");
}
if (motionName("motion/curve/100")?.code !== "--motion-curve-100") {
  throw new Error("motion/curve/100 no se ha exportado.");
}
if (motionTokens.some((variable) => variable.name.startsWith("motion/easing/"))) {
  throw new Error("Las curvas siguen exportándose como easing.");
}
const renamedMotion = normalizeMotion({
  baseMs: 160,
  ratio: 1.5,
  count: 3,
  durations: [{ id: "a", name: "fast", ms: 71, step: -1 }],
  curves: [{ id: "c", name: "standard", curve: "linear" }],
});
if (renamedMotion.durations[0]?.name !== "0" || renamedMotion.durations[1]?.ms !== 160 || renamedMotion.curves[0]?.curve !== "linear") {
  throw new Error("Un motion antiguo no ha pasado a los nombres 0, 100, 200.");
}
const legacyCurves = { easings: [{ id: "e", name: "standard", curve: "ease-in" }] };
if (normalizeMotion(legacyCurves).curves[0]?.name !== "0" || normalizeMotion(legacyCurves).curves[0]?.curve !== "ease-in") {
  throw new Error("Las curvas antiguas no han pasado a motion/curve.");
}
const legacy = normalizeProject({
  version: 1 as const,
  sets: [createSet("Marca", [createRamp("Azul")]), createSet("Neutros", [createRamp("Gris")])],
  type: createDefaultTypeLibrary(),
});
if (legacy.systems.length !== 1 || legacy.systems[0]?.colors.length !== 2) {
  throw new Error("Un proyecto antiguo no se ha convertido en un solo sistema.");
}
if (legacy.systems[0]?.type.families.length === 0) {
  throw new Error("La migración no ha conservado la tipografía activa.");
}
const two = normalizeProject({
  version: 2,
  activeSystemId: "b",
  systems: [
    { id: "a", name: "Uno" },
    { id: "b", name: "Dos" },
  ],
});
if (two.systems.length !== 2 || two.activeSystemId !== "b" || two.systems[1]?.name !== "Dos") {
  throw new Error("Varios sistemas no se han conservado.");
}
const remembered = normalizeProject({
  version: 2,
  activeSystemId: "a",
  systems: [
    {
      id: "a",
      name: "Uno",
      starred: true,
      aliases: [{ id: "alias-1", name: "bg/canvas", rampId: "ramp-1", step: "500" }],
    },
  ],
});
const saved = remembered.systems[0];
if (!saved?.starred) throw new Error("El favorito no se ha conservado.");
if (saved.accent !== "slate") throw new Error("Un sistema sin color vuelve a transparente.");
const colored = normalizeProject({
  version: 2,
  activeSystemId: "a",
  systems: [{ id: "a", name: "Uno", accent: "violet" }],
});
if (colored.systems[0]?.accent !== "violet") throw new Error("El color del sistema no se ha conservado.");
if (normalizeSystem({ name: "X", accent: "rainbow" as never }).accent !== "slate") {
  throw new Error("Un color desconocido no vuelve a transparente.");
}
if (saved.aliases.length !== 1 || saved.aliases[0]?.name !== "bg/canvas" || saved.aliases[0]?.step !== "500") {
  throw new Error("El semantic no se ha conservado.");
}
if (two.systems[0]?.colors.length === 0 || two.systems[1]?.type.families.length === 0) {
  throw new Error("Un sistema nuevo no trae color y tipografía propios.");
}
const spaced = exportSystem({ ...project.systems[0]!, colors: [createRamp("Blue text")] });
const spacedColor = spaced.sets[0]?.variables.find((variable) => variable.type === "COLOR");
if (spacedColor?.name !== "color/Blue-text/50" || spacedColor.code !== "--color-blue-text-50") {
  throw new Error(`El nombre de color conserva espacios: ${spacedColor?.name} ${spacedColor?.code}`);
}
const exported = exportSystem(project.systems[0]!);
const kinds = new Set(exported.sets[0]?.variables.map((variable) => variable.type));
if (!kinds.has("COLOR") || !kinds.has("FLOAT") || !kinds.has("STRING")) {
  throw new Error("La exportación del sistema no incluye color, número y texto.");
}
const spaceToken = exported.sets[0]?.variables.find((variable) => variable.name === "spacing/100");
if (spaceToken?.css !== "4px" || spaceToken.code !== "--spacing-100" || !spaceToken.description.includes("0.25rem")) {
  throw new Error(`El token spacing/100 no es 4px: ${spaceToken?.name} ${spaceToken?.css} ${spaceToken?.code}`);
}
if (!cssForExport(exported).includes("  --spacing-100: 4px;")) {
  throw new Error("El CSS no incluye --spacing-100: 4px.");
}
const withoutSpacing = exportSystem(project.systems[0]!, ["color", "type"]);
if (withoutSpacing.sets[0]?.variables.some((variable) => variable.name.startsWith("spacing/") || variable.name.startsWith("border/"))) {
  throw new Error("Un foundation desmarcado sigue en la exportación.");
}
if (!withoutSpacing.sets[0]?.variables.some((variable) => variable.name.startsWith("color/"))) {
  throw new Error("Un foundation marcado no llega a la exportación.");
}
if ((exportSystem(project.systems[0]!, []).sets[0]?.variables.length ?? 1) !== 0) {
  throw new Error("Sin foundations la exportación no queda vacía.");
}
const radiusScale = createRadiusScale();
if (!radiusScale.full || radiusScale.mode !== "jumps" || radiusScale.base !== 4 || radiusScale.count !== 4) {
  throw new Error("La escala de radius nueva no usa base 4, 4 pasos, Con saltos y Full.");
}
if (radiusScale.steps.map((step) => step.px).join(",") !== "0,4,8,12,16") {
  throw new Error(`Radius con saltos: ${radiusScale.steps.map((step) => step.px).join(",")}`);
}
const radiusUses = radiusSpecimens(radiusScale);
const radiusUse = (id: string) => radiusUses.find((item) => item.id === id);
if (radiusUse("button")?.token !== "radius/100" || radiusUse("button")?.px !== 4) {
  throw new Error("El botón debería usar radius/100.");
}
if (radiusUse("card")?.token !== "radius/200" || radiusUse("card")?.px !== 8) {
  throw new Error(`La tarjeta debería usar el paso de en medio: ${radiusUse("card")?.token}`);
}
if (radiusUse("dialog")?.token !== "radius/400" || radiusUse("chip")?.token !== "radius/full" || !radiusUse("avatar")?.pill) {
  throw new Error("El diálogo, el chip o el avatar no usan el paso esperado.");
}
const radiusEdited = editRadiusValue(radiusScale, "100", 6);
if (!radiusEdited.ok || radiusEdited.scale.mode !== "custom" || !radiusEdited.scale.full) {
  throw new Error("Editar radius debería pasar a Custom y conservar Full.");
}
const radiusOff = configureRadius(radiusScale, { full: false });
if (radiusSpecimens(radiusOff).find((item) => item.id === "chip")?.token !== "radius/400") {
  throw new Error("Sin Full, el chip debería usar el paso más grande.");
}
const oneStep = configureRadius(radiusScale, { count: 1 });
if (oneStep.count !== 1 || oneStep.steps.map((step) => step.px).join(",") !== "0,4") {
  throw new Error(`Radius con 1 paso: ${oneStep.steps.map((step) => step.px).join(",")}`);
}
const tooMany = configureRadius(radiusScale, { count: 8 });
if (tooMany.count !== 4 || tooMany.steps.filter((step) => step.px > 0).length !== 4) {
  throw new Error("Radius no debe pasar de 4 pasos positivos.");
}
const radiusFile = radiusDtcg(radiusScale);
if (radiusFile.radius["100"]?.$value !== "4px" || radiusFile.radius.full?.$value !== "9999px") {
  throw new Error(`DTCG de radius inesperado: ${JSON.stringify(radiusFile.radius.full)}`);
}
const radiusToken = exported.sets[0]?.variables.find((variable) => variable.name === "radius/100");
const radiusFull = exported.sets[0]?.variables.find((variable) => variable.name === "radius/full");
if (radiusToken?.css !== "4px" || radiusToken.code !== "--radius-100" || radiusFull?.css !== "9999px" || radiusFull?.code !== "--radius-full") {
  throw new Error(`El token radius no se exporta: ${radiusToken?.css} ${radiusFull?.css}`);
}
if (!cssForExport(exported).includes("  --radius-full: 9999px;")) {
  throw new Error("El CSS no incluye --radius-full.");
}
if (normalizeSystem({ name: "Old" }).radius.steps[1]?.name !== "100") {
  throw new Error("Un sistema antiguo no recibe la escala de radius.");
}
const borderScale = createBorderScale();
if (borderScale.mode !== "linear" || borderScale.base !== 1 || borderScale.count !== 4) {
  throw new Error("La escala de border nueva no usa base 1, 4 pasos y Linear.");
}
if (borderScale.steps.map((step) => step.px).join(",") !== "1,2,3,4") {
  throw new Error(`Border lineal: ${borderScale.steps.map((step) => step.px).join(",")}`);
}
const borderUses = borderSpecimens(borderScale);
const borderUse = (id: string) => borderUses.find((item) => item.id === id);
if (borderUse("divider")?.token !== "border/100" || borderUse("divider")?.px !== 1) {
  throw new Error("El divisor debería usar border/100.");
}
if (borderUse("field")?.token !== "border/200" || borderUse("card")?.token !== "border/300" || borderUse("focus")?.token !== "border/400") {
  throw new Error(
    `Los ejemplos de border no usan los pasos esperados: ${borderUse("field")?.token} ${borderUse("card")?.token} ${borderUse("focus")?.token}`,
  );
}
const borderEdited = editBorderValue(borderScale, "100", 1.5);
if (!borderEdited.ok || borderEdited.scale.mode !== "custom" || borderEdited.scale.steps[0]?.px !== 1.5) {
  throw new Error("Editar border debería pasar a Custom.");
}
const twoSteps = configureBorder(borderScale, { count: 2 });
if (twoSteps.count !== 2 || twoSteps.steps.map((step) => step.px).join(",") !== "1,2") {
  throw new Error(`Border con 2 pasos: ${twoSteps.steps.map((step) => step.px).join(",")}`);
}
const tooFew = configureBorder(borderScale, { count: 1 });
if (tooFew.count !== 2) throw new Error("Border no debe bajar de 2 pasos.");
const tooWide = configureBorder(borderScale, { count: 8 });
if (tooWide.count !== 4 || tooWide.steps.length !== 4) throw new Error("Border no debe pasar de 4 pasos.");
const borderFile = borderDtcg(borderScale);
if (borderFile.border["100"]?.$value !== "1px" || borderFile.border["400"]?.$value !== "4px") {
  throw new Error(`DTCG de border inesperado: ${JSON.stringify(borderFile.border["100"])}`);
}
const borderToken = exported.sets[0]?.variables.find((variable) => variable.name === "border/100");
if (borderToken?.css !== "1px" || borderToken.code !== "--border-100") {
  throw new Error(`El token border no se exporta: ${borderToken?.css} ${borderToken?.code}`);
}
if (!cssForExport(exported).includes("  --border-100: 1px;")) {
  throw new Error("El CSS no incluye --border-100.");
}
if (normalizeSystem({ name: "Old" }).border.steps[0]?.name !== "100") {
  throw new Error("Un sistema antiguo no recibe la escala de border.");
}
const blurScale = createBlurScale();
if (blurScale.mode !== "jumps" || blurScale.base !== 4 || blurScale.count !== 4) {
  throw new Error("La escala de blur nueva no usa base 4, 4 pasos y Con saltos.");
}
if (blurScale.steps.map((step) => step.px).join(",") !== "0,4,8,12,16") {
  throw new Error(`Blur con saltos: ${blurScale.steps.map((step) => step.px).join(",")}`);
}
const blurUses = blurSpecimens(blurScale);
const blurUse = (id: string) => blurUses.find((item) => item.id === id);
if (blurUse("tooltip")?.token !== "blur/100" || blurUse("tooltip")?.px !== 4) {
  throw new Error("El tooltip debería usar blur/100.");
}
if (blurUse("topnav")?.token !== "blur/200" || blurUse("popover")?.token !== "blur/300" || blurUse("overlay")?.token !== "blur/400") {
  throw new Error(
    `Los ejemplos de blur no usan los pasos esperados: ${blurUse("topnav")?.token} ${blurUse("popover")?.token} ${blurUse("overlay")?.token}`,
  );
}
const blurEdited = editBlurValue(blurScale, "100", 6);
if (!blurEdited.ok || blurEdited.scale.mode !== "custom" || blurEdited.scale.steps[0]?.px !== 0) {
  throw new Error("Editar blur debería pasar a Custom y conservar blur/0.");
}
const blurRejected = editBlurValue(blurScale, "0", 2);
if (blurRejected.ok) throw new Error("blur/0 no se puede editar.");
const oneBlur = configureBlur(blurScale, { count: 1 });
if (oneBlur.count !== 1 || oneBlur.steps.map((step) => step.px).join(",") !== "0,4") {
  throw new Error(`Blur con 1 paso: ${oneBlur.steps.map((step) => step.px).join(",")}`);
}
const tooMuchBlur = configureBlur(blurScale, { count: 8 });
if (tooMuchBlur.count !== 4 || tooMuchBlur.steps.filter((step) => step.px > 0).length !== 4) {
  throw new Error("Blur no debe pasar de 4 pasos positivos.");
}
const blurFile = blurDtcg(blurScale);
if (blurFile.blur["0"]?.$value !== "0px" || blurFile.blur["100"]?.$value !== "4px" || blurFile.blur["200"]?.$value !== "8px") {
  throw new Error(`DTCG de blur inesperado: ${JSON.stringify(blurFile.blur["100"])}`);
}
const blurToken = exported.sets[0]?.variables.find((variable) => variable.name === "blur/100");
if (blurToken?.css !== "4px" || blurToken.code !== "--blur-100") {
  throw new Error(`El token blur no se exporta: ${blurToken?.css} ${blurToken?.code}`);
}
if (!cssForExport(exported).includes("  --blur-100: 4px;")) {
  throw new Error("El CSS no incluye --blur-100.");
}
if (normalizeSystem({ name: "Old" }).blur.steps[1]?.name !== "100") {
  throw new Error("Un sistema antiguo no recibe la escala de blur.");
}
const typed = {
  ...project.systems[0]!,
  type: {
    ...project.systems[0]!.type,
    baseSize: 16,
    baseHeight: 1.5,
    ratioId: "major-third" as const,
    stepsAbove: 1,
    stepsBelow: 1,
    families: [
      { id: "f1", name: "Inter" },
      { id: "f2", name: "Georgia" },
    ],
  },
};
const fontVariables = exportSystem(typed).sets[0]?.variables ?? [];
const fontName = (name: string) => fontVariables.find((variable) => variable.name === name);
if (fontName("font/family/font-1")?.text !== "Inter" || fontName("font/family/font-2")?.text !== "Georgia") {
  throw new Error("La tipografía no exporta las familias como font-1 y font-2.");
}
if (fontName("font/weight/01")?.number !== 200 || fontName("font/weight/03")?.number !== 400 || fontName("font/weight/08")?.number !== 900) {
  throw new Error("Los pesos no se generan como font/weight/01 = 200 hasta 08 = 900.");
}
if (fontVariables.some((variable) => variable.name === "font/weight/regular" || variable.name === "font/weight/bold")) {
  throw new Error("Los pesos siguen usando nombres elegidos a mano.");
}
if (fontName("font/size/base")?.number !== 16 || fontName("font/size/lg")?.number !== 20 || fontName("font/height/base")?.css !== "1.5rem") {
  throw new Error("Cada paso no tiene size en px y height en rem dentro de font.");
}
if (fontName("font/height/sm")?.number !== 1.2) {
  throw new Error("La altura por debajo de la base no sigue el ratio.");
}
if (
  fontVariables.some(
    (variable) =>
      variable.name === "font-family" ||
      variable.name.startsWith("font/style") ||
      variable.name.startsWith("font/line-height") ||
      variable.name === "font/family/lg" ||
      variable.name === "font/family/base" ||
      variable.name === "font/family/display",
  )
) {
  throw new Error("La exportación sigue mezclando estilos o roles con los primitivos de font.");
}
const library = pluginLibrary(project.systems, project.activeSystemId);
if (library.kind !== "library" || library.systems.length !== project.systems.length) {
  throw new Error("La librería del plugin no lista los sistemas.");
}
const open = library.systems.find((system) => system.active);
if (!open || open.type.collections.length === 0) {
  throw new Error("La librería del plugin no incluye los estilos del sistema abierto.");
}
if (!open.definition || open.definition.colors.length !== project.systems[0]!.colors.length) {
  throw new Error("La librería del plugin no embebe la definición editable del sistema.");
}

const source = project.systems[0]!;
const tokenFile = exportSystem(source);
if (!tokenFile.definition || tokenFile.definition.id !== source.id) {
  throw new Error("tokens.json no incluye la definición editable del sistema.");
}
const fromTokens = systemsFromJson(tokenFile);
if (fromTokens.length !== 1 || fromTokens[0]!.id === source.id) {
  throw new Error("Importar tokens.json no crea un sistema nuevo.");
}
if (
  fromTokens[0]!.colors.length !== source.colors.length ||
  fromTokens[0]!.spacing.steps.length !== source.spacing.steps.length ||
  fromTokens[0]!.name !== source.name
) {
  throw new Error("Importar tokens.json no recrea el design system.");
}
const fromLibrary = systemsFromJson(library);
if (fromLibrary.length !== project.systems.length || fromLibrary[0]!.colors.length !== source.colors.length) {
  throw new Error("Importar el JSON del plugin no recrea los sistemas.");
}
const legacyExport = { source: "creator", kind: "system", id: "x", name: "Old", sets: [{ id: "x", name: "Old", variables: [] }] };
try {
  systemsFromJson(legacyExport);
  throw new Error("Un export antiguo sin definition debería rechazarse.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("editable system definition")) {
    throw error;
  }
}

console.log(
  `ok apca ${blackOnWhite.toFixed(2)} / ${whiteOnBlack.toFixed(2)} azul ${blue.hex} pasos ${oklchStops.length}`,
);
