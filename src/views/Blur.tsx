import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  addBlurValue,
  BLUR_COUNT_MAX,
  BLUR_COUNT_MIN,
  blurSpecimens,
  configureBlur,
  editBlurValue,
  removeBlurValue,
  restoreBlur,
  selectBlurMode,
  type BlurSpecimen,
} from "../../shared/blur";
import { RATIO_PRESETS, SPACING_MODE_LABEL, formatSpacingPx, formatSpacingRem } from "../../shared/spacing";
import type { BlurScale, SpacingMode, SpacingStep } from "../../shared/types";

const MODES: SpacingMode[] = ["linear", "jumps", "ratio", "fibonacci", "custom"];

const MODE_HELP: Record<SpacingMode, string> = {
  linear: "Linear multiplies the base by 1, 2, 3, 4…",
  jumps: "Jumps multiplies the base by 1, 2, 3, 4, 6, 8, 10, 12…",
  ratio: "Ratio starts at the base. Each step multiplies the previous one by the ratio, then rounds to the nearest multiple of half the base.",
  fibonacci: "Fibonacci multiplies the base by 1, 2, 3, 5, 8, 13…",
  custom: "Custom keeps the pixel values you type. They sort from small to large and cannot repeat.",
};

type Props = {
  scale: BlurScale;
  onChange: (scale: BlurScale) => void;
  onToast: (message: string) => void;
};

export function BlurView({ scale, onChange, onToast }: Props) {
  const presetRatio = RATIO_PRESETS.find((item) => Math.abs(item - scale.ratio) < 0.0001);
  const [ratioFree, setRatioFree] = useState(!presetRatio);
  const positive = scale.steps.filter((step) => step.px > 0).length;
  const specimens = blurSpecimens(scale);

  function commit(next: BlurScale) {
    onChange(next);
  }

  function edit(step: SpacingStep, raw: number) {
    const result = editBlurValue(scale, step.name, raw);
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
              Each token is a blur radius. Step 0 is always no blur, 0 px. The name <b>blur/100</b> is the step’s place
              in the list, not the number of pixels. Click a value to edit it. A generated scale becomes Custom.
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
                  onCommit={(base) => commit(configureBlur(scale, { base: Math.round(base) }))}
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
                      onClick={() => commit(selectBlurMode(scale, mode))}
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
                      min={BLUR_COUNT_MIN}
                      max={BLUR_COUNT_MAX}
                      step={1}
                      aria-label="Number of steps"
                      value={scale.count}
                      onChange={(event) => commit(configureBlur(scale, { count: Number(event.target.value) }))}
                    />
                    <CommitNumber
                      label="Number of steps"
                      value={scale.count}
                      min={BLUR_COUNT_MIN}
                      max={BLUR_COUNT_MAX}
                      step={1}
                      onCommit={(count) => commit(configureBlur(scale, { count: Math.round(count) }))}
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
                      commit(configureBlur(scale, { ratio: Number(event.target.value) }));
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
                    onCommit={(ratio) => commit(configureBlur(scale, { ratio }))}
                  />
                </label>
              ) : null}
            </div>
            <p className="status">{MODE_HELP[scale.mode]} A blur scale has 1 to 4 steps, plus blur/0.</p>
          </div>
          <div className="spacing-stage">
            {scale.edited && scale.mode === "custom" ? (
              <div className="callout space-banner">
                <p>
                  You edited the scale. It is now Custom.{" "}
                  <button type="button" onClick={() => commit(restoreBlur(scale))}>
                    Undo
                  </button>
                </p>
              </div>
            ) : null}
            <h2>Preview</h2>
            <div className="space-list blur-list">
              {scale.steps.map((step) => (
                <div key={step.id} className="space-item">
                  <div className="space-row blur-row">
                    <span className="space-token">blur/{step.name}</span>
                    {step.px === 0 ? (
                      <span className="space-fixed">0 px</span>
                    ) : (
                      <PxField px={step.px} label={`Pixels of blur/${step.name}`} onCommit={(raw) => edit(step, raw)} />
                    )}
                    <span className="space-rem">{formatSpacingRem(step.px)}</span>
                    {scale.mode === "custom" && step.px > 0 && positive > BLUR_COUNT_MIN ? (
                      <button
                        type="button"
                        className="icon"
                        title="Remove step"
                        aria-label={`Remove blur/${step.name}`}
                        onClick={() => commit(removeBlurValue(scale, step.name))}
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <span />
                    )}
                    <i className="blur-swatch" title={`${formatSpacingPx(step.px)} px`}>
                      <i style={{ filter: `blur(${step.px}px)` }} />
                    </i>
                  </div>
                  {step.offGrid ? (
                    <p className="space-note">
                      Not a multiple of {formatSpacingPx(scale.base / 2)} px. It stays in the scale.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {scale.mode === "custom" && (positive < BLUR_COUNT_MAX || scale.customFrom) ? (
              <div className="space-actions">
                {positive < BLUR_COUNT_MAX ? (
                  <button type="button" className="add" onClick={() => commit(addBlurValue(scale))}>
                    Add step
                  </button>
                ) : null}
                {scale.customFrom ? (
                  <button type="button" onClick={() => commit(restoreBlur(scale))}>
                    Reset to {SPACING_MODE_LABEL[scale.customFrom.mode]}
                  </button>
                ) : null}
              </div>
            ) : null}
            <h2>Examples</h2>
            <p className="hint">
              These pieces pick steps from the scale. Change the base, the mode, or the number of steps and the blur
              updates. Each piece blurs what sits behind it: the bigger the surface or the more it must hide, the bigger the step.
            </p>
            <div className="blur-examples">
              {specimens.map((item) => (
                <figure key={item.id} className="blur-example">
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

function Specimen({ item }: { item: BlurSpecimen }) {
  const backdrop = { backdropFilter: `blur(${item.px}px)`, WebkitBackdropFilter: `blur(${item.px}px)` };
  if (item.id === "tooltip") {
    return (
      <div className="blur-scene">
        <div className="blur-tooltip-stack">
          <span className="blur-tooltip" style={backdrop}>
            Copy a link to share this page with your team
          </span>
          <span className="blur-trigger">Share</span>
        </div>
      </div>
    );
  }
  if (item.id === "topnav") {
    return (
      <div className="blur-scene">
        <div className="blur-topnav" style={backdrop}>
          <i />
          <span>Home</span>
          <span>Docs</span>
          <span>Pricing</span>
        </div>
      </div>
    );
  }
  if (item.id === "popover") {
    return (
      <div className="blur-scene">
        <div className="blur-popover-stack">
          <span className="blur-trigger">Account</span>
          <div className="blur-popover" style={backdrop}>
            <span>Profile</span>
            <span>Settings</span>
            <span>Sign out</span>
          </div>
        </div>
      </div>
    );
  }
  if (item.id === "overlay") {
    return (
      <div className="blur-scene">
        <div className="blur-veil" style={backdrop}>
          <span className="blur-spinner" />
          Loading
        </div>
      </div>
    );
  }
  return null;
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
