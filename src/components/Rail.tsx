import { Info, LayoutGrid, X } from "lucide-react";
import { accentStyle } from "../../shared/accents";
import type { DesignSystem } from "../../shared/types";
import { initials } from "../sections";
import { NewSystemMenu } from "./NewSystemMenu";

type Props = {
  libraryActive: boolean;
  aboutActive: boolean;
  favourites: DesignSystem[];
  temporary: DesignSystem | null;
  activeId: string | null;
  onLibrary: () => void;
  onOpen: (id: string) => void;
  onDismissTemp: () => void;
  onBlank: () => void;
  onImport: (file: File) => void;
  onAbout: () => void;
};

export function Rail(props: Props) {
  return (
    <aside className="rail">
      <div className="mark" title="DS Foundry">
        <img src="/brand/dsfoundry-negative.svg" alt="DS Foundry" />
      </div>
      <div className="rail-scroll">
        <button
          type="button"
          className={props.libraryActive ? "rail-btn active" : "rail-btn"}
          title="All systems"
          aria-label="All systems"
          aria-current={props.libraryActive ? "page" : undefined}
          onClick={props.onLibrary}
        >
          <LayoutGrid size={18} />
        </button>
        {props.favourites.map((system) => (
          <SystemSlot
            key={system.id}
            system={system}
            temporary={false}
            active={props.activeId === system.id}
            onOpen={() => props.onOpen(system.id)}
          />
        ))}
        {props.temporary ? (
          <>
            <div className="rail-divider" />
            <SystemSlot
              system={props.temporary}
              temporary
              active={props.activeId === props.temporary.id}
              onOpen={() => props.onOpen(props.temporary!.id)}
              onDismiss={props.onDismissTemp}
            />
          </>
        ) : null}
        <NewSystemMenu onBlank={props.onBlank} onImport={props.onImport} />
      </div>

      <div className="rail-bottom">
        <button
          type="button"
          className={props.aboutActive ? "rail-btn active" : "rail-btn"}
          title="About"
          aria-label="About"
          aria-current={props.aboutActive ? "page" : undefined}
          onClick={props.onAbout}
        >
          <Info size={18} />
        </button>
      </div>
    </aside>
  );
}

function SystemSlot({
  system,
  temporary,
  active,
  onOpen,
  onDismiss,
}: {
  system: DesignSystem;
  temporary: boolean;
  active: boolean;
  onOpen: () => void;
  onDismiss?: () => void;
}) {
  const name = system.name || "Untitled";
  return (
    <div className={active ? "rail-slot active" : "rail-slot"}>
      <button type="button" className="rail-btn" title={name} aria-label={name} aria-current={active ? "page" : undefined} onClick={onOpen}>
        <span className={temporary ? "avatar temporary" : "avatar favourite"} style={accentStyle(system.accent)}>
          {initials(name)}
        </span>
      </button>
      {temporary && onDismiss ? (
        <button
          type="button"
          className="rail-dismiss"
          title="Remove from the rail. The system stays in All systems."
          aria-label={`Remove ${name} from the rail`}
          onClick={onDismiss}
        >
          <X size={10} />
        </button>
      ) : null}
    </div>
  );
}
