import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { enablePublish } from "../features";

type Props = {
  onBlank: () => void;
  onImport: (file: File) => void;
};

export function NewSystemMenu({ onBlank, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ top: rect.top, left: rect.right + 8 });
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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

  if (!enablePublish) {
    return (
      <button
        type="button"
        className="rail-btn"
        title="New system"
        aria-label="New system"
        onClick={onBlank}
      >
        <Plus size={18} />
      </button>
    );
  }

  return (
    <div className="menu-anchor rail-menu" ref={anchorRef}>
      <button
        ref={buttonRef}
        type="button"
        className={open ? "rail-btn active" : "rail-btn"}
        title="New system"
        aria-label="New system"
        aria-expanded={open}
        onClick={() => {
          if (!open) place();
          setOpen((value) => !value);
        }}
      >
        <Plus size={18} />
      </button>
      {open && box
        ? createPortal(
            <div ref={menuRef} className="popover rail-popover" role="menu" style={{ top: box.top, left: box.left }}>
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
    </div>
  );
}

export function ImportJson({ onImport, className = "menu-import" }: { onImport: (file: File) => void; className?: string }) {
  return (
    <label className={className}>
      Import JSON
      <input
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          onImport(file);
        }}
      />
    </label>
  );
}
