import { useEffect, useRef, useState } from "react";
import { activeSystem, cloneSystem, createSystem, normalizeProject, systemsFromJson } from "../shared/project";
import type { DesignSystem, Project, SystemStatus } from "../shared/types";
import { CommandPalette } from "./components/CommandPalette";
import { LibraryPage, useLibrarySearchFocus } from "./components/LibraryPage";
import { Rail } from "./components/Rail";
import { SystemNav } from "./components/SystemNav";
import { TopBar } from "./components/TopBar";
import { forgetExportConnection } from "./exportConnection";
import { isFoundation, type SectionId } from "./sections";
import { AboutView } from "./views/About";
import { ShadowView } from "./views/Shadow";
import { ExportView } from "./views/Export";
import { MotionView } from "./views/Motion";
import { BlurView } from "./views/Blur";
import { BorderView } from "./views/Border";
import { RadiusView } from "./views/Radius";
import { SpacingView } from "./views/Spacing";
import { Studio } from "./views/Studio";
import { TokensView } from "./views/Tokens";
import { TypeView } from "./views/Type";

type Screen = { kind: "library" } | { kind: "about" } | { kind: "system"; section: SectionId };
type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("dsfoundry.theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* Storage can be blocked. The app still starts in dark. */
  }
  return "dark";
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "The local app did not respond.");
  }
  return response.json() as Promise<T>;
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "library" });
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [preview, setPreview] = useState<Theme>(readTheme);
  const [palette, setPalette] = useState(false);
  const skipSave = useRef(true);
  const librarySearch = useRef<HTMLInputElement>(null);
  useLibrarySearchFocus(librarySearch, screen.kind === "library");

  useEffect(() => {
    document.documentElement.dataset.theme = preview;
    try {
      localStorage.setItem("dsfoundry.theme", preview);
    } catch {
      /* Ignore a blocked write. The choice still applies for this visit. */
    }
  }, [preview]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/project")
      .then((response) => readJson<Project>(response))
      .then((nextProject) => {
        if (cancelled) return;
        setProject(normalizeProject(nextProject));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not open the project.");
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

  useEffect(() => {
    if (screen.kind === "library") return;
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen.kind]);

  function patchProject(recipe: (current: Project) => Project) {
    setProject((current) => (current ? recipe(current) : current));
  }

  function updateSystem(next: DesignSystem, edit = true) {
    patchProject((current) => ({
      ...current,
      systems: current.systems.map((item) => (item.id === next.id ? (edit ? { ...next, updatedAt: Date.now() } : next) : item)),
    }));
  }

  const system = project ? activeSystem(project) : null;
  const openId = screen.kind === "system" ? system?.id ?? null : null;

  function openSystem(id: string) {
    const target = project?.systems.find((item) => item.id === id);
    if (!target) return;
    const section = isFoundation(target.lastSection) ? target.lastSection : "color";
    patchProject((current) => ({
      ...current,
      activeSystemId: id,
      tempSystemId: target.starred ? (current.tempSystemId === id ? null : current.tempSystemId) : id,
      systems: current.systems.map((item) => (item.id === id && item.lastSection !== section ? { ...item, lastSection: section } : item)),
    }));
    setScreen({ kind: "system", section });
  }

  function goSection(section: SectionId) {
    if (!system) return;
    setScreen({ kind: "system", section });
    if (!isFoundation(section) || system.lastSection === section) return;
    updateSystem({ ...system, lastSection: section }, false);
  }

  function addSystems(next: DesignSystem[], message: string) {
    const first = next[0];
    if (!first) return;
    patchProject((current) => ({
      ...current,
      activeSystemId: first.id,
      tempSystemId: next.length === 1 ? first.id : current.tempSystemId,
      systems: [...current.systems, ...next],
    }));
    setScreen(next.length === 1 ? { kind: "system", section: "color" } : { kind: "library" });
    setToast(message);
  }

  function addBlank() {
    const next = createSystem("New system");
    addSystems([next], "System created");
  }

  function addDuplicate() {
    if (!system) return;
    addSystems([cloneSystem(system)], "System duplicated");
  }

  function duplicateSystem(source: DesignSystem) {
    addSystems([cloneSystem(source)], "System duplicated");
  }

  async function importFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const next = systemsFromJson(parsed);
      addSystems(next, next.length === 1 ? "System imported" : `${next.length} systems imported`);
    } catch (error) {
      setToast(error instanceof SyntaxError ? "That file is not JSON." : error instanceof Error ? error.message : "Could not import that file.");
    }
  }

  function deleteSystem(id: string) {
    if (!project || project.systems.length < 2) return;
    forgetExportConnection(id);
    patchProject((current) => {
      const systems = current.systems.filter((item) => item.id !== id);
      return {
        ...current,
        systems,
        activeSystemId: current.activeSystemId === id ? (systems[0]?.id ?? null) : current.activeSystemId,
        tempSystemId: current.tempSystemId === id ? null : current.tempSystemId,
      };
    });
    setScreen({ kind: "library" });
    setToast("System deleted");
  }

  function dismissTemp() {
    const id = project?.tempSystemId ?? null;
    patchProject((current) => ({ ...current, tempSystemId: null }));
    if (id && screen.kind === "system" && system?.id === id) setScreen({ kind: "library" });
    setToast("Removed from the rail");
  }

  function setStar(id: string, starred: boolean) {
    const viewing = screen.kind === "system" && system?.id === id;
    patchProject((current) => ({
      ...current,
      tempSystemId: starred
        ? current.tempSystemId === id
          ? null
          : current.tempSystemId
        : viewing
          ? id
          : current.tempSystemId === id
            ? null
            : current.tempSystemId,
      systems: current.systems.map((item) => (item.id === id ? { ...item, starred, updatedAt: Date.now() } : item)),
    }));
  }

  function setStatus(status: SystemStatus) {
    if (!system) return;
    updateSystem({ ...system, status });
  }

  const favourites = project?.systems.filter((item) => item.starred) ?? [];
  const temporary = project?.systems.find((item) => item.id === project.tempSystemId && !item.starred) ?? null;
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved";

  const sectionBody =
    screen.kind === "system" && system
      ? screen.section === "color"
          ? (
              <Studio
                colors={system.colors}
                preview={preview}
                onChange={(colors) => updateSystem({ ...system, colors })}
                onToast={setToast}
              />
            )
          : screen.section === "type"
            ? (
                <TypeView scale={system.type} onChange={(type) => updateSystem({ ...system, type })} onToast={setToast} />
              )
            : screen.section === "border"
              ? (
                  <BorderView scale={system.border} onChange={(border) => updateSystem({ ...system, border })} onToast={setToast} />
                )
              : screen.section === "spacing"
              ? (
                  <SpacingView scale={system.spacing} onChange={(spacing) => updateSystem({ ...system, spacing })} onToast={setToast} />
                )
              : screen.section === "radius"
                ? (
                    <RadiusView scale={system.radius} onChange={(radius) => updateSystem({ ...system, radius })} onToast={setToast} />
                  )
                : screen.section === "shadow"
                  ? (
                      <ShadowView
                        scale={system.shadow}
                        onChange={(shadow) => updateSystem({ ...system, shadow })}
                      />
                    )
                  : screen.section === "motion"
                    ? (
                        <MotionView scale={system.motion} onChange={(motion) => updateSystem({ ...system, motion })} />
                      )
                    : screen.section === "blur"
                      ? (
                          <BlurView scale={system.blur} onChange={(blur) => updateSystem({ ...system, blur })} onToast={setToast} />
                        )
                      : screen.section === "tokens"
                        ? <TokensView system={system} />
                        : (
                              <ExportView
                                system={system}
                                onToast={setToast}
                                onExported={() =>
                                  patchProject((current) => ({
                                    ...current,
                                    systems: current.systems.map((item) =>
                                      item.id === system.id ? { ...item, lastExportAt: Date.now() } : item,
                                    ),
                                  }))
                                }
                              />
                            )
      : null;

  return (
    <div className="app">
      <Rail
        libraryActive={screen.kind === "library"}
        aboutActive={screen.kind === "about"}
        favourites={favourites}
        temporary={temporary}
        activeId={openId}
        onLibrary={() => setScreen({ kind: "library" })}
        onOpen={openSystem}
        onDismissTemp={dismissTemp}
        onBlank={addBlank}
        onImport={(file) => void importFile(file)}
        onAbout={() => setScreen({ kind: "about" })}
      />

      {loadError || !project ? (
        <main className="boot">
          <h1>DS Foundry</h1>
          <p>{loadError || "Loading the local project…"}</p>
        </main>
      ) : (
        <div className="shell">
          {screen.kind === "library" ? (
            <LibraryPage
              theme={preview}
              onTheme={setPreview}
              systems={project.systems}
              searchRef={librarySearch}
              onOpen={openSystem}
              onStar={setStar}
              onDuplicate={duplicateSystem}
              onDelete={deleteSystem}
              onAccent={(id, accent) => {
                const target = project.systems.find((item) => item.id === id);
                if (target) updateSystem({ ...target, accent });
              }}
              canDelete={project.systems.length > 1}
              onBlank={addBlank}
              onImport={(file) => void importFile(file)}
            />
          ) : screen.kind === "about" ? (
            <AboutView theme={preview} onTheme={setPreview} />
          ) : system ? (
            <>
              <SystemNav
                system={system}
                section={screen.section}
                canDelete={project.systems.length > 1}
                onSection={goSection}
                onRename={(name) => updateSystem({ ...system, name })}
                onStar={() => setStar(system.id, !system.starred)}
                onStatus={setStatus}
                onAccent={(accent) => updateSystem({ ...system, accent })}
                onVersion={(version) => updateSystem({ ...system, version })}
                onDuplicate={addDuplicate}
                onDelete={() => deleteSystem(system.id)}
              />
              <div className="stage">
                <TopBar
                  system={system}
                  section={screen.section}
                  saveLabel={saveLabel}
                  preview={preview}
                  onLibrary={() => setScreen({ kind: "library" })}
                  onPreview={setPreview}
                  onSearch={() => setPalette(true)}
                />
                <div className="stage-body">{sectionBody}</div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {palette && project ? (
        <CommandPalette
          systems={project.systems}
          currentId={screen.kind === "system" ? system?.id ?? null : null}
          onClose={() => setPalette(false)}
          onLibrary={() => setScreen({ kind: "library" })}
          onOpenSystem={openSystem}
          onOpenSection={goSection}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

