import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ORIGIN, PORT } from "../shared/config";
import { cssForExport, exportSystem, pluginLibrary } from "../shared/export";
import { blurDtcg } from "../shared/blur";
import { borderDtcg } from "../shared/border";
import { radiusDtcg } from "../shared/radius";
import { spacingDtcg } from "../shared/spacing";
import { activeSystem, createDefaultProject, normalizeProject, slug } from "../shared/project";
import type { Project } from "../shared/types";
import { exportTypeScale } from "../shared/type";
import { zipStore } from "./zip";
import { publishSets, testFigmaConnection } from "./figma";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, ".data");
const projectPath = path.join(dataDir, "project.json");
const packagePath = path.join(root, "package.json");

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

function appVersion(): string {
  const pkg = readJson<{ version?: string }>(packagePath, {});
  return typeof pkg.version === "string" ? pkg.version : "";
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    origin: ORIGIN,
    version: appVersion(),
    pluginManifest: path.join(root, "figma-plugin", "manifest.json"),
  });
});

app.get("/api/project", (_req, res) => {
  res.json(readProject());
});

app.put("/api/project", (req, res) => {
  const project = req.body as {
    version?: number;
    systems?: unknown;
    sets?: unknown;
  };
  const legacy = project?.version === 1 && Array.isArray(project.sets);
  const current = project?.version === 2 && Array.isArray(project.systems);
  if (!project || (!legacy && !current)) {
    res.status(400).json({ error: "The project does not have the expected format." });
    return;
  }
  writeJson(projectPath, normalizeProject(req.body));
  res.json({ ok: true });
});

app.get("/api/plugin", (_req, res) => {
  allowPlugin(res);
  const project = readProject();
  res.json(pluginLibrary(project.systems, project.activeSystemId));
});

app.options("/api/plugin", (_req, res) => {
  allowPlugin(res);
  res.sendStatus(204);
});

app.get("/api/export", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const system = activeSystem(readProject());
  if (!system) {
    res.status(404).json({ error: "There is no open design system." });
    return;
  }
  res.json(exportSystem(system));
});

app.get("/api/export/download", (_req, res) => {
  const system = activeSystem(readProject());
  if (!system) {
    res.status(404).json({ error: "There is no open design system." });
    return;
  }
  const file = exportSystem(system);
  const archive = zipStore([
    { name: "tokens.json", data: Buffer.from(JSON.stringify(file, null, 2)) },
    { name: "foundations.css", data: Buffer.from(cssForExport(file)) },
    { name: "border.dtcg.json", data: Buffer.from(JSON.stringify(borderDtcg(system.border), null, 2)) },
    { name: "spacing.dtcg.json", data: Buffer.from(JSON.stringify(spacingDtcg(system.spacing), null, 2)) },
    { name: "radius.dtcg.json", data: Buffer.from(JSON.stringify(radiusDtcg(system.radius), null, 2)) },
    { name: "blur.dtcg.json", data: Buffer.from(JSON.stringify(blurDtcg(system.blur), null, 2)) },
  ]);
  const filename = `${slug(system.name)}-foundations.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(archive);
});

app.options("/api/export", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.sendStatus(204);
});

app.get("/api/type", (_req, res) => {
  allowPlugin(res);
  const system = activeSystem(readProject());
  if (!system) {
    res.status(404).json({ error: "There is no open design system." });
    return;
  }
  res.json(exportTypeScale(system.type));
});

app.options("/api/type", (_req, res) => {
  allowPlugin(res);
  res.sendStatus(204);
});

app.post("/api/figma/test", async (req, res) => {
  try {
    const body = req.body as { token?: string; fileUrl?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    const message = await testFigmaConnection(token, fileUrl);
    res.json({ ok: true, message });
  } catch (error) {
    res.status(400).json({ ok: false, error: errorMessage(error) });
  }
});

app.post("/api/figma/publish", async (req, res) => {
  try {
    const body = req.body as { token?: string; fileUrl?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    const system = activeSystem(readProject());
    if (!system) {
      res.status(400).json({ ok: false, error: "There is no open design system." });
      return;
    }
    const exported = exportSystem(system).sets.filter((set) => set.variables.length > 0);
    if (exported.length === 0) {
      res.status(400).json({ ok: false, error: "This system has no variables to publish." });
      return;
    }
    const results = await publishSets(token, fileUrl, exported);
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
  return error instanceof Error ? error.message : "Unexpected error.";
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
    console.log(`DSfoundry en ${ORIGIN}`);
  });

  const ipv6 = app.listen(PORT, "::1", () => {
    console.log(`DSfoundry at http://localhost:${PORT}`);
  });
  ipv6.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" || error.code === "EAFNOSUPPORT" || error.code === "EINVAL") return;
    throw error;
  });
}
