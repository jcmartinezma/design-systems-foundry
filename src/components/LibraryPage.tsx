import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { accentMark } from "../../shared/accents";
import { generateStops } from "../../shared/color";
import type { DesignSystem, SystemAccent, SystemStatus } from "../../shared/types";
import { formatAgo, statusLabel } from "../sections";
import { AccentPicker } from "./AccentPicker";
import { ConfirmModal } from "./ConfirmModal";
import { FileJson, Layers, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react";
import { enablePublish } from "../features";
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
  onReset: () => void;
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
      <header className="library-head" style={props.systems.length === 0 ? { justifyContent: "flex-end" } : undefined}>
        {props.systems.length > 0 ? (
          <div>
            <h1>All systems</h1>
            <p className="lede">These are your design system foundations.</p>
          </div>
        ) : null}
        <ThemeToggle value={props.theme} onChange={props.onTheme} />
      </header>

      {props.systems.length === 0 ? (
        <EmptyLibrary onBlank={props.onBlank} onImport={props.onImport} />
      ) : (
        <>
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

      <ResetApp onReset={props.onReset} />
        </>
      )}
    </div>
  );
}

function NewSystemActions({ onBlank, onImport }: { onBlank: () => void; onImport: (file: File) => void }) {
  return (
    <div className="onboard-actions">
      <button type="button" className="primary" onClick={onBlank}>
        <Plus size={14} />
        Start from scratch
      </button>
      {enablePublish ? (
        <label className="onboard-secondary">
          <FileJson size={14} />
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImport(file);
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

function EmptyLibrary({ onBlank, onImport }: { onBlank: () => void; onImport: (file: File) => void }) {
  return (
    <section className="library-onboard" aria-labelledby="library-onboard-title">
      <div className="onboard-panel">
        <span className="onboard-mark" aria-hidden="true">
          <Layers size={20} />
        </span>
        <h2 id="library-onboard-title">No design systems yet</h2>
        <p>
          {enablePublish
            ? "Create your first system to define colors, type, spacing and more. Or import one you already have."
            : "Create your first system to define colors, type, spacing and more."}
        </p>
        <NewSystemActions onBlank={onBlank} onImport={onImport} />
      </div>
    </section>
  );
}

function ResetApp({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className="library-foot">
      <button type="button" className="danger-btn" onClick={() => setConfirming(true)}>
        <Trash2 size={14} />
        Delete all data and reset
      </button>
      {confirming ? (
        <ConfirmModal
          title="Delete all data?"
          description="This deletes every design system and your saved settings. It cannot be undone."
          confirmLabel="Yes, delete everything"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onReset();
          }}
        />
      ) : null}
    </footer>
  );
}

function NewSystemCard({ onBlank, onImport }: { onBlank: () => void; onImport: (file: File) => void }) {
  if (!enablePublish) {
    return (
      <button type="button" className="sys-card sys-new sys-new-button" onClick={onBlank}>
        <span className="sys-new-mark" aria-hidden="true">
          <Plus size={16} />
        </span>
        <strong>New system</strong>
        <p>Start from nothing.</p>
      </button>
    );
  }

  return (
    <article className="sys-card sys-new">
      <span className="sys-new-mark" aria-hidden="true">
        <Plus size={16} />
      </span>
      <strong>New system</strong>
      <p>Start from nothing, or bring in a JSON file.</p>
      <NewSystemActions onBlank={onBlank} onImport={onImport} />
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
      <button
        type="button"
        className="sys-open"
        style={{ ["--sys-accent" as string]: accentMark(system.accent) }}
        onClick={onOpen}
      >
        <CardPreview system={system} />
        <span className="sys-copy">
          <strong>{name}</strong>
          <span className="sys-meta">
            <em className={`pill ${system.status}`}>{statusLabel(system.status)}</em>
            <em>v{system.version}</em>
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
              <div className="popover-sep" role="separator" />
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
                    close();
                    setConfirmDelete(true);
                  }}
                >
                  Delete system
                </button>
              ) : (
                <p className="popover-note">Create another system before deleting this one.</p>
              )}
            </div>,
            document.body,
          )
        : null}
      {confirmDelete ? (
        <ConfirmModal
          title={`Delete “${name}”?`}
          description="This permanently removes the system and all of its foundations. It cannot be undone."
          confirmLabel="Delete system"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
        />
      ) : null}
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
