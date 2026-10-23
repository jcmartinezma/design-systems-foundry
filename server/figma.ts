import type { ExportSet, ExportVariable, ExportVariableType } from "../shared/types";
import { explainFigmaError, fileKeyFromUrl } from "../shared/figma";

type FigmaColor = { r: number; g: number; b: number; a: number };

type LocalVariable = {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: string;
};

type LocalCollection = {
  id: string;
  name: string;
  defaultModeId: string;
  remote: boolean;
};

type LocalResponse = {
  meta?: {
    variables?: Record<string, LocalVariable>;
    variableCollections?: Record<string, LocalCollection>;
  };
  message?: string;
  err?: string;
};

export type PublishResult = {
  name: string;
  created: number;
  updated: number;
  skipped: number;
};

async function figmaFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.figma.com${path}`, {
    ...init,
    headers: {
      "X-Figma-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; err?: string };
    return body.message || body.err || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function testFigmaConnection(token: string, fileUrl: string): Promise<string> {
  const fileKey = fileKeyFromUrl(fileUrl);
  if (!token.trim()) throw new Error("The Figma token is missing.");
  if (!fileKey) throw new Error("That link does not look like a Figma file. Paste the design file URL.");

  const response = await figmaFetch(token.trim(), `/v1/files/${fileKey}/variables/local`);
  if (!response.ok) {
    const message = await readError(response);
    throw new Error(explainFigmaError(response.status, message));
  }

  const body = (await response.json()) as LocalResponse;
  const collections = Object.values(body.meta?.variableCollections ?? {}).filter((item) => !item.remote);
  const count = collections.length;
  const label = count === 1 ? "local collection" : "local collections";
  return `Connection works. The file has ${count} ${label}.`;
}

export async function publishSets(
  token: string,
  fileUrl: string,
  sets: ExportSet[],
): Promise<PublishResult[]> {
  const fileKey = fileKeyFromUrl(fileUrl);
  if (!token.trim()) throw new Error("Add a personal token on the Export page before publishing.");
  if (!fileKey) throw new Error("Add the Figma file link on the Export page before publishing.");

  const response = await figmaFetch(token.trim(), `/v1/files/${fileKey}/variables/local`);
  if (!response.ok) {
    const message = await readError(response);
    throw new Error(explainFigmaError(response.status, message));
  }

  const body = (await response.json()) as LocalResponse;
  const collections = Object.values(body.meta?.variableCollections ?? {}).filter((item) => !item.remote);
  const variables = Object.values(body.meta?.variables ?? {});
  const results: PublishResult[] = [];

  for (const set of sets) {
    results.push(await publishSet(token.trim(), fileKey, set, collections, variables));
  }

  return results;
}

async function publishSet(
  token: string,
  fileKey: string,
  set: ExportSet,
  collections: LocalCollection[],
  variables: LocalVariable[],
): Promise<PublishResult> {
  const existing = collections.find((collection) => collection.name === set.name);
  const usable = set.variables.filter((variable) => modeValue(variable) !== null);

  if (!existing) {
    const modeId = "mode_default";
    const collectionId = "collection_new";
    const payload = {
      variableCollections: [
        {
          action: "CREATE",
          id: collectionId,
          name: set.name,
          initialModeId: modeId,
        },
      ],
      variableModes: [
        {
          action: "UPDATE",
          id: modeId,
          name: "Default",
          variableCollectionId: collectionId,
        },
      ],
      variables: usable.map((variable, index) => ({
        action: "CREATE",
        id: `var_${index}`,
        name: variable.name,
        variableCollectionId: collectionId,
        resolvedType: resolvedType(variable),
        description: variable.description,
        codeSyntax: { WEB: variable.code },
      })),
      variableModeValues: usable.map((variable, index) => ({
        variableId: `var_${index}`,
        modeId,
        value: modeValue(variable),
      })),
    };
    await postVariables(token, fileKey, payload);
    return { name: set.name, created: usable.length, updated: 0, skipped: set.variables.length - usable.length };
  }

  const inCollection = new Map(
    variables
      .filter((variable) => variable.variableCollectionId === existing.id)
      .map((variable) => [variable.name, variable]),
  );

  const creates: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const values: Record<string, unknown>[] = [];
  let created = 0;
  let updated = 0;
  let skipped = set.variables.length - usable.length;

  usable.forEach((variable, index) => {
    const kind = resolvedType(variable);
    const found = inCollection.get(variable.name);
    if (found && found.resolvedType !== kind) {
      skipped += 1;
      return;
    }
    if (found) {
      updated += 1;
      updates.push({
        action: "UPDATE",
        id: found.id,
        description: variable.description,
        codeSyntax: { WEB: variable.code },
      });
      values.push({
        variableId: found.id,
        modeId: existing.defaultModeId,
        value: modeValue(variable),
      });
      return;
    }

    created += 1;
    const tempId = `var_${index}`;
    creates.push({
      action: "CREATE",
      id: tempId,
      name: variable.name,
      variableCollectionId: existing.id,
      resolvedType: kind,
      description: variable.description,
      codeSyntax: { WEB: variable.code },
    });
    values.push({
      variableId: tempId,
      modeId: existing.defaultModeId,
      value: modeValue(variable),
    });
  });

  if (updates.length > 0 || creates.length > 0) {
    await postVariables(token, fileKey, {
      variables: [...updates, ...creates],
      variableModeValues: values,
    });
  }

  return { name: set.name, created, updated, skipped };
}

function resolvedType(variable: ExportVariable): ExportVariableType {
  if (variable.type === "FLOAT" || variable.type === "STRING") return variable.type;
  return "COLOR";
}

function modeValue(variable: ExportVariable): unknown {
  const kind = resolvedType(variable);
  if (kind === "FLOAT") {
    const value = Number(variable.number);
    return Number.isFinite(value) ? value : null;
  }
  if (kind === "STRING") return String(variable.text ?? "");
  if (!variable.color) return null;
  return colorValue(variable.color);
}

function colorValue(color: FigmaColor): FigmaColor {
  return {
    r: clamp01(color.r),
    g: clamp01(color.g),
    b: clamp01(color.b),
    a: 1,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

async function postVariables(token: string, fileKey: string, payload: unknown): Promise<void> {
  const response = await figmaFetch(token, `/v1/files/${fileKey}/variables`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await readError(response);
    throw new Error(explainFigmaError(response.status, message));
  }
}
