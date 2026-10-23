import { SYSTEM_ACCENTS } from "../../shared/accents";
import type { SystemAccent } from "../../shared/types";

type Props = {
  value: SystemAccent;
  onChange: (accent: SystemAccent) => void;
};

export function AccentPicker(props: Props) {
  return (
    <div className="accent-row" role="radiogroup" aria-label="System color">
      {SYSTEM_ACCENTS.map((accent) => (
        <button
          key={accent.id}
          type="button"
          role="radio"
          className="accent-swatch"
          aria-checked={props.value === accent.id}
          aria-label={accent.label}
          title={accent.label}
          style={{ background: accent.bg }}
          onClick={() => props.onChange(accent.id)}
        />
      ))}
    </div>
  );
}
