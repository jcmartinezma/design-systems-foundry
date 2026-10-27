import { useState } from "react";
import { X } from "lucide-react";
import { RangeInput } from "../components/RangeInput";
import {
  familyTokenName,
  MAX_FAMILIES,
  MAX_STEPS,
  ratioValue,
  REM_PX,
  stepsForCollection,
  TYPE_RATIOS,
} from "../../shared/type";
import type { FontFamily, TypeCollection, TypeRatioId } from "../../shared/types";

const DEFAULT_SAMPLE = "This is how this size reads";

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

  function patchFamily(next: FontFamily) {
    onChange({ ...scale, families: scale.families.map((family) => (family.id === next.id ? next : family)) });
  }

  return (
    <div className="workspace">
      <section className="editor type-editor">
        <div className="type-layout">
          <div className="type-options">
          <p className="hint">
            This page defines font primitives. It is
            not a text style. Size and height start at the base.
          </p>

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
              <span>Base height</span>
              <span className="unit-field">
                <input
                  type="number"
                  min={0.5}
                  max={3}
                  step={0.01}
                  value={scale.baseHeight}
                  onChange={(event) => onChange({ ...scale, baseHeight: numberOr(event.target.value, scale.baseHeight) })}
                />
                <span className="unit">rem</span>
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
            Base is {scale.baseSize} px size and {scale.baseHeight} rem height. The next step is × {ratio.toFixed(3)}.
            {scale.wholePixels ? " Size rounds to the nearest pixel." : " Size keeps one decimal."} Height stays in rem.
          </p>
          <div className="type-controls">
            <SliderField
              label="Steps above the base"
              min={0}
              max={MAX_STEPS}
              step={1}
              value={scale.stepsAbove}
              onChange={(value) => onChange({ ...scale, stepsAbove: clampInt(value, 0, MAX_STEPS) })}
            />
            <SliderField
              label="Steps below the base"
              min={0}
              max={MAX_STEPS}
              step={1}
              value={scale.stepsBelow}
              onChange={(value) => onChange({ ...scale, stepsBelow: clampInt(value, 0, MAX_STEPS) })}
            />
          </div>

          <section className="type-block">
            <h2>Families</h2>
            <p>
              Add up to three font names. The first font is the preview font.
            </p>
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
                    onChange={(event) => patchFamily({ ...family, name: event.target.value })}
                  />
                  <button
                    type="button"
                    className="icon"
                    title="Remove family"
                    onClick={() => onChange({ ...scale, families: scale.families.filter((item) => item.id !== family.id) })}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            {scale.families.length < MAX_FAMILIES ? (
              <button
                type="button"
                className="add"
                onClick={() =>
                  onChange({
                    ...scale,
                    families: [...scale.families, { id: crypto.randomUUID(), name: "" }],
                  })
                }
              >
                Add family
              </button>
            ) : null}
          </section>

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
          </div>

          <section className="type-stage">
            <h2>Preview</h2>
            <p>
              One row per step of <b>font/size</b> and <b>font/height</b>. The sample uses {face.label}. These rows are
              not styles: you cannot name them or assign a role.
            </p>
            <div className="type-scale">
              {steps.map((step) => {
                const linePx = step.height * REM_PX;
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
                      <span className="type-meta">{step.height} rem</span>
                      {step.step === 0 ? <span className="type-base-tag">Base</span> : null}
                    </div>
                    <p
                      className="type-sample"
                      style={{
                        fontFamily: face.family,
                        fontWeight: face.weight,
                        fontSize: step.size,
                        lineHeight: `${linePx}px`,
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
