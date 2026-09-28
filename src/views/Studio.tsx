import { useState } from "react";
import { exportProject } from "../../shared/export";
import { randomRampName } from "../../shared/names";
import { createRamp, createSet } from "../../shared/project";
import type { ColorSet, Project, PublicConnections, Ramp } from "../../shared/types";
import { RampCard } from "../components/RampCard";

type Props = {
  project: Project;
  connections: PublicConnections;
  saveState: "saved" | "saving" | "error" | "loading";
  onChange: (project: Project) => void;
  onToast: (message: string) => void;
  onOpenSettings: () => void;
};

export function Studio({ project, connections, saveState, onChange, onToast, onOpenSettings }: Props) {
  const active = project.sets.find((set) => set.id === project.activeSetId) ?? null;
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [confirmSet, setConfirmSet] = useState<string | null>(null);

  function updateProject(next: Project) {
    setPublishNote("");
    onChange(next);
  }

  function selectSet(id: string) {
    updateProject({ ...project, activeSetId: id });
  }

  function addSet() {
    const set = createSet("Nueva collection");
    updateProject({ ...project, activeSetId: set.id, sets: [...project.sets, set] });
  }

  function renameSet(name: string) {
    if (!active) return;
    updateProject({
      ...project,
      sets: project.sets.map((set) => (set.id === active.id ? { ...set, name } : set)),
    });
  }

  function deleteSet(id: string) {
    const sets = project.sets.filter((set) => set.id !== id);
    updateProject({
      ...project,
      sets,
      activeSetId: project.activeSetId === id ? (sets[0]?.id ?? null) : project.activeSetId,
    });
  }

  function updateRamp(rampId: string, ramp: Ramp) {
    if (!active) return;
    updateProject({
      ...project,
      sets: project.sets.map((set) =>
        set.id === active.id
          ? { ...set, ramps: set.ramps.map((item) => (item.id === rampId ? ramp : item)) }
          : set,
      ),
    });
  }

  function addRamp() {
    if (!active) return;
    const last = active.ramps.at(-1);
    const ramp = createRamp(randomRampName(active.ramps.map((ramp) => ramp.name)), {
      hue: ((last?.hue ?? 220) + 28) % 360,
      chroma: last?.chroma ?? 0.14,
      algorithm: last?.algorithm ?? "oklch",
    });
    patchActive({ ...active, ramps: [...active.ramps, ramp] });
  }

  function duplicateRamp(ramp: Ramp) {
    if (!active) return;
    const copy = createRamp(`${ramp.name} copia`, {
      hue: ramp.hue,
      chroma: ramp.chroma,
      stepNames: [...ramp.stepNames],
      easeChroma: ramp.easeChroma,
      algorithm: ramp.algorithm,
      lightnessLight: ramp.lightnessLight,
      lightnessDark: ramp.lightnessDark,
      apcaBackground: ramp.apcaBackground,
      apcaCustomHex: ramp.apcaCustomHex,
      apcaMin: ramp.apcaMin,
      apcaMax: ramp.apcaMax,
    });
    const index = active.ramps.findIndex((item) => item.id === ramp.id);
    const ramps = [...active.ramps];
    ramps.splice(index + 1, 0, copy);
    patchActive({ ...active, ramps });
  }

  function deleteRamp(rampId: string) {
    if (!active) return;
    patchActive({ ...active, ramps: active.ramps.filter((ramp) => ramp.id !== rampId) });
  }

  function moveRamp(index: number, direction: -1 | 1) {
    if (!active) return;
    const next = index + direction;
    if (next < 0 || next >= active.ramps.length) return;
    const ramps = [...active.ramps];
    const [item] = ramps.splice(index, 1);
    if (!item) return;
    ramps.splice(next, 0, item);
    patchActive({ ...active, ramps });
  }

  function patchActive(set: ColorSet) {
    updateProject({
      ...project,
      sets: project.sets.map((item) => (item.id === set.id ? set : item)),
    });
  }

  const duplicateNames = new Set<string>();
  if (active) {
    const seen = new Set<string>();
    for (const ramp of active.ramps) {
      const key = ramp.name.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) duplicateNames.add(key);
      seen.add(key);
    }
  }

  async function copyJson() {
    const json = JSON.stringify(exportProject(project), null, 2);
    await navigator.clipboard.writeText(json);
    onToast("JSON copiado");
  }

  const canPublish = connections.figma.hasToken && connections.figma.fileUrl.trim().length > 0;

  async function publishApi() {
    if (!active) return;
    if (!canPublish) return;
    setPublishing(true);
    setPublishNote("");
    try {
      const response = await fetch("/api/figma/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setIds: [active.id] }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        results?: { name: string; created: number; updated: number }[];
      };
      if (!response.ok || !body.ok) {
        setPublishNote(body.error || "No se pudo publicar.");
        return;
      }
      const result = body.results?.[0];
      setPublishNote(
        result
          ? `Publicado en «${result.name}»: ${result.created} nuevas y ${result.updated} actualizadas.`
          : "Publicado en Figma.",
      );
      setShowSend(false);
    } catch {
      setPublishNote("No hay conexión con el servidor local.");
    } finally {
      setPublishing(false);
    }
  }

  const statusLabel =
    saveState === "saving" ? "Guardando…" : saveState === "error" ? "No se pudo guardar" : "Guardado en este ordenador";

  return (
    <div className="workspace">
      <aside className="sidebar">
        <header>
          <span>Collections</span>
          <button onClick={addSet} title="Nueva collection">
            +
          </button>
        </header>
        <div className="set-list">
          {project.sets.map((set) => (
            <div key={set.id} className={set.id === active?.id ? "set active" : "set"}>
              <button onClick={() => selectSet(set.id)}>
                <strong>{set.name || "Sin nombre"}</strong>
                <em>
                  {set.ramps.length} {set.ramps.length === 1 ? "rampa" : "rampas"}
                </em>
              </button>
              <button
                className="icon"
                title="Borrar collection"
                onClick={() => {
                  if (confirmSet !== set.id) {
                    setConfirmSet(set.id);
                    window.setTimeout(() => setConfirmSet((current) => (current === set.id ? null : current)), 2200);
                    return;
                  }
                  deleteSet(set.id);
                  setConfirmSet(null);
                }}
              >
                {confirmSet === set.id ? "?" : "✕"}
              </button>
            </div>
          ))}
          {project.sets.length === 0 ? <p className="empty-side">Todavía no hay collections.</p> : null}
        </div>
      </aside>

      <section className="editor">
        {active ? (
          <>
            <header className="editor-bar">
              <div>
                <input
                  className="title-input"
                  aria-label="Nombre de la collection"
                  value={active.name}
                  spellCheck={false}
                  onChange={(event) => renameSet(event.target.value)}
                />
                <p className="status">{statusLabel}</p>
              </div>
              {active.ramps.length > 0 ? (
                <div className="bar-actions">
                  <button onClick={addRamp}>
                    <PlusIcon />
                    Nueva rampa
                  </button>
                  <button onClick={() => void copyJson()}>Copiar JSON</button>
                  <button className="primary" onClick={() => setShowSend(true)}>
                    Enviar a Figma
                  </button>
                </div>
              ) : null}
            </header>

            {active.ramps.length === 0 ? (
              <div className="blank">
                <h1>Esta collection no tiene rampas</h1>
                <p>
                  Una rampa es una escala de un mismo color. Le pones un nombre, eliges el tono y defines los pasos que
                  después puedes enviar a Figma.
                </p>
                <button className="primary" onClick={addRamp}>
                  <PlusIcon />
                  Nueva rampa
                </button>
              </div>
            ) : (
              <>
            {showSend ? (
              <div className="callout send-options">
                <div>
                  <strong>Plugin</strong>
                  <p>
                    La collection está guardada aquí. En Figma abre el plugin <b>Creator</b>, pulsa <b>Leer de Creator</b>,
                    marca las collections, elige <b>Variables</b> o <b>Frame</b> y confirma. Frame dibuja todas las
                    rampas elegidas en un solo frame de la página actual. Si Figma no llega a localhost, marca{" "}
                    <b>Pegar JSON</b>.
                  </p>
                  <div className="row">
                    <button
                      onClick={() => {
                        setShowSend(false);
                        onOpenSettings();
                      }}
                    >
                      Ver instalación
                    </button>
                    <button onClick={() => void copyJson()}>Copiar JSON</button>
                  </div>
                </div>
                <div>
                  <strong>API REST</strong>
                  <p>Publica esta collection en el archivo guardado en Settings.</p>
                  {canPublish ? (
                    <button className="primary" disabled={publishing} onClick={() => void publishApi()}>
                      {publishing ? "Publicando…" : "Publicar collection"}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowSend(false);
                        onOpenSettings();
                      }}
                    >
                      Configurar token y archivo
                    </button>
                  )}
                </div>
                <div className="row">
                  <button onClick={() => setShowSend(false)}>Cerrar</button>
                </div>
              </div>
            ) : null}

            {publishNote ? <p className={publishNote.startsWith("Publicado") ? "ok" : "warn"}>{publishNote}</p> : null}
            {duplicateNames.size > 0 ? (
              <p className="warn">Hay rampas con el mismo nombre. En Figma quedarían en el mismo grupo.</p>
            ) : null}

            <div className="ramp-list">
              {active.ramps.map((ramp, index) => (
                <RampCard
                  key={ramp.id}
                  ramp={ramp}
                  canMoveUp={index > 0}
                  canMoveDown={index < active.ramps.length - 1}
                  onChange={(next) => updateRamp(ramp.id, next)}
                  onDuplicate={() => duplicateRamp(ramp)}
                  onDelete={() => deleteRamp(ramp.id)}
                  onMove={(direction) => moveRamp(index, direction)}
                  onToast={onToast}
                />
              ))}
            </div>
              </>
            )}
          </>
        ) : (
          <div className="blank">
            <h1>Rampas</h1>
            <p>Una collection agrupa varias rampas. Cada rampa es una escala con nombre, lista para llevar a Figma.</p>
            <button className="primary" onClick={addSet}>
              Crear la primera collection
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
