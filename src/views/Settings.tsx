import { useEffect, useState } from "react";
import type { PublicConnections } from "../../shared/types";

type Props = {
  connections: PublicConnections;
  onSave: (update: { fileUrl: string; token?: string; clearToken?: boolean }) => Promise<PublicConnections>;
};

export function SettingsView({ connections, onSave }: Props) {
  const [fileUrl, setFileUrl] = useState(connections.figma.fileUrl);
  const [token, setToken] = useState("");
  const [manifest, setManifest] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFileUrl(connections.figma.fileUrl);
  }, [connections]);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json() as Promise<{ pluginManifest?: string }>)
      .then((body) => setManifest(body.pluginManifest ?? ""))
      .catch(() => setManifest(""));
  }, []);

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSave({ fileUrl, token: token.trim() || undefined });
      setToken("");
      setMessage("Conexión guardada en este ordenador.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron guardar los ajustes.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/figma/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() || undefined, fileUrl }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !body.ok) {
        setError(body.error || "La prueba no ha funcionado.");
        return;
      }
      setMessage(body.message || "Conexión correcta.");
    } catch {
      setError("No hay conexión con el servidor local.");
    } finally {
      setBusy(false);
    }
  }

  async function clearToken() {
    setBusy(true);
    setError("");
    try {
      await onSave({ fileUrl, clearToken: true });
      setToken("");
      setMessage("Token eliminado de este ordenador.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo quitar el token.");
    } finally {
      setBusy(false);
    }
  }

  async function copyManifest() {
    if (!manifest) return;
    await navigator.clipboard.writeText(manifest);
    setMessage("Ruta del plugin copiada.");
    setError("");
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <header>
          <span>Settings</span>
        </header>
        <div className="set-list">
          <div className="set active">
            <button>
              <strong>Conexiones</strong>
              <em>Figma</em>
            </button>
          </div>
        </div>
      </aside>

      <section className="editor settings">
        <header className="editor-bar">
          <div>
            <h1>Conexiones</h1>
            <p className="status">El token y el enlace se quedan en la carpeta .data de este proyecto.</p>
          </div>
        </header>

        <div className="settings-body">
          <section className="panel">
            <header className="panel-head">
              <h2>Plugin local</h2>
              <p>Figma lee las rampas de esta app. No hace falta token y puedes usarlo junto con la API.</p>
            </header>
            <ol>
              <li>En Figma: menú principal → Plugins → Development → Import plugin from manifest.</li>
              <li>Elige el archivo manifest de este proyecto.</li>
              <li>Ejecuta el plugin Creator, pulsa Leer de Creator, elige las collections y Variables o Frame, y confirma.</li>
            </ol>
            <div className="path-row">
              <p className="path">{manifest || "La ruta aparecerá cuando el servidor local responda."}</p>
              <button disabled={!manifest} onClick={() => void copyManifest()}>
                Copiar ruta
              </button>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <h2>API REST</h2>
              <p>
                Publica variables directo en un archivo. Hace falta un plan Enterprise y un token con los permisos
                file_variables:read y file_variables:write.
              </p>
            </header>
            <label className="stack">
              <span>Token personal</span>
              <input
                type="password"
                value={token}
                autoComplete="off"
                placeholder={
                  connections.figma.hasToken ? `Guardado · termina en ${connections.figma.tokenHint}` : "Pega el token"
                }
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
            <label className="stack">
              <span>Enlace del archivo</span>
              <input
                value={fileUrl}
                spellCheck={false}
                placeholder="https://www.figma.com/design/…"
                onChange={(event) => setFileUrl(event.target.value)}
              />
            </label>
            <div className="row panel-actions">
              <button disabled={busy} onClick={() => void test()}>
                Probar conexión
              </button>
              {connections.figma.hasToken ? (
                <button disabled={busy} onClick={() => void clearToken()}>
                  Quitar token
                </button>
              ) : null}
              <button className="primary" disabled={busy} onClick={() => void save()}>
                Guardar conexión
              </button>
            </div>
          </section>

          {message ? <p className="ok">{message}</p> : null}
          {error ? <p className="warn">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
