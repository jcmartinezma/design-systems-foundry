import { useMemo, useState } from "react";
import { exportSystem } from "../../shared/export";
import type { DesignSystem } from "../../shared/types";

type Variable = ReturnType<typeof exportSystem>["sets"][number]["variables"][number];
type Order = "asc" | "desc";

function categoryOf(name: string): string {
  if (name.startsWith("color/")) return "Color";
  if (name.startsWith("font")) return "Typography";
  if (name.startsWith("border/")) return "Border";
  if (name.startsWith("spacing/") || name.startsWith("space/")) return "Spacing";
  if (name.startsWith("radius/")) return "Radius";
  if (name.startsWith("shadow/")) return "Shadow";
  if (name.startsWith("motion/")) return "Motion";
  if (name.startsWith("blur/")) return "Blur";
  return "Other";
}

export function TokensView({ system }: { system: DesignSystem }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [order, setOrder] = useState<Order>("asc");

  const buckets = useMemo(() => {
    const variables: Variable[] = exportSystem(system).sets[0]?.variables ?? [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? variables.filter((item) => item.name.toLowerCase().includes(needle) || item.css.toLowerCase().includes(needle))
      : variables;
    const map = new Map<string, Variable[]>();
    for (const item of filtered) {
      const key = categoryOf(item.name);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    const direction = order === "asc" ? 1 : -1;
    for (const items of map.values()) {
      // numeric: true keeps "2" before "10" (e.g. spacing/2 < spacing/10)
      items.sort((a, b) => direction * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    }
    return map;
  }, [system, query, order]);

  const types = useMemo(() => ["All", ...buckets.keys()], [buckets]);
  const activeType = types.includes(type) ? type : "All";
  const groups = [...buckets.entries()].filter(([name]) => activeType === "All" || name === activeType);

  return (
    <div className="doc-page">
      <div className="token-toolbar">
        <label className="library-search token-search">
          <input value={query} placeholder="Filter tokens" aria-label="Filter tokens" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="library-sort">
          <span>Type</span>
          <select value={activeType} aria-label="Filter by token type" onChange={(event) => setType(event.target.value)}>
            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="library-sort">
          <span>Order</span>
          <select value={order} aria-label="Sort order" onChange={(event) => setOrder(event.target.value as Order)}>
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
        </label>
      </div>
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
                <span>{item.name}</span>
                <code>{item.css}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
