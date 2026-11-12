import { useState } from "react";
import { RangeInput } from "../components/RangeInput";
import {
  familyTokenName,
  hasLetterSpacingScale,
  MAX_STEPS_ABOVE,
  MAX_STEPS_BELOW,
  ratioValue,
  sanitizeFontFamily,
  sanitizeFontFamilyInput,
  stepsForCollection,
  TYPE_RATIOS,
} from "../../shared/type";
import type { FontFamily, TypeCollection, TypeRatioId } from "../../shared/types";

const DEFAULT_SAMPLE =
  "This is how this size reads when set in a short paragraph. It should feel comfortable across two or three lines.";

type Props = {
  scale: TypeCollection;
  onChange: (scale: TypeCollection) => void;
  onToast: (message: string) => void;
};

export function TypeView({ scale, onChange }: Props) {
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const preview = sample.trim() || DEFAULT_SAMPLE;
  const steps = [...stepsForCollection(scale)].reverse();
  const face = previewFace(scale);
  const ratio = ratioValue(scale.ratioId, scale.customRatio);
  const spacingScale = hasLetterSpacingScale(scale.spacingAtBase, scale.spacingAtLargest);

  function patchFamily(next: FontFamily) {
    onChange({ ...scale, families: scale.families.map((family) => (family.id === next.id ? next : family)) });
  }

  return (
    <div className="workspace">
      <section className="editor type-editor">
        <div className="type-layout">
          <div className="type-options">
            <p className="hint">
              This page defines font primitives. It is not a text style. Size and height start at the base.
            </p>

            <section className="type-block">
              <h2>Size</h2>
              <div className="type-controls">
                <label>
                  <span>Base size</span>
                  <span className="unit-field">
                    <input
                      type="number"
                      min={4}
                      max={120}
                      step={0.5}
                      value={scale.baseSize}
                      onChange={(event) => onChange({ ...scale, baseSize: numberOr(event.target.value, scale.baseSize) })}
                    />
                    <span className="unit">px</span>
                  </span>
                </label>
                <label>
                  <span>Ratio</span>
                  <select
                    value={scale.ratioId}
                    onChange={(event) => onChange({ ...scale, ratioId: event.target.value as TypeRatioId })}
                  >
                    {TYPE_RATIOS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.value === null ? item.name : `${item.value.toFixed(3)} ${item.name}`}
                      </option>
                    ))}
                  </select>
                </label>
                {scale.ratioId === "custom" ? (
                  <SliderField
                    label="Custom ratio"
                    min={1.05}
                    max={2}
                    step={0.001}
                    digits={3}
                    value={scale.customRatio}
                    onChange={(value) => onChange({ ...scale, customRatio: value })}
                  />
                ) : null}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={scale.wholePixels}
                    onChange={(event) => onChange({ ...scale, wholePixels: event.target.checked })}
                  />
                  <span>Whole pixels</span>
                </label>
              </div>
              <p className="status">
                Base size is {scale.baseSize} px. Each step multiplies by {ratio.toFixed(3)}.
                {scale.wholePixels ? " Sizes snap to whole pixels." : " Sizes keep one decimal."}
              </p>
            </section>

            <section className="type-block">
              <h2>Line height</h2>
              <div className="type-controls">
                <label>
                  <span>At base</span>
                  <input
                    type="number"
                    min={1}
                    max={2.5}
                    step={0.01}
                    value={scale.heightAtBase}
                    onChange={(event) =>
                      onChange({ ...scale, heightAtBase: numberOr(event.target.value, scale.heightAtBase) })
                    }
                  />
                </label>
                {scale.stepsAbove > 0 ? (
                  <label>
                    <span>At largest</span>
                    <input
                      type="number"
                      min={1}
                      max={2.5}
                      step={0.01}
                      value={scale.heightAtLargest}
                      onChange={(event) =>
                        onChange({ ...scale, heightAtLargest: numberOr(event.target.value, scale.heightAtLargest) })
                      }
                    />
                  </label>
                ) : null}
              </div>
              <p className="status">
                {scale.stepsAbove > 0
                  ? `From ${scale.heightAtBase} at the base to ${scale.heightAtLargest} at the largest size.`
                  : `All steps use ${scale.heightAtBase}.`}
              </p>
            </section>

            <section className="type-block">
              <h2>Letter spacing</h2>
              <div className="type-controls">
                <label>
                  <span>At base</span>
                  <span className="unit-field">
                    <input
                      type="number"
                      min={-0.1}
                      max={0.2}
                      step={0.01}
                      value={scale.spacingAtBase}
                      onChange={(event) =>
                        onChange({ ...scale, spacingAtBase: numberOr(event.target.value, scale.spacingAtBase) })
                      }
                    />
                    <span className="unit">em</span>
                  </span>
                </label>
                {scale.stepsAbove > 0 ? (
                  <label>
                    <span>At largest</span>
                    <span className="unit-field">
                      <input
                        type="number"
                        min={-0.1}
                        max={0.2}
                        step={0.01}
                        value={scale.spacingAtLargest}
                        onChange={(event) =>
                          onChange({
                            ...scale,
                            spacingAtLargest: numberOr(event.target.value, scale.spacingAtLargest),
                          })
                        }
                      />
                      <span className="unit">em</span>
                    </span>
                  </label>
                ) : null}
              </div>
              <p className="status">
                {spacingScale
                  ? scale.stepsAbove > 0
                    ? `From ${scale.spacingAtBase} em at the base to ${scale.spacingAtLargest} em at the largest size.`
                    : `All steps use ${scale.spacingAtBase} em.`
                  : "Leave both at 0 for a single shared spacing token."}
              </p>
            </section>

            <section className="type-block">
              <h2>Families</h2>
              <p>Name up to three fonts. Leave a slot blank to skip it. The first named font drives the preview.</p>
              <div className="type-list">
                {scale.families.map((family, index) => (
                  <div key={family.id} className="type-entry">
                    <span className="type-key">font/family/{familyTokenName(index)}</span>
                    <input
                      type="text"
                      value={family.name}
                      spellCheck={false}
                      placeholder="Font name"
                      aria-label={`Name of ${familyTokenName(index)}`}
                      onChange={(event) =>
                        patchFamily({ ...family, name: sanitizeFontFamilyInput(event.target.value) })
                      }
                      onBlur={() => patchFamily({ ...family, name: sanitizeFontFamily(family.name) })}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="type-block">
              <h2>Steps</h2>
              <div className="type-controls">
                <SliderField
                  label="Steps above the base"
                  min={0}
                  max={MAX_STEPS_ABOVE}
                  step={1}
                  value={scale.stepsAbove}
                  onChange={(value) => onChange({ ...scale, stepsAbove: clampInt(value, 0, MAX_STEPS_ABOVE) })}
                />
                <SliderField
                  label="Steps below the base"
                  min={0}
                  max={MAX_STEPS_BELOW}
                  step={1}
                  value={scale.stepsBelow}
                  onChange={(value) => onChange({ ...scale, stepsBelow: clampInt(value, 0, MAX_STEPS_BELOW) })}
                />
              </div>
            </section>
          </div>

          <section className="type-stage">
            <h2>Preview</h2>
            <p>
              One row per step of <b>font/size</b> and <b>font/height</b>
              {spacingScale ? (
                <>
                  {" "}
                  and <b>font/spacing</b>
                </>
              ) : null}
              . The sample uses {face.label}.
            </p>
            <label className="type-preview">
              <span>Sample text</span>
              <input
                type="text"
                value={sample}
                spellCheck={false}
                placeholder={DEFAULT_SAMPLE}
                onChange={(event) => setSample(event.target.value)}
              />
            </label>
            <div className="type-scale">
              {steps.map((step) => {
                const linePx = step.height;
                // When font-size is taller than line-height, glyphs paint outside the
                // line box. Pad each side by half that overflow so rows don't collide.
                const glyphPad = Math.max(0, (step.size - linePx) / 2);
                return (
                  <article
                    key={step.step}
                    className={step.step === 0 ? "type-row is-base" : "type-row"}
                    style={{ ["--type-size" as string]: `${step.size}px` }}
                  >
                    <div className="type-row-bar">
                      <span className="type-key">font/size/{step.name}</span>
                      <span className="type-meta">{step.size} px</span>
                      <span className="type-key">font/height/{step.name}</span>
                      <span className="type-meta">{linePx} px</span>
                      {spacingScale ? (
                        <>
                          <span className="type-key">font/spacing/{step.name}</span>
                          <span className="type-meta">{step.spacing} px</span>
                        </>
                      ) : null}
                      {step.step === 0 ? <span className="type-base-tag">Base</span> : null}
                    </div>
                    <p
                      className="type-sample"
                      style={{
                        fontFamily: face.family,
                        fontWeight: face.weight,
                        fontSize: step.size,
                        lineHeight: `${linePx}px`,
                        letterSpacing: `${step.spacing}px`,
                        paddingBlock: glyphPad,
                      }}
                    >
                      {preview}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  digits?: number;
  onChange: (value: number) => void;
};

function SliderField({ label, value, min, max, step, unit, digits, onChange }: SliderFieldProps) {
  const shown = digits === undefined ? String(value) : value.toFixed(digits);
  return (
    <label className="slider-field">
      <span className="slider-top">
        <span>{label}</span>
        <output>{unit ? `${shown} ${unit}` : shown}</output>
      </span>
      <RangeInput
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(event) => onChange(numberOr(event.target.value, value))}
      />
    </label>
  );
}

function previewFace(scale: TypeCollection): { family: string; weight: number; label: string } {
  const named = scale.families.map((family) => family.name.trim()).find(Boolean);
  const family = named ? `"${named.replace(/"/g, "")}", sans-serif` : "inherit";
  const familyLabel = named ? `font-1 (${named})` : "the fallback font";
  return { family, weight: 400, label: `${familyLabel} and font/weight/03` };
}

function numberOr(value: string, fallback: number): number {
  if (value.trim() === "") return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
