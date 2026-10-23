import { useEffect, useRef, useState } from "react";
import { cssForExport, exportSystem, pluginLibrary } from "../../shared/export";
import type { DesignSystem } from "../../shared/types";
import { readExportConnection, writeExportConnection } from "../exportConnection";

type Props = {
  system: DesignSystem;
  onToast: (message: string) => void;
  onExported: () => void;
};

export function ExportView({ system, onToast, onExported }: Props) {
  const [fileUrl, setFileUrl] = useState(() => readExportConnection(system.id).fileUrl);
  const [token, setToken] = useState(() => readExportConnection(system.id).token);
  const [manifest, setManifest] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const skipWrite = useRef(true);

  useEffect(() => {
    const stored = readExportConnection(system.id);
    setFileUrl(stored.fileUrl);
    setToken(stored.token);
    setMessage("");
    setError("");
    skipWrite.current = true;
  }, [system.id]);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    writeExportConnection(system.id, { token, fileUrl });
  }, [system.id, token, fileUrl]);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json() as Promise<{ pluginManifest?: string }>)
      .then((body) => setManifest(body.pluginManifest ?? ""))
      .catch(() => setManifest(""));
  }, []);

  const file = exportSystem(system);
  const count = file.sets[0]?.variables.length ?? 0;
  const canCallApi = token.trim().length > 0 && fileUrl.trim().length > 0;
  const busy = publishing || testing;

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(pluginLibrary([system], system.id), null, 2));
    onExported();
    onToast("JSON copied");
  }

  async function copyCss() {
    await navigator.clipboard.writeText(cssForExport(file));
    onExported();
    onToast("CSS copied");
  }

  async function copyManifest() {
    if (!manifest) return;
    await navigator.clipboard.writeText(manifest);
    onToast("Plugin path copied");
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
    if (!canCallApi) return;
    setPublishing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/figma/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), fileUrl: fileUrl.trim() }),
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
        <div className="settings-body">
          <p className="status">
            {count} variables from “{system.name}”.
          </p>
          <p className="hint export-lead">
            Four ways to take this system out of DSfoundry. Each one exports the primitives: color, font, border, spacing,
            radius, shadow, motion, and blur. Font primitives are family, size, height, and weight. In the plugin you load every
            system, pick one, and create those variables.
          </p>

          <section className="panel">
            <header className="panel-head">
              <div className="panel-title">
                <h2>REST API</h2>
                <span className="method-tag">Enterprise</span>
              </div>
              <p>
                Publishes every variable straight into a Figma file. You need an Enterprise plan and a personal token
                with the <b>file_variables:read</b> and <b>file_variables:write</b> scopes. It writes variables only.
                Typography arrives as font variables: family, size, height, and weight.
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
              Saved in this browser for “{system.name || "Untitled"}” only. It is not part of the project file, so it
              stays on this computer if you share the project.
            </p>
            <div className="row panel-actions">
              <button type="button" className="primary" disabled={!canCallApi || busy} onClick={() => void publish()}>
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
              <p>
                Figma reads every design system saved in DSfoundry, then you pick one. No token and no Enterprise plan.
                You can use it alongside the API.
              </p>
            </header>
            <ol>
              <li>In Figma: main menu → Plugins → Development → Import plugin from manifest.</li>
              <li>Choose this project’s manifest file.</li>
              <li>
                Run the DSfoundry plugin. On the first page, click Read from DSfoundry, or paste JSON if Figma cannot
                reach this computer. Choose one system. On the last page, tick the groups, including Font, and click
                Create.
              </li>
            </ol>
            <div className="path-row">
              <p className="path">{manifest || "The path will appear when the local server responds."}</p>
              <button type="button" disabled={!manifest} onClick={() => void copyManifest()}>
                Copy path
              </button>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <h2>Copy JSON or CSS</h2>
              <p>
                The same values, in two formats. JSON is the plugin fallback: paste it on the first page if Figma cannot
                reach this computer. It includes this system’s variables. CSS is the custom properties for the web.
              </p>
            </header>
            <div className="row">
              <button type="button" onClick={() => void copyJson()}>
                Copy JSON
              </button>
              <button type="button" onClick={() => void copyCss()}>
                Copy CSS
              </button>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <h2>Download ZIP</h2>
              <p>
                A ZIP with <b>tokens.json</b> (the variables), <b>foundations.css</b> (the custom properties, including{" "}
                <b>--border-100</b> and <b>--spacing-100</b>), <b>border.dtcg.json</b> (the border scale in DTCG),{" "}
                <b>spacing.dtcg.json</b> (the spacing scale in DTCG), <b>radius.dtcg.json</b> (the radius scale in
                DTCG), and <b>blur.dtcg.json</b> (the blur scale in DTCG). The file name uses the
                system name.
              </p>
            </header>
            <a className="download" href="/api/export/download" onClick={onExported}>
              Download ZIP
            </a>
          </section>
        </div>
      </section>
    </div>
  );
}
