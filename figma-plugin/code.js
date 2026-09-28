const PORT = 4317;

figma.showUI(__html__, { width: 380, height: 620, themeColors: true });

figma.ui.onmessage = async (message) => {
  if (message.type === "close") {
    figma.closePlugin();
    return;
  }

  if (message.type === "import-icons" && Array.isArray(message.collections)) {
    try {
      const placed = await placeIcons(message.collections);
      figma.notify(`Creator: ${placed.ok} iconos en la página${placed.failed ? `, ${placed.failed} omitidos` : ""}`);
      figma.closePlugin();
    } catch (error) {
      figma.ui.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "No se pudieron colocar los iconos.",
      });
    }
    return;
  }

  if (message.type !== "import" || !message.file || !Array.isArray(message.file.sets)) {
    figma.ui.postMessage({ type: "error", message: "El JSON no viene de Creator." });
    return;
  }

  try {
    const selected = new Set(message.setIds || []);
    const sets = message.file.sets.filter((set) => selected.size === 0 || selected.has(set.id));
    if (message.destination === "frame") {
      const count = await paintRamps(sets);
      figma.notify(`Creator: ${count} colores en un frame`);
      figma.closePlugin();
      return;
    }
    let created = 0;
    let updated = 0;

    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync("COLOR");

    for (const set of sets) {
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
        let variable = byName.get(item.name);
        if (!variable) {
          variable = figma.variables.createVariable(item.name, collection, "COLOR");
          created += 1;
        } else {
          updated += 1;
        }
        variable.description = item.description || "";
        variable.setVariableCodeSyntax("WEB", item.code || "");
        variable.setValueForMode(modeId, {
          r: item.color.r,
          g: item.color.g,
          b: item.color.b,
          a: 1,
        });
      }
    }

    figma.notify(`Creator: ${created} nuevas, ${updated} actualizadas`);
    figma.closePlugin();
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "No se pudieron crear las variables.",
    });
  }
};

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
    if (!item || !item.color) continue;
    const name = String(item.name || "color/valor");
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
    .map((set) => ({ name: String(set.name || "Colores"), ramps: rampsOf(set) }))
    .filter((set) => set.ramps.length > 0);
  if (usable.length === 0) throw new Error("Las collections elegidas no tienen colores.");

  let fontReady = false;
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    fontReady = true;
  } catch {
    fontReady = false;
  }

  const baseName = usable.length === 1 ? usable[0].name : "Rampas";
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

async function placeIcons(collections) {
  const usable = collections.filter(
    (collection) => collection && typeof collection.name === "string" && Array.isArray(collection.icons) && collection.icons.length > 0,
  );
  if (usable.length === 0) throw new Error("Creator no ha enviado iconos.");

  let fontReady = false;
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    fontReady = true;
  } catch {
    fontReady = false;
  }

  const board = figma.createFrame();
  board.name = usable.length === 1 ? usable[0].name : "Iconografía";
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

  let ok = 0;
  let failed = 0;

  for (const collection of usable) {
    const section = usable.length === 1 ? board : figma.createFrame();
    if (section !== board) {
      section.name = collection.name;
      section.layoutMode = "VERTICAL";
      section.primaryAxisSizingMode = "AUTO";
      section.counterAxisSizingMode = "AUTO";
      section.itemSpacing = 16;
      section.fills = [];
      if (fontReady) {
        const title = figma.createText();
        title.fontName = { family: "Inter", style: "Regular" };
        title.fontSize = 20;
        title.characters = collection.name;
        title.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
        section.appendChild(title);
        title.layoutSizingHorizontal = "HUG";
        title.layoutSizingVertical = "HUG";
      }
      appendSized(board, section, "HUG", "HUG");
    }

    const groups = new Map();
    for (const icon of collection.icons) {
      if (!icon || typeof icon.svg !== "string" || typeof icon.file !== "string" || typeof icon.size !== "number") continue;
      const list = groups.get(icon.size) || [];
      list.push(icon);
      groups.set(icon.size, list);
    }

    for (const size of [...groups.keys()].sort((a, b) => a - b)) {
      const block = figma.createFrame();
      block.name = `${size}px`;
      block.layoutMode = "VERTICAL";
      block.primaryAxisSizingMode = "AUTO";
      block.counterAxisSizingMode = "AUTO";
      block.itemSpacing = 12;
      block.fills = [];

      if (fontReady) {
        const title = figma.createText();
        title.fontName = { family: "Inter", style: "Regular" };
        title.fontSize = 14;
        title.characters = `${size}px`;
        title.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
        block.appendChild(title);
        title.layoutSizingHorizontal = "HUG";
        title.layoutSizingVertical = "HUG";
      }

      const grid = wrappingRow(`rejilla ${size}`, 960);
      grid.itemSpacing = 12;
      grid.counterAxisSpacing = 12;
      appendSized(block, grid, "FIXED", "HUG");
      appendSized(section, block, "HUG", "HUG");

      const items = groups.get(size).sort((a, b) => String(a.name || a.file).localeCompare(String(b.name || b.file)));
      for (const icon of items) {
        try {
          const iconName = String(icon.file).replace(/\.svg$/, "");
          const node = figma.createNodeFromSvg(icon.svg);
          node.name = iconName;
          grid.appendChild(node);
          const component = figma.createComponentFromNode(node);
          component.name = `${collection.name}/${iconName}`;
          if (!component.parent) grid.appendChild(component);
          component.layoutSizingHorizontal = "FIXED";
          component.layoutSizingVertical = "FIXED";
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      grid.counterAxisSizingMode = "AUTO";
    }
  }

  figma.viewport.scrollAndZoomIntoView([board]);
  return { ok, failed };
}
