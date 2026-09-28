import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ORIGIN, PORT } from "../shared/config";
import { exportProject } from "../shared/export";
import {
  createDefaultProject,
  defaultConnections,
  normalizeProject,
  toPublicConnections,
} from "../shared/project";
import type { Connections, Project } from "../shared/types";
import { publishSets, testFigmaConnection } from "./figma";
import { figmaIcons, fontArchive, fontFilePath, generateFonts, listCollections, listIcons, readIconSvg } from "./icons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, ".data");
const projectPath = path.join(dataDir, "project.json");
const connectionsPath = path.join(dataDir, "connections.json");

fs.mkdirSync(dataDir, { recursive: true });

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function readProject(): Project {
  const project = normalizeProject(readJson<Project>(projectPath, createDefaultProject()));
  if (!fs.existsSync(projectPath)) writeJson(projectPath, project);
  return project;
}

function readConnections(): Connections {
  const stored = readJson<Connections>(connectionsPath, defaultConnections());
  return {
    figma: {
      token: stored.figma?.token ?? "",
      fileUrl: stored.figma?.fileUrl ?? "",
    },
  };
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    origin: ORIGIN,
    pluginManifest: path.join(root, "figma-plugin", "manifest.json"),
  });
});

app.get("/api/project", (_req, res) => {
  res.json(readProject());
});

app.put("/api/project", (req, res) => {
  const project = req.body as Project;
  if (!project || project.version !== 1 || !Array.isArray(project.sets)) {
    res.status(400).json({ error: "El proyecto no tiene el formato esperado." });
    return;
  }
  writeJson(projectPath, normalizeProject(project));
  res.json({ ok: true });
});

app.get("/api/connections", (_req, res) => {
  res.json(toPublicConnections(readConnections()));
});

app.put("/api/connections", (req, res) => {
  const body = req.body as {
    fileUrl?: string;
    token?: string;
    clearToken?: boolean;
  };
  const current = readConnections();
  const next: Connections = {
    figma: {
      fileUrl: typeof body.fileUrl === "string" ? body.fileUrl.trim() : current.figma.fileUrl,
      token: body.clearToken
        ? ""
        : typeof body.token === "string" && body.token.trim()
          ? body.token.trim()
          : current.figma.token,
    },
  };
  writeJson(connectionsPath, next);
  res.json(toPublicConnections(next));
});

app.get("/api/export", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(exportProject(readProject()));
});

app.options("/api/export", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.sendStatus(204);
});

app.get("/api/icons", (_req, res) => {
  allowPlugin(res);
  res.json({ root: "icons", collections: listCollections() });
});

app.options("/api/icons", (_req, res) => {
  allowPlugin(res);
  res.sendStatus(204);
});

app.get("/api/icons/:collection", (req, res) => {
  try {
    res.json(listIcons(req.params.collection));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

app.get("/api/icons/:collection/svg", (req, res) => {
  try {
    const name = typeof req.query.name === "string" ? req.query.name : "";
    const svg = readIconSvg(req.params.collection, name);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader("Cache-Control", "no-store");
    res.send(svg);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

app.post("/api/icons/:collection/font", async (req, res) => {
  try {
    const result = await generateFonts(req.params.collection);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: errorMessage(error) });
  }
});

app.get("/api/icons/:collection/fuente.zip", (req, res) => {
  try {
    const archive = fontArchive(req.params.collection);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${archive.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(archive.body);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

app.get("/api/icons/:collection/font/:file", (req, res) => {
  try {
    const full = fontFilePath(req.params.collection, req.params.file);
    if (!full) {
      res.status(404).json({ error: "Todavía no hay una fuente generada para esta colección." });
      return;
    }
    res.sendFile(full);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

app.get("/api/icons/:collection/figma", (req, res) => {
  try {
    allowPlugin(res);
    const catalog = listIcons(req.params.collection);
    res.json({ source: "creator", collection: catalog.name, icons: figmaIcons(catalog.name) });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

app.options("/api/icons/:collection/figma", (_req, res) => {
  allowPlugin(res);
  res.sendStatus(204);
});

app.post("/api/figma/test", async (req, res) => {
  try {
    const body = req.body as { token?: string; fileUrl?: string };
    const stored = readConnections();
    const token = body.token?.trim() || stored.figma.token;
    const fileUrl = body.fileUrl?.trim() || stored.figma.fileUrl;
    const message = await testFigmaConnection(token, fileUrl);
    res.json({ ok: true, message });
  } catch (error) {
    res.status(400).json({ ok: false, error: errorMessage(error) });
  }
});

app.post("/api/figma/publish", async (req, res) => {
  try {
    const body = req.body as { setIds?: string[] };
    const connections = readConnections();
    const project = readProject();
    const wanted = new Set(body.setIds ?? []);
    const exported = exportProject(project).sets.filter((set) => wanted.size === 0 || wanted.has(set.id));
    if (exported.length === 0) {
      res.status(400).json({ ok: false, error: "No hay collections para publicar." });
      return;
    }
    const results = await publishSets(connections.figma.token, connections.figma.fileUrl, exported);
    res.json({ ok: true, results });
  } catch (error) {
    res.status(400).json({ ok: false, error: errorMessage(error) });
  }
});

function allowPlugin(res: express.Response): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado.";
}

if (process.env.NODE_ENV === "production") {
  const dist = path.join(root, "dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
  listen();
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
  listen();
}

function listen(): void {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Creator en ${ORIGIN}`);
  });

  const ipv6 = app.listen(PORT, "::1", () => {
    console.log(`Creator en http://localhost:${PORT}`);
  });
  ipv6.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" || error.code === "EAFNOSUPPORT" || error.code === "EINVAL") return;
    throw error;
  });
}
