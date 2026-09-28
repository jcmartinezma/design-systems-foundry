import { useEffect, useMemo, useState } from "react";
import { ICON_SIZES, type IconCatalog, type IconCollectionSummary, type IconLibrary, type IconSize } from "../../shared/icons";

type FontResult = {
  count: number;
  files: string[];
  skipped: { file: string; reason: string }[];
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || "La app local no ha respondido.");
  return body as T;
}

export function IconsView() {
  const [library, setLibrary] = useState<IconLibrary | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<IconCatalog | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<IconSize | "all">("all");
  const [busy, setBusy] = useState<"font" | "figma" | null>(null);

  const active = library?.collections.find((item) => item.name === activeName) ?? library?.collections[0] ?? null;

  async function loadLibrary() {
    const next = await readJson<IconLibrary>(await fetch("/api/icons"));
    setLibrary(next);
    setActiveName((current) => {
      if (current && next.collections.some((item) => item.name === current)) return current;
      return next.collections[0]?.name ?? null;
    });
    return next;
  }

  async function fetchCatalog(name: string) {
    return readJson<IconCatalog>(await fetch(`/api/icons/${encodeURIComponent(name)}`));
  }

  useEffect(() => {
    loadLibrary().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "No se pudieron leer las colecciones.");
    });
  }, []);

  useEffect(() => {
    if (!active) {
      setCatalog(null);
      return;
    }
    let cancelled = false;
    fetchCatalog(active.name)
      .then((next) => {
        if (cancelled) return;
        setCatalog(next);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setCatalog(null);
        setError(reason instanceof Error ? reason.message : "No se pudo abrir la colección.");
      });
    return () => {
      cancelled = true;
    };
  }, [active?.name]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (catalog?.icons ?? []).filter((icon) => {
      if (size !== "all" && icon.size !== size) return false;
      if (!needle) return true;
      return icon.name.includes(needle) || icon.file.includes(needle);
    });
  }, [catalog, query, size]);

  async function reload() {
    setError("");
    setNote("");
    try {
      const next = await loadLibrary();
      const name = next.collections.find((item) => item.name === active?.name)?.name ?? next.collections[0]?.name;
      if (name) {
        const next = await fetchCatalog(name);
        setCatalog(next);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron recargar las colecciones.");
    }
  }

  async function buildFont() {
    if (!active) return;
    setBusy("font");
    setError("");
    setNote("");
    try {
      const result = await readJson<FontResult & { ok: boolean }>(
        await fetch(`/api/icons/${encodeURIComponent(active.name)}/font`, { method: "POST" }),
      );
      const next = await fetchCatalog(active.name);
      setCatalog(next);
      await loadLibrary();
      const skipped = result.skipped.length ? ` ${result.skipped.length} archivos se han quedado fuera.` : "";
      setNote(`Fuente generada con ${result.count} iconos.${skipped} Los archivos están en .data/icons/${active.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se ha podido generar la fuente.");
    } finally {
      setBusy(null);
    }
  }

  async function prepareFigma() {
    if (!active) return;
    setBusy("figma");
    setError("");
    setNote("");
    try {
      const next = await fetchCatalog(active.name);
      setCatalog(next);
      setNote(
        next.icons.length
          ? `Listos ${next.icons.length} iconos de «${next.name}». En Figma, abre el plugin Creator, entra en Iconos y pulsa Importar.`
          : "Esta colección no tiene iconos válidos para llevar a Figma.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se han podido preparar los iconos.");
    } finally {
      setBusy(null);
    }
  }

  const counts = new Map<IconSize, number>();
  for (const icon of catalog?.icons ?? []) counts.set(icon.size, (counts.get(icon.size) ?? 0) + 1);
  const fonts = catalog && active && catalog.name === active.name ? catalog.fonts : [];

  return (
    <div className="workspace">
      <aside className="sidebar">
        <header>
          <span>Collections</span>
          <button type="button" onClick={() => void reload()} title="Recargar carpetas" disabled={busy !== null}>
            ↻
          </button>
        </header>
        <div className="set-list">
          {library?.collections.map((collection) => (
            <CollectionRow
              key={collection.name}
              collection={collection}
              active={collection.name === active?.name}
              onSelect={() => {
                setNote("");
                setError("");
                setActiveName(collection.name);
              }}
            />
          ))}
          {library && library.collections.length === 0 ? <p className="empty-side">Todavía no hay collections.</p> : null}
        </div>
      </aside>

      <section className="editor">
        {active && catalog?.name === active.name ? (
          <>
            <header className="editor-bar">
              <div>
                <div className="collection-title" title="El nombre es el de la carpeta. Renómbrala en el proyecto para cambiarlo.">{active.name}</div>
                <p className="status">
                  {catalog.icons.length} {catalog.icons.length === 1 ? "icono" : "iconos"} · {catalog.source}
                </p>
              </div>
              <div className="bar-actions">
                <button type="button" onClick={() => void reload()} disabled={busy !== null}>
                  Recargar
                </button>
                <button type="button" onClick={() => void buildFont()} disabled={busy !== null || catalog.icons.length === 0}>
                  {busy === "font" ? "Generando…" : "Generar fuentes"}
                </button>
                <button type="button" className="primary" onClick={() => void prepareFigma()} disabled={busy !== null || catalog.icons.length === 0}>
                  {busy === "figma" ? "Preparando…" : "Llevar a Figma"}
                </button>
              </div>
            </header>

            <div className="icons-body">
              <p className="hint">
                Cada carpeta dentro de <code>icons</code> es una collection. Para crear otra, en el proyecto haz una carpeta
                nueva, por ejemplo <code>icons/coleccion1</code>, guarda ahí los SVG como <code>icon-24-nombre.svg</code> y
                pulsa Recargar. Generar fuentes solo afecta a la collection abierta.
              </p>

              {error ? <p className="warn">{error}</p> : null}
              {note ? <p className="ok">{note}</p> : null}

              {fonts.length ? (
                <p className="font-files">
                  Descargar:{" "}
                  <a href={`/api/icons/${encodeURIComponent(active.name)}/fuente.zip`}>ZIP de la fuente</a>
                  {fonts.map((file) => (
                    <a key={file} href={`/api/icons/${encodeURIComponent(active.name)}/font/${encodeURIComponent(file)}`}>
                      {file}
                    </a>
                  ))}
                </p>
              ) : null}

              <div className="icon-filters">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre"
                  aria-label="Buscar iconos"
                />
                <div className="segment">
                  <button type="button" className={size === "all" ? "active" : ""} onClick={() => setSize("all")}>
                    Todos
                  </button>
                  {ICON_SIZES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={size === item ? "active" : ""}
                      onClick={() => setSize(item)}
                    >
                      {item}
                      <em>{counts.get(item) ?? 0}</em>
                    </button>
                  ))}
                </div>
              </div>

              {catalog.skipped.length ? (
                <p className="warn">
                  {catalog.skipped.length} archivos no se muestran. El primero: {catalog.skipped[0]?.file} —{" "}
                  {catalog.skipped[0]?.reason}
                </p>
              ) : null}

              {catalog.icons.length === 0 ? (
                <div className="blank">
                  <h1>Colección vacía</h1>
                  <p>Guarda SVG en {catalog.source} y pulsa Recargar.</p>
                </div>
              ) : null}

              {catalog.icons.length > 0 && visible.length === 0 ? <p className="hint">Ningún icono coincide con el filtro.</p> : null}

              <div className="icon-grid">
                {visible.map((icon) => (
                  <figure key={icon.file} className="icon-card">
                    <img
                      src={`/api/icons/${encodeURIComponent(active.name)}/svg?name=${encodeURIComponent(icon.file)}`}
                      alt=""
                      width={icon.size}
                      height={icon.size}
                    />
                    <figcaption>
                      <strong>{icon.name}</strong>
                      <span>{icon.size}px</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="blank">
            <h1>Iconografía</h1>
            <p>
              {error ||
                (active
                  ? "Leyendo la colección…"
                  : library
                    ? "Crea una carpeta dentro de icons, por ejemplo icons/coleccion1, guarda los SVG y pulsa Recargar."
                    : "Leyendo las colecciones…")}
            </p>
            {library ? (
              <button type="button" className="primary" onClick={() => void reload()}>
                Recargar
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function CollectionRow({
  collection,
  active,
  onSelect,
}: {
  collection: IconCollectionSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div className={active ? "set active" : "set"}>
      <button type="button" onClick={onSelect}>
        <strong>{collection.name}</strong>
        <em>
          {collection.count} {collection.count === 1 ? "icono" : "iconos"}
        </em>
      </button>
    </div>
  );
}
