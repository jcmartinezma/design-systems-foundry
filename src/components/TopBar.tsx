import { Search } from "lucide-react";
import type { DesignSystem } from "../../shared/types";
import { sectionLabel, type SectionId } from "../sections";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  system: DesignSystem;
  section: SectionId;
  saveLabel: string;
  preview: "light" | "dark";
  onLibrary: () => void;
  onPreview: (preview: "light" | "dark") => void;
  onSearch: () => void;
};

export function TopBar(props: Props) {
  const name = props.system.name || "Untitled";
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        <button type="button" onClick={props.onLibrary}>
          All systems
        </button>
        <span aria-hidden="true">/</span>
        <span className="crumb-name">{name}</span>
        <span aria-hidden="true">/</span>
        <span className="crumb-current">{sectionLabel(props.section)}</span>
        {props.saveLabel !== "Saved" ? (
          <p className={props.saveLabel === "Not saved" ? "save-state warn" : "save-state"} role="status">
            {props.saveLabel}
          </p>
        ) : null}
      </nav>
      <button type="button" className="search-btn" aria-label="Search" onClick={props.onSearch}>
        <Search size={14} />
        <kbd>⌘K</kbd>
      </button>
      <ThemeToggle value={props.preview} onChange={props.onPreview} />
    </header>
  );
}
