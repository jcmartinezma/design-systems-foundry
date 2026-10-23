import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { generateStops } from "../../shared/color";
import type { DesignSystem, SystemAccent, SystemStatus } from "../../shared/types";
import { FOUNDATION_TOTAL, formatAgo, foundationsDone, statusLabel } from "../sections";
import { ImportJson } from "./NewSystemMenu";
import { AccentPicker } from "./AccentPicker";
import { ChevronDown, MoreHorizontal, Plus, Star } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

type StatusFilter = "all" | SystemStatus;
type Sort = "edited" | "name" | "status" | "export";

const STATUS_ORDER: Record<SystemStatus, number> = { draft: 0, review: 1, published: 2 };
const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "In review" },
  { value: "published", label: "Published" },
];

type Props = {
  theme: "light" | "dark";
  onTheme: (theme: "light" | "dark") => void;
  systems: DesignSystem[];
  searchRef: RefObject<HTMLInputElement | null>;
  onOpen: (id: string) => void;
  onStar: (id: string, starred: boolean) => void;
  onDuplicate: (system: DesignSystem) => void;
  onDelete: (id: string) => void;
  onAccent: (id: string, accent: SystemAccent) => void;
  canDelete: boolean;
  onBlank: () => void;
  onImport: (file: File) => void;
};

export function LibraryPage(props: Props) {
  const [query, setQuery] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("edited");
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = props.searchRef ?? localRef;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = props.systems.filter((system) => {
      if (favouritesOnly && !system.starred) return false;
      if (status !== "all" && system.status !== status) return false;
      if (!needle) return true;
      return (system.name || "Untitled").toLowerCase().includes(needle);
    });
    next.sort((a, b) => {
      if (sort === "name") return (a.name || "Untitled").localeCompare(b.name || "Untitled");
      if (sort === "status") return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (sort === "export") return (b.lastExportAt ?? 0) - (a.lastExportAt ?? 0);
      return b.updatedAt - a.updatedAt;
    });
    return next;
  }, [props.systems, query, favouritesOnly, status, sort]);

  return (
    <div className="library-page">
      <header className="library-head">
        <div>
          <h1>All systems</h1>
          <p className="lede">Each card is one product’s foundations. Open it to edit. Star it to pin it on the rail.</p>
        </div>
        <ThemeToggle value={props.theme} onChange={props.onTheme} />
      </header>

      <div className="library-tools">
        <label className="library-search">
          <input
            ref={inputRef}
            value={query}
            placeholder="Search systems"
            aria-label="Search systems"
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>⌘K</kbd>
        </label>
        <button
          type="button"
          className={favouritesOnly ? "library-toggle on" : "library-toggle"}
          aria-pressed={favouritesOnly}
          onClick={() => setFavouritesOnly((value) => !value)}
        >
          <Star size={14} fill={favouritesOnly ? "currentColor" : "none"} />
          Favourites
        </button>
        <div className="segment" role="group" aria-label="Status">
          {STATUSES.map((item) => (
            <button key={item.value} type="button" className={status === item.value ? "active" : ""} onClick={() => setStatus(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="library-sort">
          <span>Sort</span>
          <select value={sort} aria-label="Sort systems" onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="edited">Last edited</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="export">Last export</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? <p className="library-empty">No system matches this filter.</p> : null}
      <div className="library-grid">
        {visible.map((system) => (
          <SystemCard
            key={system.id}
            system={system}
            canDelete={props.canDelete}
            onOpen={() => props.onOpen(system.id)}
            onStar={() => props.onStar(system.id, !system.starred)}
            onDuplicate={() => props.onDuplicate(system)}
            onDelete={() => props.onDelete(system.id)}
            onAccent={(accent) => props.onAccent(system.id, accent)}
          />
        ))}
        <NewSystemCard onBlank={props.onBlank} onImport={props.onImport} />
      </div>
    </div>
  );
}

function NewSystemCard({ onBlank, onImport }: { onBlank: () => void; onImport: (file: File) => void }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function place() {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = rect.width;
    const height = 92;
    const gap = 10;
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - gap - height);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - 12 - width);
    setBox({ top, left, width });
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (cardRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <article className={open ? "sys-card sys-new open" : "sys-card sys-new"}>
      <button
        ref={cardRef}
        type="button"
        className="sys-new-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) place();
          setOpen((value) => !value);
        }}
      >
        <span className="sys-new-mark" aria-hidden="true">
          <Plus size={16} />
        </span>
        <span className="sys-new-title">
          <strong>New system</strong>
          <ChevronDown size={14} />
        </span>
        <p>Start from nothing, or bring in a JSON file.</p>
      </button>
      {open && box
        ? createPortal(
            <div ref={menuRef} className="popover sys-new-menu" role="menu" style={{ top: box.top, left: box.left, width: box.width }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onBlank();
                }}
              >
                Blank
              </button>
              <ImportJson
                onImport={(file) => {
                  setOpen(false);
                  onImport(file);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}

function SystemCard({
  system,
  canDelete,
  onOpen,
  onStar,
  onDuplicate,
  onDelete,
  onAccent,
}: {
  system: DesignSystem;
  canDelete: boolean;
  onOpen: () => void;
  onStar: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAccent: (accent: SystemAccent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = system.name || "Untitled";

  function close() {
    setOpen(false);
    setConfirmDelete(false);
  }

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    const height = 168;
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - gap - height);
    let left = rect.right - width;
    if (left < 12) left = 12;
    setBox({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <article className="sys-card">
      <button type="button" className="sys-open" onClick={onOpen}>
        <CardPreview system={system} />
        <span className="sys-copy">
          <strong>{name}</strong>
          <span className="sys-meta">
            <em className={`pill ${system.status}`}>{statusLabel(system.status)}</em>
            <em>v{system.version}</em>
            <em>
              {foundationsDone(system)}/{FOUNDATION_TOTAL}
            </em>
            <em>{formatAgo(system.lastExportAt)}</em>
          </span>
        </span>
      </button>
      <button
        ref={buttonRef}
        type="button"
        className={open ? "sys-more on" : "sys-more"}
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else {
            place();
            setOpen(true);
          }
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      <button
        type="button"
        className={system.starred ? "sys-star on" : "sys-star"}
        aria-pressed={system.starred}
        aria-label={system.starred ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
        onClick={onStar}
      >
        <Star size={14} fill={system.starred ? "currentColor" : "none"} />
      </button>
      {open && box
        ? createPortal(
            <div ref={menuRef} className="popover sys-card-menu" role="menu" style={{ top: box.top, left: box.left }}>
              <p className="popover-label">Color</p>
              <AccentPicker value={system.accent} onChange={onAccent} />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onDuplicate();
                }}
              >
                Duplicate
              </button>
              {canDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  className="danger-text"
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    close();
                    onDelete();
                  }}
                >
                  {confirmDelete ? "Confirm delete" : "Delete system"}
                </button>
              ) : (
                <p className="popover-note">Create another system before deleting this one.</p>
              )}
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}

function familyLabel(families: { name: string }[]): string {
  const names = families.map((family) => family.name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(" / ") : "Untitled";
}

function CardPreview({ system }: { system: DesignSystem }) {
  const ramp = system.colors[0];
  const stops = ramp ? generateStops(ramp) : [];
  const family = system.type.families.map((item) => item.name.trim()).find(Boolean);
  return (
    <span className="sys-preview">
      <span className="sys-ramp">
        {stops.length > 0 ? stops.map((stop) => <i key={stop.step} style={{ background: stop.hex }} />) : <i className="sys-ramp-empty" />}
      </span>
      <span className="sys-type">
        <b style={{ fontFamily: family, fontSize: Math.min(system.type.baseSize, 28) }}>Ag</b>
        <span>{familyLabel(system.type.families)}</span>
      </span>
    </span>
  );
}

export function useLibrarySearchFocus(ref: RefObject<HTMLInputElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ref.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, ref]);
}
