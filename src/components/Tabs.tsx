import { useRef } from "react";

export type TabItem<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  label: string;
  value: T;
  tabs: readonly TabItem<T>[];
  onChange: (id: T) => void;
};

export function Tabs<T extends string>({ label, value, tabs, onChange }: Props<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function select(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.id);
    buttons.current[index]?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                select((index + 1) % tabs.length);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                select((index - 1 + tabs.length) % tabs.length);
              } else if (event.key === "Home") {
                event.preventDefault();
                select(0);
              } else if (event.key === "End") {
                event.preventDefault();
                select(tabs.length - 1);
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
