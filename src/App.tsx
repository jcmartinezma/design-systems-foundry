import { useEffect, useRef, useState } from "react";
import type { Project, PublicConnections } from "../shared/types";
import { normalizeProject } from "../shared/project";
import { IconsView } from "./views/Icons";
import { SettingsView } from "./views/Settings";
import { Studio } from "./views/Studio";

type Section = "studio" | "icons" | "settings";
type SaveState = "loading" | "saved" | "saving" | "error";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "La app local no ha respondido.");
  }
  return response.json() as Promise<T>;
}

export function App() {
  const [section, setSection] = useState<Section>("studio");
  const [project, setProject] = useState<Project | null>(null);
  const [connections, setConnections] = useState<PublicConnections | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const skipSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/project").then((response) => readJson<Project>(response)),
      fetch("/api/connections").then((response) => readJson<PublicConnections>(response)),
    ])
      .then(([nextProject, nextConnections]) => {
        if (cancelled) return;
        setProject(normalizeProject(nextProject));
        setConnections(nextConnections);
        setSaveState("saved");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "No se pudo abrir el proyecto.");
        setSaveState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!project) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      fetch("/api/project", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      })
        .then((response) => readJson<{ ok: boolean }>(response))
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function saveConnections(update: { fileUrl: string; token?: string; clearToken?: boolean }) {
    const response = await fetch("/api/connections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const next = await readJson<PublicConnections>(response);
    setConnections(next);
    setToast("Conexión guardada");
    return next;
  }

  return (
    <div className="app">
      <aside className="activity">
        <div className="mark" title="Creator">
          C
        </div>
        <nav>
          <button
            className={section === "studio" ? "active" : ""}
            onClick={() => setSection("studio")}
            title="Rampas"
          >
            <SwatchIcon />
          </button>
          <button
            className={section === "icons" ? "active" : ""}
            onClick={() => setSection("icons")}
            title="Iconografía"
          >
            <IconsIcon />
          </button>
          <button
            className={section === "settings" ? "active" : ""}
            onClick={() => setSection("settings")}
            title="Settings"
          >
            <GearIcon />
          </button>
        </nav>
      </aside>

      {loadError || !project || !connections ? (
        <main className="boot">
          <h1>Creator</h1>
          <p>{loadError || "Cargando el proyecto local…"}</p>
        </main>
      ) : section === "studio" ? (
        <Studio
          project={project}
          connections={connections}
          saveState={saveState}
          onChange={setProject}
          onToast={setToast}
          onOpenSettings={() => setSection("settings")}
        />
      ) : section === "icons" ? (
        <IconsView />
      ) : (
        <SettingsView connections={connections} onSave={saveConnections} />
      )}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function SwatchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="2.7" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10.2" y="2.2" width="5.6" height="5.6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.3 15.6 5 10.4l2.7 5.2H2.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M13.5 10.3 16.7 13.5 13.5 16.7 10.3 13.5 13.5 10.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9 1.8v1.6M9 14.6v1.6M1.8 9h1.6M14.6 9h1.6M3.7 3.7l1.1 1.1M13.2 13.2l1.1 1.1M14.3 3.7l-1.1 1.1M4.8 13.2l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
