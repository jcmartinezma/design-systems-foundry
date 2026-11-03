export const PORT = 4317;
export const ORIGIN = `http://127.0.0.1:${PORT}`;

/** Mark written into export JSON so tools can identify Foundry files. */
export const FOUNDRY_SOURCE = "foundry" as const;
export const FOUNDRY_URL = "https://foundry.jcmartinez.net";

export function isFoundrySource(value: unknown): boolean {
  return value === FOUNDRY_SOURCE;
}
