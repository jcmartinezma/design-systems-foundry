import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Trash2, X } from "lucide-react";
import { cssForRamp } from "../../shared/export";
import {
  contrastVerdict,
  fromOklch,
  generateStops,
  hexToOklch,
  suggestStepName,
  type ContrastTest,
} from "../../shared/color";
import type { Ramp } from "../../shared/types";

type Props = {
  ramp: Ramp;
  canMoveUp: boolean;
  canMoveDown: boolean;
  selectedIndex: number | null;
  contrastTest: ContrastTest;
  contrastBackground: string;
  onSelectStop: (index: number) => void;
  onChange: (ramp: Ramp) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onToast: (message: string) => void;
};

export function RampCard({
  ramp,
  canMoveUp,
  canMoveDown,
  selectedIndex,
  contrastTest,
  contrastBackground,
  onSelectStop,
  onChange,
  onDuplicate,
  onDelete,
  onMove,
  onToast,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stops = generateStops(ramp);
  const keyColor = fromOklch(0.72, ramp.chroma, ramp.hue).hex;

  const duplicateSteps = ramp.stepNames
    .map((name) => name.trim().toLowerCase())
    .filter((name, index, all) => name && all.indexOf(name) !== index);

  function renameStep(index: number, name: string) {
    const stepNames = ramp.stepNames.map((current, currentIndex) => (currentIndex === index ? name : current));
    onChange({ ...ramp, stepNames });
  }

  function addStep() {
    onChange({ ...ramp, stepNames: [...ramp.stepNames, suggestStepName(ramp.stepNames)] });
  }

  function removeStep(index: number) {
    if (ramp.stepNames.length <= 1) return;
    onChange({ ...ramp, stepNames: ramp.stepNames.filter((_, currentIndex) => currentIndex !== index) });
  }

  async function copyHex(hex: string) {
    await navigator.clipboard.writeText(hex);
    onToast(`${hex} copied`);
  }

  async function copyCss() {
    const css = cssForRamp(
      ramp.name,
      stops.map((stop) => ({ step: stop.step, hex: stop.hex })),
    );
    await navigator.clipboard.writeText(css);
    onToast("CSS copied");
  }

  return (
    <article className="ramp">
      <header className="ramp-head">
        <input
          className="name"
          aria-label="Ramp name"
          value={ramp.name}
          spellCheck={false}
          onChange={(event) => onChange({ ...ramp, name: event.target.value })}
        />
        <div className="ramp-actions">
          <button className="text" onClick={() => void copyCss()}>
            Copy CSS
          </button>
          <button className="icon" disabled={!canMoveUp} onClick={() => onMove(-1)} title="Move up">
            <ArrowUp size={14} />
          </button>
          <button className="icon" disabled={!canMoveDown} onClick={() => onMove(1)} title="Move down">
            <ArrowDown size={14} />
          </button>
          <button className="icon" onClick={onDuplicate} title="Duplicate">
            <Copy size={14} />
          </button>
          <button
            className={confirmDelete ? "icon danger" : "icon"}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                window.setTimeout(() => setConfirmDelete(false), 2200);
                return;
              }
              onDelete();
            }}
            title="Delete ramp"
          >
            {confirmDelete ? "Delete?" : <X size={14} />}
          </button>
        </div>
      </header>

      <div className="controls">
        <label className="picker">
          <span>Base color</span>
          <input
            type="color"
            value={keyColor}
            aria-label="Choose hue and chroma"
            onChange={(event) => {
              const oklch = hexToOklch(event.target.value);
              if (!oklch) return;
              onChange({ ...ramp, hue: oklch.h, chroma: Math.min(oklch.c, 0.37) });
            }}
          />
        </label>
        <Slider
          label="Hue"
          min={0}
          max={360}
          step={1}
          value={Math.round(ramp.hue)}
          className="hue"
          onChange={(hue) => onChange({ ...ramp, hue })}
        />
        <Slider
          label="Chroma"
          min={0}
          max={0.37}
          step={0.001}
          value={Number(ramp.chroma.toFixed(3))}
          display={ramp.chroma.toFixed(3)}
          onChange={(chroma) => onChange({ ...ramp, chroma })}
        />

        <Slider
          label="Light L"
          min={0}
          max={1}
          step={0.01}
          value={Number(ramp.lightnessLight.toFixed(2))}
          display={ramp.lightnessLight.toFixed(2)}
          onChange={(lightnessLight) => onChange({ ...ramp, lightnessLight })}
        />
        <Slider
          label="Dark L"
          min={0}
          max={1}
          step={0.01}
          value={Number(ramp.lightnessDark.toFixed(2))}
          display={ramp.lightnessDark.toFixed(2)}
          onChange={(lightnessDark) => onChange({ ...ramp, lightnessDark })}
        />

        <label className="check">
          <input
            type="checkbox"
            checked={ramp.easeChroma}
            onChange={(event) => onChange({ ...ramp, easeChroma: event.target.checked })}
          />
          Ease chroma at the ends
        </label>
      </div>

      <div className="stops">
        {stops.map((stop, index) => {
          const ink = stop.l > 0.68 ? "#1a1a1a" : "#f5f5f5";
          return (
            <div
              key={`${ramp.id}-${index}`}
              className={selectedIndex === index ? "stop selected" : "stop"}
              onClick={() => onSelectStop(index)}
            >
              <button
                className="step-remove"
                disabled={ramp.stepNames.length <= 1}
                title="Remove step"
                aria-label="Remove step"
                onClick={() => removeStep(index)}
              >
                <Trash2 size={12} />
              </button>
              <div className="chip" style={{ background: stop.hex, color: ink }}>
                <input
                  className="step-name"
                  aria-label={`Step ${index + 1} name`}
                  value={ramp.stepNames[index] ?? ""}
                  spellCheck={false}
                  onChange={(event) => renameStep(index, event.target.value)}
                />
                {stop.clipped ? <i title="Chroma reduced to fit in sRGB">●</i> : null}
              </div>
              {contrastTest === "none" ? null : (
                <ContrastReadout
                  rgb={stop.rgb}
                  test={contrastTest}
                  background={contrastBackground}
                  textColor={stop.hex}
                />
              )}
              <span className="meta">
                <button type="button" onClick={() => void copyHex(stop.hex)}>
                  {stop.hex}
                </button>
              </span>
            </div>
          );
        })}
        <button className="stop add-step" onClick={addStep}>
          + Step
        </button>
      </div>

      {duplicateSteps.length > 0 ? (
        <p className="warn">Some steps share a name. In Figma they have to be different.</p>
      ) : null}
    </article>
  );
}

function ContrastReadout({
  rgb,
  test,
  background,
  textColor,
}: {
  rgb: { r: number; g: number; b: number };
  test: Exclude<ContrastTest, "none">;
  background: string;
  textColor: string;
}) {
  const verdict = contrastVerdict(rgb, background, test);
  const label = test === "wcag" ? "WCAG 2.2" : "APCA";
  return (
    <div className="contrast-readout" aria-label={`${label} ${verdict.score} ${verdict.grade}`}>
      <span className="sample" style={{ background, color: textColor }} title={`${label} text sample on the test background`}>
        Aa
      </span>
      <span className={verdict.passes ? "verdict pass" : "verdict fail"}>
        {verdict.score} {verdict.grade}
      </span>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  className,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display?: string;
  className?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className={className}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={display ?? value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
