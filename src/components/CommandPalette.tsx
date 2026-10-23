import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignSystem } from "../../shared/types";
import { FOUNDATIONS, type SectionId } from "../sections";

type Props = {
  systems: DesignSystem[];
  currentId: string | null;
  onClose: () => void;
  onLibrary: () => void;
  onOpenSystem: (id: string) => void;
  onOpenSection: (section: SectionId) => void;
};

type Row = { id: string; label: string; hint: string; run: () => void };

export function CommandPalette(props: Props) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items: Row[] = [
      { id: "library", label: "All systems", hint: "Library", run: props.onLibrary },
      ...FOUNDATIONS.map((item) => ({
        id: `section-${item.id}`,
        label: item.label,
        hint: "This system",
        run: () => props.onOpenSection(item.id),
      })),
      { id: "section-tokens", label: "Tokens", hint: "This system", run: () => props.onOpenSection("tokens") },
      { id: "section-export", label: "Export", hint: "This system", run: () => props.onOpenSection("export") },
      ...props.systems.map((system) => ({
        id: `system-${system.id}`,
        label: system.name || "Untitled",
        hint: "Open system",
        run: () => props.onOpenSystem(system.id),
      })),
    ];
    if (!props.currentId) return items.filter((item) => item.hint !== "This system" && item.label.toLowerCase().includes(needle));
    return items.filter((item) => item.label.toLowerCase().includes(needle));
  }, [props, query]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <div className="palette-backdrop" onMouseDown={props.onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={input}
          value={query}
          placeholder="Systems and sections"
          aria-label="Search systems and sections"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") props.onClose();
            if (event.key === "Enter" && rows[0]) {
              rows[0].run();
              props.onClose();
            }
          }}
        />
        <ul>
          {rows.length === 0 ? <li className="palette-empty">Nothing matches.</li> : null}
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  row.run();
                  props.onClose();
                }}
              >
                <strong>{row.label}</strong>
                <span>{row.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
