export type ExportConnection = {
  token: string;
  fileUrl: string;
};

const STORAGE_KEY = "foundry.export-connections";

function empty(): ExportConnection {
  return { token: "", fileUrl: "" };
}

function readAll(): Record<string, ExportConnection> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, Partial<ExportConnection>>;
    const next: Record<string, ExportConnection> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      next[id] = {
        token: typeof value.token === "string" ? value.token : "",
        fileUrl: typeof value.fileUrl === "string" ? value.fileUrl : "",
      };
    }
    return next;
  } catch {
    return {};
  }
}

export function readExportConnection(systemId: string): ExportConnection {
  return readAll()[systemId] ?? empty();
}

export function writeExportConnection(systemId: string, connection: ExportConnection): void {
  const all = readAll();
  all[systemId] = {
    token: connection.token,
    fileUrl: connection.fileUrl,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function forgetAllExportConnections(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage can be blocked. There is nothing to clear then. */
  }
}

export function forgetExportConnection(systemId: string): void {
  const all = readAll();
  delete all[systemId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
