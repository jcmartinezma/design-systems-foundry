import { useMemo, useState } from "react";
import { MoreHorizontal, Star } from "lucide-react";
import { exportSystem } from "../../shared/export";
import type { DesignSystem, SystemAccent, SystemStatus } from "../../shared/types";
import { FOUNDATIONS, foundationCount, sectionLabel, statusLabel, type SectionId } from "../sections";
import { AccentPicker } from "./AccentPicker";
import { ConfirmModal } from "./ConfirmModal";
import { useDismiss } from "./useDismiss";

type Props = {
  system: DesignSystem;
  section: SectionId;
  canDelete: boolean;
  onSection: (section: SectionId) => void;
  onRename: (name: string) => void;
  onStar: () => void;
  onStatus: (status: SystemStatus) => void;
  onAccent: (accent: SystemAccent) => void;
  onVersion: (version: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function SystemNav(props: Props) {
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useDismiss(menu, () => setMenu(false));
  const name = props.system.name || "Untitled";
  // Same list the Tokens Review page shows, before any filter.
  const tokenTotal = useMemo(() => exportSystem(props.system).sets[0]?.variables.length ?? 0, [props.system]);
  return (
    <aside className="sys-nav">
      <header className="sys-nav-head">
        <div className="sys-nav-id">
          <input aria-label="System name" value={props.system.name} spellCheck={false} onChange={(event) => props.onRename(event.target.value)} />
          <p>
            v{props.system.version} · {statusLabel(props.system.status)}
          </p>
        </div>
        <button
          type="button"
          className={props.system.starred ? "icon-btn starred" : "icon-btn"}
          aria-pressed={props.system.starred}
          aria-label={props.system.starred ? "Remove from favourites" : "Add to favourites"}
          title={props.system.starred ? "Remove from favourites" : "Add to favourites"}
          onClick={props.onStar}
        >
          <Star size={14} fill={props.system.starred ? "currentColor" : "none"} />
        </button>
        <div className="menu-anchor" ref={ref}>
          <button type="button" className="icon-btn" aria-label="System settings" aria-expanded={menu} onClick={() => setMenu((value) => !value)}>
            <MoreHorizontal size={16} />
          </button>
          {menu ? (
            <div className="popover sys-popover">
              <p className="popover-label">Status</p>
              <div className="segment">
                {(
                  [
                    ["draft", "Draft"],
                    ["review", "In review"],
                    ["published", "Published"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={props.system.status === value ? "active" : ""}
                    onClick={() => props.onStatus(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="popover-field">
                Version
                <input value={props.system.version} spellCheck={false} onChange={(event) => props.onVersion(event.target.value)} />
              </label>
              <p className="popover-label">Color</p>
              <AccentPicker value={props.system.accent} onChange={props.onAccent} />
              <div className="popover-sep" role="separator" />
              <button type="button" onClick={props.onDuplicate}>
                Duplicate
              </button>
              {props.canDelete ? (
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    setMenu(false);
                    setConfirmDelete(true);
                  }}
                >
                  Delete system
                </button>
              ) : (
                <p className="popover-note">Create another system before deleting this one.</p>
              )}
            </div>
          ) : null}
        </div>
      </header>
      {confirmDelete ? (
        <ConfirmModal
          title={`Delete “${name}”?`}
          description="This permanently removes the system and all of its foundations. It cannot be undone."
          confirmLabel="Delete system"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            props.onDelete();
          }}
        />
      ) : null}

      <nav className="sys-nav-list">
        <p className="nav-label">Foundations</p>
        {FOUNDATIONS.map((item) => {
          const count = foundationCount(props.system, item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={props.section === item.id ? "nav-item active" : "nav-item"}
              aria-current={props.section === item.id ? "page" : undefined}
              onClick={() => props.onSection(item.id)}
            >
              <em>{item.index}</em>
              <span>{item.label}</span>
              <b>{count === null ? "—" : count}</b>
            </button>
          );
        })}

        <p className="nav-label">Output</p>
        {(["tokens", "export"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={props.section === item ? "nav-item active" : "nav-item"}
            aria-current={props.section === item ? "page" : undefined}
            onClick={() => props.onSection(item)}
          >
            <span>{sectionLabel(item)}</span>
            {item === "tokens" ? <b>{tokenTotal}</b> : null}
          </button>
        ))}
      </nav>
    </aside>
  );
}
