import type { ExportSet } from "../shared/types";
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
  if (!token.trim()) throw new Error("Falta el token de Figma.");
  if (!fileKey) throw new Error("El enlace del archivo no parece de Figma. Pega la URL del archivo de diseño.");

  const response = await figmaFetch(token.trim(), `/v1/files/${fileKey}/variables/local`);
  if (!response.ok) {
    const message = await readError(response);
    throw new Error(explainFigmaError(response.status, message));
  }

  const body = (await response.json()) as LocalResponse;
  const collections = Object.values(body.meta?.variableCollections ?? {}).filter((item) => !item.remote);
  return `Conexión correcta. El archivo tiene ${collections.length} colección${collections.length === 1 ? "" : "es"} local${collections.length === 1 ? "" : "es"}.`;
}

export async function publishSets(
  token: string,
  fileUrl: string,
  sets: ExportSet[],
): Promise<PublishResult[]> {
  const fileKey = fileKeyFromUrl(fileUrl);
  if (!token.trim()) throw new Error("Guarda un token en Conexiones antes de publicar.");
  if (!fileKey) throw new Error("Guarda el enlace del archivo de Figma en Conexiones.");

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
      variables: set.variables.map((variable, index) => ({
        action: "CREATE",
        id: `var_${index}`,
        name: variable.name,
        variableCollectionId: collectionId,
        resolvedType: "COLOR",
        description: variable.description,
        codeSyntax: { WEB: variable.code },
      })),
      variableModeValues: set.variables.map((variable, index) => ({
        variableId: `var_${index}`,
        modeId,
        value: colorValue(variable.color),
      })),
    };
    await postVariables(token, fileKey, payload);
    return { name: set.name, created: set.variables.length, updated: 0 };
  }

  const inCollection = new Map(
    variables
      .filter((variable) => variable.variableCollectionId === existing.id && variable.resolvedType === "COLOR")
      .map((variable) => [variable.name, variable]),
  );

  const creates: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const values: Record<string, unknown>[] = [];
  let created = 0;
  let updated = 0;

  set.variables.forEach((variable, index) => {
    const found = inCollection.get(variable.name);
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
        value: colorValue(variable.color),
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
      resolvedType: "COLOR",
      description: variable.description,
      codeSyntax: { WEB: variable.code },
    });
    values.push({
      variableId: tempId,
      modeId: existing.defaultModeId,
      value: colorValue(variable.color),
    });
  });

  await postVariables(token, fileKey, {
    variables: [...updates, ...creates],
    variableModeValues: values,
  });

  return { name: set.name, created, updated };
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
