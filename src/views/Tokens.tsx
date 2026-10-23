import { useMemo, useState } from "react";
import { exportSystem } from "../../shared/export";
import type { DesignSystem } from "../../shared/types";

export function TokensView({ system }: { system: DesignSystem }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const variables = exportSystem(system).sets[0]?.variables ?? [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? variables.filter((item) => item.name.toLowerCase().includes(needle) || item.css.toLowerCase().includes(needle))
      : variables;
    const buckets = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const key = item.name.startsWith("color/")
        ? "Color"
        : item.name.startsWith("font")
          ? "Typography"
          : item.name.startsWith("border/")
            ? "Border"
            : item.name.startsWith("spacing/") || item.name.startsWith("space/")
            ? "Spacing"
            : item.name.startsWith("radius/")
              ? "Radius"
              : item.name.startsWith("shadow/")
              ? "Shadow"
              : item.name.startsWith("motion/")
                ? "Motion"
                : item.name.startsWith("blur/")
                  ? "Blur"
                  : "Other";
      buckets.set(key, [...(buckets.get(key) ?? []), item]);
    }
    return [...buckets.entries()];
  }, [system, query]);

  return (
    <div className="doc-page">
      <label className="library-search token-search">
        <input value={query} placeholder="Filter tokens" aria-label="Filter tokens" onChange={(event) => setQuery(event.target.value)} />
      </label>
      {groups.length === 0 ? <p className="hint">No token matches.</p> : null}
      {groups.map(([name, items]) => (
        <section key={name} className="token-group">
          <h2>
            {name} <em>{items.length}</em>
          </h2>
          <ul>
            {items.map((item) => (
              <li key={item.code}>
                {item.hex ? <i style={{ background: item.hex }} /> : <i className="token-empty" />}
                <strong>{item.name}</strong>
                <code>{item.css}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
