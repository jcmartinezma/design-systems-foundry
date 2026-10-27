import { useEffect, useMemo, useRef, useState } from "react";
import { cssForExport, downloadFileNames, exportSystem, pluginLibrary } from "../../shared/export";
import { foundationZip } from "../../shared/exportBundle";
import type { DesignSystem } from "../../shared/types";
import { readExportConnection, writeExportConnection } from "../exportConnection";
import { enablePublish } from "../features";
import { FOUNDATIONS, type FoundationId } from "../sections";

type Props = {
  system: DesignSystem;
  onToast: (message: string) => void;
  onExported: () => void;
};

const ALL_FOUNDATIONS = FOUNDATIONS.map((item) => item.id);

export function ExportView({ system, onToast, onExported }: Props) {
  const [fileUrl, setFileUrl] = useState(() => (enablePublish ? readExportConnection(system.id).fileUrl : ""));
  const [token, setToken] = useState(() => (enablePublish ? readExportConnection(system.id).token : ""));
  const [picked, setPicked] = useState<Set<FoundationId>>(() => new Set(ALL_FOUNDATIONS));
  const [manifest, setManifest] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const skipWrite = useRef(true);

  useEffect(() => {
    if (!enablePublish) return;
    const stored = readExportConnection(system.id);
    setFileUrl(stored.fileUrl);
    setToken(stored.token);
    setMessage("");
    setError("");
    skipWrite.current = true;
  }, [system.id]);

  useEffect(() => {
    if (!enablePublish) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    writeExportConnection(system.id, { token, fileUrl });
  }, [system.id, token, fileUrl]);

  useEffect(() => {
    if (!enablePublish) return;
    fetch("/api/health")
      .then((response) => response.json() as Promise<{ pluginManifest?: string }>)
      .then((body) => setManifest(body.pluginManifest ?? ""))
      .catch(() => setManifest(""));
  }, []);

  const selected = useMemo(() => ALL_FOUNDATIONS.filter((id) => picked.has(id)), [picked]);
  const counts = useMemo(() => {
    const map = new Map<FoundationId, number>();
    for (const id of ALL_FOUNDATIONS) {
      map.set(id, exportSystem(system, [id]).sets[0]?.variables.length ?? 0);
    }
    return map;
  }, [system]);

  const file = exportSystem(system, selected);
  const count = file.sets[0]?.variables.length ?? 0;
  const hasFoundations = selected.length > 0;
  const canCallApi = enablePublish && token.trim().length > 0 && fileUrl.trim().length > 0;
  const busy = publishing || testing;
  const zipFiles = downloadFileNames(selected);

  function toggleFoundation(id: FoundationId) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyJson() {
    if (!hasFoundations) return;
    await navigator.clipboard.writeText(JSON.stringify(pluginLibrary([system], system.id, selected), null, 2));
    onExported();
    onToast("JSON copied");
  }

  async function copyCss() {
    if (!hasFoundations) return;
    await navigator.clipboard.writeText(cssForExport(file));
    onExported();
    onToast("CSS copied");
  }

  async function copyManifest() {
    if (!manifest) return;
    await navigator.clipboard.writeText(manifest);
    onToast("Plugin path copied");
  }

  function downloadZip() {
    if (!hasFoundations) return;
    const { filename, bytes } = foundationZip(system, selected);
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    onExported();
  }

  async function test() {
    if (!canCallApi) return;
    setTesting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/figma/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), fileUrl: fileUrl.trim() }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !body.ok) {
        setError(body.error || "The test did not work.");
        return;
      }
      setMessage(body.message || "Connection works.");
    } catch {
      setError("No connection to the local server.");
    } finally {
      setTesting(false);
    }
  }

  async function publish() {
    if (!canCallApi || !hasFoundations) return;
    setPublishing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/figma/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), fileUrl: fileUrl.trim(), foundations: selected }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        results?: { name: string; created: number; updated: number; skipped?: number }[];
      };
      if (!response.ok || !body.ok) {
        setError(body.error || "Could not publish.");
        return;
      }
      onExported();
      const result = body.results?.[0];
      setMessage(
        result
          ? `Published to “${result.name}”: ${result.created} new, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped` : ""}.`
          : "Published to Figma.",
      );
    } catch {
      setError("No connection to the local server.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="workspace">
      <section className="editor settings">
        <div className="settings-body export-page">
          <p className="status">
            {count} variables from “{system.name}”.
          </p>
          <p className="hint export-lead">
            {enablePublish
              ? "The column on the left chooses the foundations you want to export, publish, copy, or download. In the plugin, the selection is on the last page."
              : "The column on the left chooses the foundations you want to copy or download."}
          </p>

          <div className="export-columns">
            <section className="panel export-foundations">
              <header className="panel-head">
                <h2>Tokens to export</h2>
                <p>Uncheck a token to leave it out of the export.</p>
              </header>
              <div className="foundation-picks" role="group" aria-label="Foundations to export">
                {FOUNDATIONS.map((item) => (
                  <label className="check foundation-pick" key={item.id}>
                    <input
                      type="checkbox"
                      checked={picked.has(item.id)}
                      onChange={() => toggleFoundation(item.id)}
                    />
                    <span>{item.label}</span>
                    <em>{counts.get(item.id) ?? 0}</em>
                  </label>
                ))}
              </div>
              {hasFoundations ? null : <p className="warn">Tick at least one foundation.</p>}
            </section>

            <div className="export-methods">
              {enablePublish ? (
                <>
                  <section className="panel">
                    <header className="panel-head">
                      <div className="panel-title">
                        <h2>REST API</h2>
                        <span className="method-tag">Enterprise</span>
                      </div>
                      <p>
                        Publishes the ticked foundations straight into a Figma file. You need an Enterprise plan and a
                        personal token with the file_variables:read and file_variables:write scopes.
                      </p>
                    </header>
                    <label className="stack">
                      <span>Personal token</span>
                      <input
                        type="password"
                        value={token}
                        autoComplete="off"
                        placeholder="Paste the token"
                        onChange={(event) => setToken(event.target.value)}
                      />
                    </label>
                    <label className="stack">
                      <span>File link</span>
                      <input
                        value={fileUrl}
                        spellCheck={false}
                        placeholder="https://www.figma.com/design/…"
                        onChange={(event) => setFileUrl(event.target.value)}
                      />
                    </label>
                    <p className="hint">
                      This remains in the browser for “{system.name || "Untitled"}” and it is not shared in the project file.
                    </p>
                    <div className="row panel-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={!canCallApi || !hasFoundations || busy}
                        onClick={() => void publish()}
                      >
                        {publishing ? "Publishing…" : "Publish system"}
                      </button>
                      <button type="button" disabled={!canCallApi || busy} onClick={() => void test()}>
                        {testing ? "Testing…" : "Test connection"}
                      </button>
                      {token ? (
                        <button type="button" disabled={busy} onClick={() => setToken("")}>
                          Remove token
                        </button>
                      ) : null}
                    </div>
                    {message ? <p className="ok">{message}</p> : null}
                    {error ? <p className="warn">{error}</p> : null}
                  </section>

                  <section className="panel">
                    <header className="panel-head">
                      <div className="panel-title">
                        <h2>Figma plugin</h2>
                        <span className="method-tag">Local</span>
                      </div>
                      <p>Import tokens to Figma through the local server and API.</p>
                    </header>
                    <ol>
                      <li>In Figma: main menu → Plugins → Development → Import plugin from manifest.</li>
                      <li>Choose this project’s manifest file located in the figma-plugin folder.</li>
                      <li>Run the Foundry plugin and follow the instructions.</li>
                    </ol>
                    <div className="path-row">
                      <p className="path">{manifest || "The path will appear when the local server responds."}</p>
                      <button type="button" disabled={!manifest} onClick={() => void copyManifest()}>
                        Copy path
                      </button>
                    </div>
                  </section>
                </>
              ) : null}

              <section className="panel">
                <header className="panel-head">
                  <h2>Copy JSON or CSS</h2>
                  <p>
                    {enablePublish ? (
                      <>
                        The same values, in two formats. JSON is the plugin fallback: paste it on the first page if Figma
                        cannot reach this computer. You can also Import JSON that same file when creating a new system —
                        it keeps the full editable definition. CSS is the custom properties for the web. Token lists
                        include only the foundations ticked on the left.
                      </>
                    ) : (
                      <>
                        The same values, in two formats. JSON carries the token list and the full editable system
                        definition. CSS is the custom properties for the web. Token lists include only the foundations
                        ticked on the left.
                      </>
                    )}
                  </p>
                </header>
                <div className="row">
                  <button type="button" disabled={!hasFoundations} onClick={() => void copyJson()}>
                    Copy JSON
                  </button>
                  <button type="button" disabled={!hasFoundations} onClick={() => void copyCss()}>
                    Copy CSS
                  </button>
                </div>
              </section>

              <section className="panel">
                <header className="panel-head">
                  <h2>Download ZIP</h2>
                  <p>
                    {enablePublish ? (
                      <>
                        A ZIP named after the system. It contains {zipFiles.join(", ")}. <b>tokens.json</b> has the Figma
                        variables plus the full system definition (so you can Import JSON to recreate the DS). Token lists
                        and <b>foundations.css</b> include only the foundations ticked on the left.
                      </>
                    ) : (
                      <>
                        A ZIP named after the system. It contains {zipFiles.join(", ")}. <b>tokens.json</b> has the
                        variables plus the full system definition. Token lists and <b>foundations.css</b> include only
                        the foundations ticked on the left.
                      </>
                    )}
                  </p>
                </header>
                <button type="button" className="download" disabled={!hasFoundations} onClick={downloadZip}>
                  Download ZIP
                </button>
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
