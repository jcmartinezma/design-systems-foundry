import { useEffect, useState } from "react";
import { RangeInput } from "../components/RangeInput";
import { generateShadow, normalizeHex, parseHex, shadowCss } from "../../shared/shadow";
import type { ShadowLevel, ShadowScale } from "../../shared/types";

const PREVIEW_BG = "#e4e4e1";

type Props = {
  scale: ShadowScale;
  onChange: (scale: ShadowScale) => void;
};

export function ShadowView({ scale, onChange }: Props) {
  const [previewBg, setPreviewBg] = useState(PREVIEW_BG);
  const canvasBg = parseHex(previewBg) ? normalizeHex(previewBg) : PREVIEW_BG;

  function tune(patch: Partial<Pick<ShadowScale, "baseY" | "baseBlur" | "baseSpread" | "ratio" | "count">>) {
    const next = { ...scale, baseSpread: scale.baseSpread ?? 0, ...patch };
    onChange({
      ...next,
      levels: generateShadow({ ...next, previous: scale.levels }),
    });
  }

  function patchLevel(next: ShadowLevel) {
    onChange({ ...scale, levels: scale.levels.map((level) => (level.id === next.id ? next : level)) });
  }

  return (
    <div className="workspace">
      <section className="editor spacing-editor">
        <div className="spacing-layout">
          <div className="spacing-options">
            <p className="hint">
              Choose the tokens used for shadow effects. Each level generates five tokens (Y, Blur, Spread, Opacity, and the composite shadow).
            </p>
            <div className="type-controls elev-controls">
              <label>
                <span>Shadow color</span>
                <span className="color-line">
                  <input
                    type="color"
                    value={normalizeHex(scale.color)}
                    onChange={(event) => onChange({ ...scale, color: event.target.value })}
                    aria-label="Choose the shadow color"
                  />
                  <input
                    type="text"
                    value={scale.color}
                    spellCheck={false}
                    aria-label="Shadow color hex"
                    onChange={(event) => onChange({ ...scale, color: event.target.value })}
                  />
                </span>
              </label>
              <SliderNumber
                label="Levels"
                value={scale.count}
                min={1}
                max={6}
                step={1}
                onChange={(count) => tune({ count })}
              />
              <SliderNumber
                label="Base offset"
                unit="px"
                value={scale.baseY}
                min={0}
                max={64}
                step={1}
                onChange={(baseY) => tune({ baseY })}
              />
              <SliderNumber
                label="Base blur"
                unit="px"
                value={scale.baseBlur}
                min={0}
                max={128}
                step={1}
                onChange={(baseBlur) => tune({ baseBlur })}
              />
              <SliderNumber
                label="Base spread"
                unit="px"
                value={scale.baseSpread ?? 0}
                min={-64}
                max={64}
                step={1}
                onChange={(baseSpread) => tune({ baseSpread })}
              />
              <SliderNumber
                label="Ratio"
                value={scale.ratio}
                min={1.2}
                max={3}
                step={0.1}
                onChange={(ratio) => tune({ ratio })}
              />
            </div>
            <h2>Opacity</h2>
            <div className="elev-opacities">
              {scale.levels.map((level) => (
                <SliderNumber
                  key={level.id}
                  label={`shadow/${level.name}`}
                  ariaLabel={`Opacity of shadow/${level.name}`}
                  value={level.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(opacity) => patchLevel({ ...level, opacity })}
                />
              ))}
            </div>
          </div>
          <div className="spacing-stage">
            <h2>Preview</h2>
            <div className="elev-canvas" style={{ background: canvasBg }}>
              <label className="elev-bg">
                <span>Background</span>
                <span className="color-line">
                  <input
                    type="color"
                    value={canvasBg}
                    onChange={(event) => setPreviewBg(event.target.value)}
                    aria-label="Preview background"
                  />
                  <input
                    type="text"
                    value={previewBg}
                    spellCheck={false}
                    aria-label="Preview background hex"
                    onChange={(event) => setPreviewBg(event.target.value)}
                  />
                </span>
              </label>
              <div className="elev-grid">
                {scale.levels.map((level) => {
                  const shadow = shadowCss(level, normalizeHex(scale.color));
                  return (
                    <div key={level.id} className="elev-card" style={{ boxShadow: shadow }}>
                      <strong>shadow/{level.name}</strong>
                      <span>{stepSummary(level, shadow)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function stepSummary(level: ShadowLevel, shadow: string): string {
  if (shadow === "none") return "No shadow";
  const parts = [`${level.y} px offset`, `${level.blur} px blur`];
  if (level.spread !== 0) parts.push(`${level.spread} px spread`);
  return parts.join(" · ");
}

function SliderNumber({
  label,
  ariaLabel,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  ariaLabel?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const shown = unit ? `${label} (${unit})` : label;
  const name = ariaLabel ?? label;

  return (
    <label className="elev-slider">
      <span className="elev-slider-top">
        <span>{shown}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          aria-label={`${name} value`}
          value={draft}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const next = Number(text);
            if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
          }}
          onBlur={() => {
            const next = Number(draft);
            if (!Number.isFinite(next)) {
              setDraft(String(value));
              return;
            }
            const clamped = clamp(roundTo(next, step), min, max);
            onChange(clamped);
            setDraft(String(clamped));
          }}
        />
      </span>
      <RangeInput
        min={min}
        max={max}
        step={step}
        aria-label={name}
        value={clamp(value, min, max)}
        onChange={(event) => onChange(clamp(roundTo(Number(event.target.value), step), min, max))}
      />
    </label>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, step: number): number {
  const places = step < 1 ? Math.min(4, String(step).split(".")[1]?.length ?? 0) : 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
