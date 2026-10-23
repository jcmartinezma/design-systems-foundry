import { useEffect, useState, type ReactNode } from "react";
import { PanelRight, X } from "lucide-react";

function useNarrow(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [query]);
  return matches;
}

export function Inspector({ title, children }: { title: string; children: ReactNode }) {
  const narrow = useNarrow("(max-width: 1280px)");
  const [open, setOpen] = useState(() => !window.matchMedia("(max-width: 1280px)").matches);

  return (
    <aside className={`inspector${narrow ? " drawer" : ""}${open ? " open" : ""}`}>
      <div className="inspector-head">
        <span className="inspector-title">{title}</span>
        <button
          type="button"
          className="inspector-close"
          aria-label={open ? `Close ${title}` : `Open ${title}`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={14} /> : <PanelRight size={14} />}
        </button>
      </div>
      {open ? <div className="inspector-body">{children}</div> : null}
    </aside>
  );
}
