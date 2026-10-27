import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { RangeInput } from "../components/RangeInput";
import {
  addBorderValue,
  BORDER_COUNT_MAX,
  BORDER_COUNT_MIN,
  borderSpecimens,
  configureBorder,
  editBorderValue,
  removeBorderValue,
  restoreBorder,
  selectBorderMode,
  type BorderSpecimen,
} from "../../shared/border";
import { RATIO_PRESETS, SPACING_MODE_LABEL, formatSpacingPx, formatSpacingRem } from "../../shared/spacing";
import type { BorderScale, SpacingMode, SpacingStep } from "../../shared/types";

const MODES: SpacingMode[] = ["linear", "jumps", "ratio", "fibonacci", "custom"];

const MODE_HELP: Record<SpacingMode, string> = {
  linear: "Linear multiplies the base by 1, 2, 3, 4…",
  jumps: "Jumps multiplies the base by 1, 2, 3, 4, 6, 8, 10, 12…",
  ratio: "Ratio starts at the base. Each step multiplies the previous one by the ratio, then rounds to the nearest multiple of half the base.",
  fibonacci: "Fibonacci multiplies the base by 1, 2, 3, 5, 8, 13…",
  custom: "Custom keeps the pixel values you type. They sort from small to large and cannot repeat.",
};

type Props = {
  scale: BorderScale;
  onChange: (scale: BorderScale) => void;
  onToast: (message: string) => void;
};

export function BorderView({ scale, onChange, onToast }: Props) {
  const presetRatio = RATIO_PRESETS.find((item) => Math.abs(item - scale.ratio) < 0.0001);
  const [ratioFree, setRatioFree] = useState(!presetRatio);
  const positive = scale.steps.filter((step) => step.px > 0).length;
  const specimens = borderSpecimens(scale);

  function commit(next: BorderScale) {
    onChange(next);
  }

  function edit(step: SpacingStep, raw: number) {
    const result = editBorderValue(scale, step.name, raw);
    if (!result.ok) {
      onToast(result.reason === "duplicate" ? "That value is already in the scale." : "Use a number greater than 0.");
      return;
    }
    if (result.changed) commit(result.scale);
  }

  return (
    <div className="workspace">
      <section className="editor spacing-editor">
        <div className="spacing-layout">
          <div className="spacing-options">
            <p className="hint">
              Choose the tokens used for border widths. Each token is a stroke width.
            </p>
            <div className="type-controls">
              <div className="mode-field">
                <span>Scale mode</span>
                <div className="segment mode-segment" role="radiogroup" aria-label="Scale mode">
                  {MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={scale.mode === mode}
                      className={scale.mode === mode ? "active" : ""}
                      onClick={() => commit(selectBorderMode(scale, mode))}
                    >
                      {SPACING_MODE_LABEL[mode]}
                    </button>
                  ))}
                </div>
              </div>
              {scale.mode !== "custom" ? (
                <>
                  <label>
                    <span>Base (px)</span>
                    <CommitNumber
                      label="Base in pixels"
                      value={scale.base}
                      min={1}
                      max={64}
                      step={1}
                      onCommit={(base) => commit(configureBorder(scale, { base: Math.round(base) }))}
                    />
                  </label>
                  <label className="slider-field">
                    <span className="slider-top">
                      <span>Steps</span>
                      <output>{scale.count}</output>
                    </span>
                    <RangeInput
                      min={BORDER_COUNT_MIN}
                      max={BORDER_COUNT_MAX}
                      step={1}
                      aria-label="Number of steps"
                      value={scale.count}
                      onChange={(event) => commit(configureBorder(scale, { count: Number(event.target.value) }))}
                    />
                  </label>
                  {scale.mode === "ratio" ? (
                    <label>
                      <span>Ratio</span>
                      <select
                        aria-label="Ratio"
                        value={ratioFree ? "custom" : String(presetRatio ?? "custom")}
                        onChange={(event) => {
                          if (event.target.value === "custom") {
                            setRatioFree(true);
                            return;
                          }
                          setRatioFree(false);
                          commit(configureBorder(scale, { ratio: Number(event.target.value) }));
                        }}
                      >
                        {RATIO_PRESETS.map((ratio) => (
                          <option key={ratio} value={ratio}>
                            {ratio}
                          </option>
                        ))}
                        <option value="custom">Custom value</option>
                      </select>
                    </label>
                  ) : null}
                  {scale.mode === "ratio" && ratioFree ? (
                    <label>
                      <span>Custom value</span>
                      <CommitNumber
                        label="Custom ratio"
                        value={scale.ratio}
                        min={1.01}
                        max={4}
                        step={0.001}
                        onCommit={(ratio) => commit(configureBorder(scale, { ratio }))}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
            </div>
            <p className="status">{MODE_HELP[scale.mode]} A border scale has 2 to 4 steps.</p>
            {scale.edited && scale.mode === "custom" ? (
              <div className="callout space-banner">
                <p>
                  You edited the scale. It is now Custom.{" "}
                  <button type="button" onClick={() => commit(restoreBorder(scale))}>
                    Undo
                  </button>
                </p>
              </div>
            ) : null}
          </div>
          <div className="spacing-stage">
            <h2>Preview</h2>
            <div className="space-list">
              {scale.steps.map((step) => (
                <div key={step.id} className="space-item">
                  {step.offGrid ? (
                    <p className="space-note">
                      Not a multiple of {formatSpacingPx(scale.base / 2)} px. It stays in the scale.
                    </p>
                  ) : null}
                  <div className="space-row border-row">
                    <span className="space-token">border/{step.name}</span>
                    <PxField px={step.px} label={`Pixels of border/${step.name}`} onCommit={(raw) => edit(step, raw)} />
                    <span className="space-rem">{formatSpacingRem(step.px)}</span>
                    {scale.mode === "custom" && positive > BORDER_COUNT_MIN ? (
                      <button
                        type="button"
                        className="icon"
                        title="Remove step"
                        aria-label={`Remove border/${step.name}`}
                        onClick={() => commit(removeBorderValue(scale, step.name))}
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <span />
                    )}
                    <i className="border-swatch" style={{ borderWidth: step.px }} title={`${formatSpacingPx(step.px)} px`} />
                  </div>
                </div>
              ))}
            </div>
            {scale.mode === "custom" && (positive < BORDER_COUNT_MAX || scale.customFrom) ? (
              <div className="space-actions">
                {positive < BORDER_COUNT_MAX ? (
                  <button type="button" className="add" onClick={() => commit(addBorderValue(scale))}>
                    Add step
                  </button>
                ) : null}
                {scale.customFrom ? (
                  <button type="button" onClick={() => commit(restoreBorder(scale))}>
                    Reset to {SPACING_MODE_LABEL[scale.customFrom.mode]}
                  </button>
                ) : null}
              </div>
            ) : null}
            <h2>Examples</h2>
            <p className="hint">
              These pieces pick steps from the scale. Change the base, the mode, or the number of steps and the strokes
              update.
            </p>
            <div className="border-examples">
              {specimens.map((item) => (
                <figure key={item.id} className="border-example">
                  <div className="demo">
                    <Specimen item={item} />
                  </div>
                  <figcaption>
                    <strong>{item.label}</strong>
                    <code>
                      {item.token} · {formatSpacingPx(item.px)} px
                    </code>
                    <p>{item.note}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Specimen({ item }: { item: BorderSpecimen }) {
  if (item.id === "divider") {
    return (
      <div className="border-divider">
        <i style={{ borderTopWidth: item.px }} />
      </div>
    );
  }
  if (item.id === "field") return <span className="border-field" style={{ borderWidth: item.px }}>Email</span>;
  if (item.id === "card") {
    return (
      <div className="border-card" style={{ borderWidth: item.px }}>
        <strong>Title</strong>
        <i />
        <i />
      </div>
    );
  }
  return (
    <span className="border-focus" style={{ borderWidth: item.px }}>
      Save
    </span>
  );
}

function CommitNumber({
  value,
  min,
  max,
  step,
  label,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const next = Number(text);
        if (Number.isFinite(next) && next >= min && next <= max) onCommit(next);
      }}
      onBlur={() => {
        const next = Number(draft);
        if (!Number.isFinite(next)) {
          setDraft(String(value));
          return;
        }
        onCommit(Math.min(max, Math.max(min, next)));
      }}
    />
  );
}

function PxField({ px, label, onCommit }: { px: number; label: string; onCommit: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(formatSpacingPx(px));
  const cancel = useRef(false);

  if (!open) {
    return (
      <button
        type="button"
        className="space-px"
        aria-label={label}
        onClick={() => {
          cancel.current = false;
          setDraft(formatSpacingPx(px));
          setOpen(true);
        }}
      >
        {formatSpacingPx(px)} px
      </button>
    );
  }

  return (
    <input
      className="space-px"
      type="number"
      min={0.5}
      step={0.5}
      autoFocus
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const skipped = cancel.current;
        cancel.current = false;
        setOpen(false);
        if (skipped || draft.trim() === "") return;
        const next = Number(draft);
        if (!Number.isFinite(next)) return;
        onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancel.current = true;
          setOpen(false);
        }
      }}
    />
  );
}
