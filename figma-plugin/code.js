const PORT = 4317;

figma.showUI(__html__, { width: 400, height: 680, themeColors: true });

figma.ui.onmessage = async (message) => {
  if (message.type === "close") {
    figma.closePlugin();
    return;
  }

  if (message.type === "import-type" && message.file && Array.isArray(message.file.collections)) {
    try {
      const selected = new Set(message.collectionIds || []);
      const collections = message.file.collections.filter((item) => selected.size === 0 || selected.has(item.id));
      const result = await importTypeStyles(collections, message.groupName);
      const parts = [`${result.created} new styles`, `${result.updated} updated`];
      if (result.linked) parts.push(`${result.linked} with a token`);
      if (result.removed) parts.push(`${result.removed} duplicates removed`);
      figma.notify(`DSfoundry: ${parts.join(", ")}`);
      figma.closePlugin();
    } catch (error) {
      figma.ui.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Could not create the text styles.",
      });
    }
    return;
  }

  if (message.type === "create") {
    try {
      const sets = message.file && Array.isArray(message.file.sets) ? message.file.sets : [];
      const variableResult = await importVariableSets(sets);
      let typeResult = null;
      const typeCollections =
        message.includeStyles && message.typeFile && Array.isArray(message.typeFile.collections)
          ? message.typeFile.collections
          : [];
      const selectedTypes = new Set(message.collectionIds || []);
      const collections = typeCollections.filter((item) => selectedTypes.size === 0 || selectedTypes.has(item.id));
      if (collections.length > 0) typeResult = await importTypeStyles(collections, message.groupName);
      const variableCount = sets.reduce(
        (sum, set) => sum + (set && Array.isArray(set.variables) ? set.variables.length : 0),
        0,
      );
      if (variableCount === 0 && !typeResult) throw new Error("Choose at least one group to create.");
      const parts = [];
      if (variableCount > 0) {
        parts.push(`${variableResult.created} new variables`, `${variableResult.updated} updated`);
        if (variableResult.skipped) parts.push(`${variableResult.skipped} skipped`);
      }
      if (typeResult) {
        parts.push(`${typeResult.created} new styles`, `${typeResult.updated} styles updated`);
        if (typeResult.linked) parts.push(`${typeResult.linked} linked to a token`);
      }
      figma.notify(`DSfoundry: ${parts.join(", ")}`);
      figma.closePlugin();
    } catch (error) {
      figma.ui.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Could not create the selection.",
      });
    }
    return;
  }

  if (message.type !== "import" || !message.file || !Array.isArray(message.file.sets)) {
    figma.ui.postMessage({ type: "error", message: "The JSON does not come from DSfoundry." });
    return;
  }

  try {
    const selected = new Set(message.setIds || []);
    const sets = message.file.sets.filter((set) => selected.size === 0 || selected.has(set.id));
    if (message.destination === "frame") {
      const count = await paintRamps(sets);
      figma.notify(`DSfoundry: ${count} colors in a frame`);
      figma.closePlugin();
      return;
    }
    const result = await importVariableSets(sets);
    const parts = [`${result.created} new`, `${result.updated} updated`];
    if (result.skipped) parts.push(`${result.skipped} skipped`);
    figma.notify(`DSfoundry: ${parts.join(", ")}`);
    figma.closePlugin();
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Could not create the variables.",
    });
  }
};

async function importVariableSets(sets) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const usable = (sets || []).filter((set) => set && Array.isArray(set.variables) && set.variables.length > 0);
  if (usable.length === 0) return { created, updated, skipped };

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = [];
  for (const kind of ["COLOR", "FLOAT", "STRING"]) {
    variables.push(...(await figma.variables.getLocalVariablesAsync(kind)));
  }

  for (const set of usable) {
    let collection = collections.find((item) => item.name === set.name);
    let modeId;
    if (!collection) {
      collection = figma.variables.createVariableCollection(set.name);
      collections.push(collection);
      modeId = collection.modes[0].modeId;
      collection.renameMode(modeId, "Default");
    } else {
      modeId = collection.defaultModeId;
    }

    const byName = new Map(
      variables
        .filter((variable) => variable.variableCollectionId === collection.id)
        .map((variable) => [variable.name, variable]),
    );

    for (const item of set.variables) {
      const kind = item.type === "FLOAT" || item.type === "STRING" ? item.type : "COLOR";
      let variable = byName.get(item.name);
      if (variable && variable.resolvedType !== kind) {
        skipped += 1;
        continue;
      }
      if (!variable) {
        variable = figma.variables.createVariable(item.name, collection, kind);
        byName.set(item.name, variable);
        created += 1;
      } else {
        updated += 1;
      }
      variable.description = item.description || "";
      if (item.code) variable.setVariableCodeSyntax("WEB", item.code);
      if (kind === "COLOR" && item.color) {
        variable.setValueForMode(modeId, {
          r: item.color.r,
          g: item.color.g,
          b: item.color.b,
          a: 1,
        });
      } else if (kind === "FLOAT" && Number.isFinite(Number(item.number))) {
        variable.setValueForMode(modeId, Number(item.number));
      } else if (kind === "STRING") {
        variable.setValueForMode(modeId, String(item.text ?? ""));
      }
    }
  }

  return { created, updated, skipped };
}

function appendSized(parent, node, horizontal, vertical) {
  parent.appendChild(node);
  node.layoutSizingHorizontal = horizontal;
  node.layoutSizingVertical = vertical;
  return node;
}

function wrappingRow(name, width) {
  const row = figma.createFrame();
  row.name = name;
  row.layoutMode = "HORIZONTAL";
  row.layoutWrap = "WRAP";
  row.itemSpacing = 8;
  row.counterAxisSpacing = 12;
  row.fills = [];
  row.primaryAxisSizingMode = "FIXED";
  row.resize(width, 100);
  row.counterAxisSizingMode = "AUTO";
  return row;
}

function rampsOf(set) {
  const groups = new Map();
  for (const item of set.variables || []) {
    if (!item || !item.color || item.type === "FLOAT" || item.type === "STRING") continue;
    let name = String(item.name || "color/value");
    if (name.startsWith("color/")) name = name.slice("color/".length);
    const slash = name.indexOf("/");
    const rampName = slash === -1 ? set.name : name.slice(0, slash);
    const step = slash === -1 ? name : name.slice(slash + 1);
    const list = groups.get(rampName) || [];
    list.push({ step, hex: item.hex || "", color: item.color });
    groups.set(rampName, list);
  }
  return [...groups.entries()];
}

function placeBesideContent(node) {
  let right = 0;
  for (const child of figma.currentPage.children) {
    if (child === node || !("x" in child) || !("width" in child)) continue;
    right = Math.max(right, child.x + child.width);
  }
  node.x = right === 0 ? 0 : right + 80;
  node.y = 0;
}

async function paintRamps(sets) {
  const usable = sets
    .map((set) => ({ name: String(set.name || "Colors"), ramps: rampsOf(set) }))
    .filter((set) => set.ramps.length > 0);
  if (usable.length === 0) throw new Error("The chosen collections have no colors.");

  let fontReady = false;
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    fontReady = true;
  } catch {
    fontReady = false;
  }

  const baseName = usable.length === 1 ? usable[0].name : "Ramps";
  const taken = new Set(figma.currentPage.children.map((child) => child.name));
  let frameName = baseName;
  let suffix = 2;
  while (taken.has(frameName)) {
    frameName = `${baseName} ${suffix}`;
    suffix += 1;
  }

  const board = figma.createFrame();
  board.name = frameName;
  board.layoutMode = "VERTICAL";
  board.primaryAxisSizingMode = "AUTO";
  board.counterAxisSizingMode = "AUTO";
  board.itemSpacing = 32;
  board.paddingLeft = 32;
  board.paddingRight = 32;
  board.paddingTop = 32;
  board.paddingBottom = 32;
  board.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  figma.currentPage.appendChild(board);

  let count = 0;
  const ink = { r: 0.12, g: 0.12, b: 0.12 };
  const mute = { r: 0.4, g: 0.4, b: 0.4 };

  for (const set of usable) {
    const section = usable.length === 1 ? board : figma.createFrame();
    if (section !== board) {
      section.name = set.name;
      section.layoutMode = "VERTICAL";
      section.primaryAxisSizingMode = "AUTO";
      section.counterAxisSizingMode = "AUTO";
      section.itemSpacing = 20;
      section.fills = [];
      if (fontReady) appendSized(section, label(set.name, 20, ink), "HUG", "HUG");
      appendSized(board, section, "HUG", "HUG");
    }

    for (const [rampName, stops] of set.ramps) {
      const block = figma.createFrame();
      block.name = rampName;
      block.layoutMode = "VERTICAL";
      block.primaryAxisSizingMode = "AUTO";
      block.counterAxisSizingMode = "AUTO";
      block.itemSpacing = 8;
      block.fills = [];
      if (fontReady) appendSized(block, label(rampName, 14, ink), "HUG", "HUG");

      const row = wrappingRow(`${rampName} pasos`, Math.min(Math.max(stops.length, 1) * 76, 920));
      appendSized(block, row, "FIXED", "HUG");
      appendSized(section, block, "HUG", "HUG");

      for (const stop of stops) {
        const swatch = figma.createFrame();
        swatch.name = `${rampName}/${stop.step}`;
        swatch.layoutMode = "VERTICAL";
        swatch.primaryAxisSizingMode = "AUTO";
        swatch.counterAxisSizingMode = "AUTO";
        swatch.itemSpacing = 6;
        swatch.fills = [];

        const chip = figma.createRectangle();
        chip.name = stop.hex || stop.step;
        chip.resize(64, 64);
        chip.cornerRadius = 8;
        chip.fills = [{
          type: "SOLID",
          color: {
            r: Number(stop.color.r) || 0,
            g: Number(stop.color.g) || 0,
            b: Number(stop.color.b) || 0,
          },
        }];
        appendSized(swatch, chip, "FIXED", "FIXED");
        if (fontReady) {
          appendSized(swatch, label(stop.step, 11, ink), "HUG", "HUG");
          if (stop.hex) appendSized(swatch, label(stop.hex, 10, mute), "HUG", "HUG");
        }
        appendSized(row, swatch, "HUG", "HUG");
        count += 1;
      }
      row.counterAxisSizingMode = "AUTO";
    }
  }

  placeBesideContent(board);
  figma.viewport.scrollAndZoomIntoView([board]);
  return count;
}

function label(characters, size, color) {
  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = size;
  text.characters = String(characters);
  text.fills = [{ type: "SOLID", color }];
  return text;
}

function normToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

const TEXT_SCOPE = {
  fontSize: "FONT_SIZE",
  lineHeight: "LINE_HEIGHT",
  letterSpacing: "LETTER_SPACING",
  fontFamily: "FONT_FAMILY",
  fontStyle: "FONT_STYLE",
  fontWeight: "FONT_WEIGHT",
};

function variableAllows(variable, field) {
  const numberField = field === "fontFamily" || field === "fontStyle" ? false : true;
  if (numberField && variable.resolvedType !== "FLOAT") return false;
  if (!numberField && variable.resolvedType !== "STRING") return false;
  const scopes = Array.isArray(variable.scopes) ? variable.scopes : [];
  if (scopes.length === 0 || scopes.includes("ALL_SCOPES")) return true;
  return scopes.includes(TEXT_SCOPE[field]);
}

function variableScopedTo(variable, field) {
  const scopes = Array.isArray(variable.scopes) ? variable.scopes : [];
  return scopes.includes(TEXT_SCOPE[field]);
}

function indexTextTokens(variables, collections) {
  const names = new Map(collections.map((collection) => [collection.id, collection.name]));
  const index = new Map();
  function add(key, variable) {
    const normalized = normToken(key);
    if (!normalized) return;
    const list = index.get(normalized) || [];
    list.push(variable);
    index.set(normalized, list);
  }
  for (const variable of variables) {
    if (!variable || (variable.resolvedType !== "FLOAT" && variable.resolvedType !== "STRING")) continue;
    add(variable.name, variable);
    const group = names.get(variable.variableCollectionId);
    if (group) add(`${group}/${variable.name}`, variable);
  }
  return index;
}

function firstToken(index, keys, field, openScope) {
  for (const key of keys) {
    for (const variable of index.get(normToken(key)) || []) {
      if (!variableAllows(variable, field)) continue;
      if (!openScope && !variableScopedTo(variable, field)) continue;
      return variable;
    }
  }
  return null;
}

function tokensForStyle(index, collectionName, styleName, figmaName) {
  const group = collectionName;
  const style = styleName;
  const named = [figmaName, `${group}/${style}`];
  const found = new Map();
  const size = firstToken(index, [
    ...named,
    `${group}/font-size/${style}`,
    `${group}/size/${style}`,
    `${group}/font/size/${style}`,
    `font-size/${style}`,
    `size/${style}`,
    `text/${style}`,
    `typography/${style}`,
    `font/size/${style}`,
    `font/${style}`,
  ], "fontSize", true);
  if (size) found.set("fontSize", size);

  const line = firstToken(index, [
    `${group}/font/line-height/${style}`,
    `font/line-height/${style}`,
    `${group}/line-height/${style}`,
    `${group}/leading/${style}`,
    `line-height/${style}`,
    `leading/${style}`,
  ], "lineHeight", true) || firstToken(index, named, "lineHeight", false);
  if (line && line !== size) found.set("lineHeight", line);

  const tracking = firstToken(index, [
    `${group}/letter-spacing/${style}`,
    `${group}/tracking/${style}`,
    `letter-spacing/${style}`,
    `tracking/${style}`,
  ], "letterSpacing", true) || firstToken(index, named, "letterSpacing", false);
  if (tracking) found.set("letterSpacing", tracking);

  const family = firstToken(index, [
    `${group}/font/family/${style}`,
    `font/family/${style}`,
    `${group}/font-family/${style}`,
    `${group}/font-family`,
    `font-family/${style}`,
    `font-family`,
  ], "fontFamily", true) || firstToken(index, named, "fontFamily", false);
  if (family) found.set("fontFamily", family);

  const fontStyle = firstToken(index, [
    `${group}/font/style/${style}`,
    `font/style/${style}`,
    `${group}/font-style/${style}`,
    `${group}/font-style`,
    `font-style/${style}`,
    `font-style`,
  ], "fontStyle", true) || firstToken(index, named, "fontStyle", false);
  if (fontStyle) found.set("fontStyle", fontStyle);

  const weight = firstToken(index, [
    `${group}/font/weight/${style}`,
    `font/weight/${style}`,
    `${group}/font-weight/${style}`,
    `${group}/font-weight`,
    `font-weight/${style}`,
    `font-weight`,
    `weight/${style}`,
  ], "fontWeight", true) || firstToken(index, named, "fontWeight", false);
  if (weight) found.set("fontWeight", weight);

  return found;
}

function bindTokens(style, tokens) {
  let applied = 0;
  for (const [field, variable] of tokens) {
    try {
      style.setBoundVariable(field, variable);
      applied += 1;
    } catch {
      // The token is there, but this field cannot take it. The plain value stays.
    }
  }
  return applied;
}

function indexLocalStyles(styles) {
  const groups = new Map();
  for (const style of styles) {
    const key = normToken(style.name);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(style);
    groups.set(key, list);
  }
  const byKey = new Map();
  let removed = 0;
  for (const [key, list] of groups) {
    byKey.set(key, list[0]);
    for (const extra of list.slice(1)) {
      try {
        extra.remove();
        removed += 1;
      } catch {
        // Figma kept this copy. The next sync still updates the one we keep.
      }
    }
  }
  return { byKey, removed };
}

function styleFace(item, collection) {
  const family = String((item && item.fontFamily) || (collection && collection.fontFamily) || "Inter").trim() || "Inter";
  const style = String((item && item.fontStyle) || (collection && collection.fontStyle) || "Regular").trim() || "Regular";
  const line = Math.round(Number((item && item.lineHeightPercent) || (collection && collection.lineHeightPercent)) || 140);
  return { family, style, line };
}

function faceKey(face) {
  return `${face.family} ${face.style}`;
}

function cleanSegment(value, fallback) {
  const clean = String(value || "").replace(/[./{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
  return clean || fallback;
}

async function importTypeStyles(collections, groupName) {
  const group = cleanSegment(groupName, "Text");
  const usable = collections.filter(
    (collection) => collection && Array.isArray(collection.styles) && collection.styles.length > 0,
  );
  if (usable.length === 0) throw new Error("The chosen collections have no styles.");

  for (const collection of usable) {
    const faces = new Map();
    for (const item of collection.styles) faces.set(faceKey(styleFace(item, collection)), styleFace(item, collection));
    if (faces.size === 0) faces.set("Inter Regular", { family: "Inter", style: "Regular", line: 140 });
    for (const face of faces.values()) {
      try {
        await figma.loadFontAsync({ family: face.family, style: face.style });
      } catch {
        throw new Error(
          `Cannot find the font “${face.family} ${face.style}”. Install it on this computer, or use Inter Regular, which Figma already includes.`,
        );
      }
    }
  }

  const { byKey, removed } = indexLocalStyles(await figma.getLocalTextStylesAsync());
  let tokens = new Map();
  try {
    const [variables, variableCollections] = await Promise.all([
      figma.variables.getLocalVariablesAsync(),
      figma.variables.getLocalVariableCollectionsAsync(),
    ]);
    tokens = indexTextTokens(variables, variableCollections);
  } catch {
    tokens = new Map();
  }

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const collection of usable) {
    for (const item of collection.styles) {
      const leaf = cleanSegment(item.name, "");
      const size = Number(item.size);
      if (!leaf || !Number.isFinite(size) || size < 1) continue;
      const face = styleFace(item, collection);
      const styleName = `${group}/${leaf}`;
      const key = normToken(styleName);
      let style = byKey.get(key);
      if (!style) {
        style = figma.createTextStyle();
        byKey.set(key, style);
        created += 1;
      } else {
        updated += 1;
      }
      style.name = styleName;
      style.fontName = { family: face.family, style: face.style };
      style.fontSize = size;
      style.lineHeight = { unit: "PERCENT", value: face.line };
      style.description = String(item.description || "");
      const matched = tokensForStyle(tokens, group, leaf, styleName);
      if (bindTokens(style, matched) > 0) linked += 1;
    }
  }

  if (created + updated === 0) throw new Error("There were no valid styles to create.");
  return { created, updated, linked, removed };
}
