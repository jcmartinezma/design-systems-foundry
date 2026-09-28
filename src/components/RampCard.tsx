import { useState } from "react";
import { cssForRamp } from "../../shared/export";
import { fromOklch, generateStops, hexToOklch, lcLabel, referenceBackground, suggestStepName } from "../../shared/color";
import type { Ramp } from "../../shared/types";

type Props = {
  ramp: Ramp;
  canMoveUp: boolean;
  canMoveDown: boolean;
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
  onChange,
  onDuplicate,
  onDelete,
  onMove,
  onToast,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stops = generateStops(ramp);
  const background = referenceBackground(ramp);
  const keyColor = fromOklch(0.72, ramp.chroma, ramp.hue).hex;
  const missed = stops.filter((stop) => stop.targetLc !== null && Math.abs(stop.lc - stop.targetLc) > 5);

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
    onToast(`${hex} copiado`);
  }

  async function copyCss() {
    const css = cssForRamp(
      ramp.name,
      stops.map((stop) => ({ step: stop.step, hex: stop.hex })),
    );
    await navigator.clipboard.writeText(css);
    onToast("CSS copiado");
  }

  return (
    <article className="ramp">
      <header className="ramp-head">
        <input
          className="name"
          aria-label="Nombre de la rampa"
          value={ramp.name}
          spellCheck={false}
          onChange={(event) => onChange({ ...ramp, name: event.target.value })}
        />
        <div className="segment" role="group" aria-label="Algoritmo">
          <button
            className={ramp.algorithm === "oklch" ? "active" : ""}
            onClick={() => onChange({ ...ramp, algorithm: "oklch" })}
          >
            OKLCH
          </button>
          <button
            className={ramp.algorithm === "apca" ? "active" : ""}
            onClick={() => onChange({ ...ramp, algorithm: "apca" })}
          >
            APCA
          </button>
        </div>
        <div className="ramp-actions">
          <button className="text" onClick={() => void copyCss()}>
            Copiar CSS
          </button>
          <button className="icon" disabled={!canMoveUp} onClick={() => onMove(-1)} title="Subir">
            ↑
          </button>
          <button className="icon" disabled={!canMoveDown} onClick={() => onMove(1)} title="Bajar">
            ↓
          </button>
          <button className="icon" onClick={onDuplicate} title="Duplicar">
            ⧉
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
            title="Borrar rampa"
          >
            {confirmDelete ? "¿Borrar?" : "✕"}
          </button>
        </div>
      </header>

      <p className="hint">
        {ramp.algorithm === "oklch"
          ? "Los pasos se reparten por luminosidad OKLCH. El tono se mantiene y el croma se adapta al gamut de la pantalla."
          : "Los pasos buscan un contraste APCA equidistante sobre el fondo elegido. Lc alrededor de 60 es un mínimo habitual para texto; 75 se lee con más holgura."}
      </p>

      <div className="controls">
        <label className="picker">
          <span>Color base</span>
          <input
            type="color"
            value={keyColor}
            aria-label="Elegir tono y croma"
            onChange={(event) => {
              const oklch = hexToOklch(event.target.value);
              if (!oklch) return;
              onChange({ ...ramp, hue: oklch.h, chroma: Math.min(oklch.c, 0.37) });
            }}
          />
        </label>
        <Slider
          label="Tono"
          min={0}
          max={360}
          step={1}
          value={Math.round(ramp.hue)}
          className="hue"
          onChange={(hue) => onChange({ ...ramp, hue })}
        />
        <Slider
          label="Croma"
          min={0}
          max={0.37}
          step={0.001}
          value={Number(ramp.chroma.toFixed(3))}
          display={ramp.chroma.toFixed(3)}
          onChange={(chroma) => onChange({ ...ramp, chroma })}
        />

        {ramp.algorithm === "oklch" ? (
          <>
            <Slider
              label="L claro"
              min={0}
              max={1}
              step={0.01}
              value={Number(ramp.lightnessLight.toFixed(2))}
              display={ramp.lightnessLight.toFixed(2)}
              onChange={(lightnessLight) => onChange({ ...ramp, lightnessLight })}
            />
            <Slider
              label="L oscuro"
              min={0}
              max={1}
              step={0.01}
              value={Number(ramp.lightnessDark.toFixed(2))}
              display={ramp.lightnessDark.toFixed(2)}
              onChange={(lightnessDark) => onChange({ ...ramp, lightnessDark })}
            />
          </>
        ) : (
          <>
            <div className="field">
              <span>Fondo</span>
              <div className="segment" role="group" aria-label="Fondo de contraste">
                {(
                  [
                    ["white", "Blanco"],
                    ["black", "Negro"],
                    ["custom", "Otro"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={ramp.apcaBackground === value ? "active" : ""}
                    onClick={() => onChange({ ...ramp, apcaBackground: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {ramp.apcaBackground === "custom" ? (
              <label className="picker">
                <span>Color de fondo</span>
                <input
                  type="color"
                  value={background}
                  onChange={(event) => onChange({ ...ramp, apcaCustomHex: event.target.value })}
                />
              </label>
            ) : null}
            <Slider
              label="Lc mínimo"
              min={0}
              max={108}
              step={1}
              value={Math.round(ramp.apcaMin)}
              onChange={(apcaMin) => onChange({ ...ramp, apcaMin })}
            />
            <Slider
              label="Lc máximo"
              min={0}
              max={108}
              step={1}
              value={Math.round(ramp.apcaMax)}
              onChange={(apcaMax) => onChange({ ...ramp, apcaMax })}
            />
          </>
        )}

        <label className="check">
          <input
            type="checkbox"
            checked={ramp.easeChroma}
            onChange={(event) => onChange({ ...ramp, easeChroma: event.target.checked })}
          />
          Suavizar el croma en los extremos
        </label>
      </div>

      <div className="stops">
        {stops.map((stop, index) => {
          const ink = stop.l > 0.68 ? "#1a1a1a" : "#f5f5f5";
          const miss = stop.targetLc !== null && Math.abs(stop.lc - stop.targetLc) > 5;
          return (
            <div key={`${ramp.id}-${index}`} className="stop">
              <button
                className="step-remove"
                disabled={ramp.stepNames.length <= 1}
                title="Quitar paso"
                aria-label="Quitar paso"
                onClick={() => removeStep(index)}
              >
                <TrashIcon />
              </button>
              <div className="chip" style={{ background: stop.hex, color: ink }}>
                <input
                  className="step-name"
                  aria-label={`Nombre del paso ${index + 1}`}
                  value={ramp.stepNames[index] ?? ""}
                  spellCheck={false}
                  onChange={(event) => renameStep(index, event.target.value)}
                />
                {stop.clipped ? <i title="Croma reducido para caber en sRGB">●</i> : null}
              </div>
              {ramp.algorithm === "apca" ? (
                <span className="sample" style={{ background, color: stop.hex }}>
                  Aa
                </span>
              ) : null}
              <span className="meta">
                <button type="button" onClick={() => void copyHex(stop.hex)}>
                  {stop.hex}
                </button>
                <em className={miss ? "miss" : ""}>Lc {lcLabel(stop.lc)}</em>
              </span>
            </div>
          );
        })}
        <button className="stop add-step" onClick={addStep}>
          + Paso
        </button>
      </div>

      {duplicateSteps.length > 0 ? (
        <p className="warn">Hay pasos con el mismo nombre. En Figma tienen que ser distintos.</p>
      ) : null}

      {missed.length > 0 ? (
        <p className="warn">
          {missed.length === 1 ? "Un paso no llega" : `${missed.length} pasos no llegan`} al contraste pedido:
          ese tono se sale del gamut sRGB antes de alcanzar el Lc.
        </p>
      ) : null}
    </article>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.2 3.4h7.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.7 3.3V2.3h2.6v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.3 3.4 3.7 9.4h4.6l.4-6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5.1 5.1v2.8M6.9 5.1v2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
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
