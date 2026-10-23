import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  addRadiusValue,
  configureRadius,
  editRadiusValue,
  FULL_PX,
  RADIUS_COUNT_MAX,
  RADIUS_COUNT_MIN,
  radiusSpecimens,
  removeRadiusValue,
  restoreRadius,
  selectRadiusMode,
  type RadiusSpecimen,
} from "../../shared/radius";
import { RATIO_PRESETS, SPACING_MODE_LABEL, formatSpacingPx, formatSpacingRem } from "../../shared/spacing";
import type { RadiusScale, SpacingMode, SpacingStep } from "../../shared/types";

const MODES: SpacingMode[] = ["linear", "jumps", "ratio", "fibonacci", "custom"];

const MODE_HELP: Record<SpacingMode, string> = {
  linear: "Linear multiplies the base by 1, 2, 3, 4…",
  jumps: "Jumps multiplies the base by 1, 2, 3, 4, 6, 8, 10, 12…",
  ratio: "Ratio starts at the base. Each step multiplies the previous one by the ratio, then rounds to the nearest multiple of half the base.",
  fibonacci: "Fibonacci multiplies the base by 1, 2, 3, 5, 8, 13…",
  custom: "Custom keeps the pixel values you type. They sort from small to large and cannot repeat.",
};

type Props = {
  scale: RadiusScale;
  onChange: (scale: RadiusScale) => void;
  onToast: (message: string) => void;
};

export function RadiusView({ scale, onChange, onToast }: Props) {
  const presetRatio = RATIO_PRESETS.find((item) => Math.abs(item - scale.ratio) < 0.0001);
  const [ratioFree, setRatioFree] = useState(!presetRatio);
  const positive = scale.steps.filter((step) => step.px > 0).length;
  const specimens = radiusSpecimens(scale);
  const button = specimens.find((item) => item.id === "button");

  function commit(next: RadiusScale) {
    onChange(next);
  }

  function edit(step: SpacingStep, raw: number) {
    const result = editRadiusValue(scale, step.name, raw);
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
              Each token is a corner. Step 0 is always a sharp corner, 0 px. The name <b>radius/100</b> is the step’s
              place in the list, not the number of pixels. Click a value to edit it. A generated scale becomes Custom.
            </p>
            <div className="type-controls">
              <label>
                <span>Base (px)</span>
                <CommitNumber
                  label="Base in pixels"
                  value={scale.base}
                  min={1}
                  max={64}
                  step={1}
                  onCommit={(base) => commit(configureRadius(scale, { base: Math.round(base) }))}
                />
              </label>
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
                      onClick={() => commit(selectRadiusMode(scale, mode))}
                    >
                      {SPACING_MODE_LABEL[mode]}
                    </button>
                  ))}
                </div>
              </div>
              {scale.mode !== "custom" ? (
                <label>
                  <span>Steps · {scale.count}</span>
                  <div className="base-line">
                    <input
                      type="range"
                      min={RADIUS_COUNT_MIN}
                      max={RADIUS_COUNT_MAX}
                      step={1}
                      aria-label="Number of steps"
                      value={scale.count}
                      onChange={(event) => commit(configureRadius(scale, { count: Number(event.target.value) }))}
                    />
                    <CommitNumber
                      label="Number of steps"
                      value={scale.count}
                      min={RADIUS_COUNT_MIN}
                      max={RADIUS_COUNT_MAX}
                      step={1}
                      onCommit={(count) => commit(configureRadius(scale, { count: Math.round(count) }))}
                    />
                  </div>
                </label>
              ) : null}
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
                      commit(configureRadius(scale, { ratio: Number(event.target.value) }));
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
                    onCommit={(ratio) => commit(configureRadius(scale, { ratio }))}
                  />
                </label>
              ) : null}
              <label className="check">
                <input
                  type="checkbox"
                  checked={scale.full}
                  onChange={(event) => commit(configureRadius(scale, { full: event.target.checked }))}
                />
                <span>Full corner</span>
              </label>
            </div>
            <p className="status">
              {MODE_HELP[scale.mode]}
              {scale.full ? " Full adds radius/full, a pill: the corner follows the shape." : ""}
            </p>
          </div>
          <div className="spacing-stage">
            {scale.edited && scale.mode === "custom" ? (
              <div className="callout space-banner">
                <p>
                  You edited the scale. It is now Custom.{" "}
                  <button type="button" onClick={() => commit(restoreRadius(scale))}>
                    Undo
                  </button>
                </p>
              </div>
            ) : null}
            <h2>Preview</h2>
            <div className="space-list">
              {scale.steps.map((step) => (
                <div key={step.id} className="space-item">
                  <div className="space-row radius-row">
                    <span className="space-token">radius/{step.name}</span>
                    {step.px === 0 ? (
                      <span className="space-fixed">0 px</span>
                    ) : (
                      <PxField px={step.px} label={`Pixels of radius/${step.name}`} onCommit={(raw) => edit(step, raw)} />
                    )}
                    <span className="space-rem">{formatSpacingRem(step.px)}</span>
                    {scale.mode === "custom" && step.px > 0 && positive > RADIUS_COUNT_MIN ? (
                      <button
                        type="button"
                        className="icon"
                        title="Remove step"
                        aria-label={`Remove radius/${step.name}`}
                        onClick={() => commit(removeRadiusValue(scale, step.name))}
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <span />
                    )}
                    <i className="radius-bar" style={{ borderRadius: step.px }} title={`${formatSpacingPx(step.px)} px`} />
                  </div>
                  {step.offGrid ? (
                    <p className="space-note">
                      Not a multiple of {formatSpacingPx(scale.base / 2)} px. It stays in the scale.
                    </p>
                  ) : null}
                </div>
              ))}
              {scale.full ? (
                <div className="space-item">
                  <div className="space-row radius-row">
                    <span className="space-token">
                      radius/full
                      <em>pill</em>
                    </span>
                    <span className="space-fixed" title={`${FULL_PX} px`}>
                      pill
                    </span>
                    <span className="space-rem">shape</span>
                    <span />
                    <i className="radius-bar" style={{ borderRadius: FULL_PX }} title={`${FULL_PX} px`} />
                  </div>
                </div>
              ) : null}
            </div>
            {scale.mode === "custom" && (positive < RADIUS_COUNT_MAX || scale.customFrom) ? (
              <div className="space-actions">
                {positive < RADIUS_COUNT_MAX ? (
                  <button type="button" className="add" onClick={() => commit(addRadiusValue(scale))}>
                    Add step
                  </button>
                ) : null}
                {scale.customFrom ? (
                  <button type="button" onClick={() => commit(restoreRadius(scale))}>
                    Reset to {SPACING_MODE_LABEL[scale.customFrom.mode]}
                  </button>
                ) : null}
              </div>
            ) : null}
            <h2>Examples</h2>
            <p className="hint">
              These pieces pick steps from the scale. Change the base, the mode, or the number of steps and the corners
              update.
            </p>
            <div className="radius-examples">
              {specimens.map((item) => (
                <figure key={item.id} className="radius-example">
                  <div className="demo">
                    <Specimen item={item} buttonPx={button?.px ?? item.px} />
                  </div>
                  <figcaption>
                    <strong>{item.label}</strong>
                    <code>
                      {item.token} · {item.pill ? "pill" : `${formatSpacingPx(item.px)} px`}
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

function Specimen({ item, buttonPx }: { item: RadiusSpecimen; buttonPx: number }) {
  const radius = item.pill ? 999 : item.px;
  if (item.id === "button") return <span className="radius-button" style={{ borderRadius: radius }}>Save</span>;
  if (item.id === "field") return <span className="radius-field" style={{ borderRadius: radius }}>Email</span>;
  if (item.id === "card") {
    return (
      <div className="radius-card" style={{ borderRadius: radius }}>
        <strong>Title</strong>
        <i />
        <i />
      </div>
    );
  }
  if (item.id === "dialog") {
    return (
      <div className="radius-dialog" style={{ borderRadius: radius }}>
        <strong>Save changes</strong>
        <div className="lines">
          <i />
          <i />
        </div>
        <div className="actions">
          <span className="ghost" style={{ borderRadius: buttonPx }}>
            Cancel
          </span>
          <span style={{ borderRadius: buttonPx }}>Save</span>
        </div>
      </div>
    );
  }
  if (item.id === "chip") return <span className="radius-chip" style={{ borderRadius: radius }}>Label</span>;
  return (
    <span className="radius-avatar" style={{ borderRadius: radius }}>
      DS
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
