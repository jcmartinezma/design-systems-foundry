import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RangeInput } from "../components/RangeInput";
import {
  MAX_MOTION_CURVES,
  addMotionCurve,
  availableCurveKinds,
  formatCurveValues,
  generateTimes,
  parseCurveValues,
  removeMotionCurve,
  renameMotionCurve,
  setMotionCurveKind,
  setMotionCurveValues,
} from "../../shared/motion";
import type { MotionCurve, MotionCurveKind, MotionScale } from "../../shared/types";

/** Longer than the base duration so easing differences are easier to see. */
const CURVE_PREVIEW_MS = 500;

type Props = {
  scale: MotionScale;
  onChange: (scale: MotionScale) => void;
};

export function MotionView({ scale, onChange }: Props) {
  const curve = scale.curves[0]?.curve || "linear";
  const moveMs = scale.durations.find((item) => item.step === 1)?.ms ?? scale.baseMs;

  function tune(patch: Partial<Pick<MotionScale, "baseMs" | "baseDelay" | "ratio" | "count">>) {
    const next = { ...scale, ...patch };
    onChange({
      ...next,
      durations: generateTimes({ baseMs: next.baseMs, ratio: next.ratio, count: next.count, previous: scale.durations }),
      delays: generateTimes({ baseMs: next.baseDelay, ratio: next.ratio, count: next.count, previous: scale.delays }),
    });
  }

  return (
    <div className="workspace">
      <section className="editor spacing-editor">
        <div className="spacing-layout">
          <div className="spacing-options">
            <p className="hint">Choose the tokens used for motion effects.</p>
            <div className="type-controls elev-controls">
              <SliderNumber
                label="Base duration"
                unit="ms"
                value={scale.baseMs}
                min={40}
                max={1000}
                step={10}
                onChange={(baseMs) => tune({ baseMs })}
              />
              <SliderNumber
                label="Base delay"
                unit="ms"
                value={scale.baseDelay}
                min={0}
                max={1000}
                step={10}
                onChange={(baseDelay) => tune({ baseDelay })}
              />
              <SliderNumber
                label="Ratio"
                value={scale.ratio}
                min={1.05}
                max={2}
                step={0.01}
                onChange={(ratio) => tune({ ratio })}
              />
              <SliderNumber
                label="Steps"
                value={scale.count}
                min={1}
                max={8}
                step={1}
                onChange={(count) => tune({ count })}
              />
            </div>
            <p className="status">
              Duration 100 is {scale.baseMs} ms. Delay 100 is {scale.baseDelay} ms. Each next step multiplies by{" "}
              {scale.ratio.toFixed(3)}. Step 0 is always 0 ms.
            </p>

            <h2>Curves</h2>
            <div className="motion-curves">
              {scale.curves.map((item) => (
                <CurveEditor
                  key={item.id}
                  item={item}
                  kinds={availableCurveKinds(scale.curves, item.id)}
                  onKind={(kind) => onChange(setMotionCurveKind(scale, item.id, kind))}
                  onValues={(values) => {
                    const next = setMotionCurveValues(scale, item.id, values);
                    if (next !== scale) onChange(next);
                    return next !== scale;
                  }}
                  onRename={(name) => {
                    const result = renameMotionCurve(scale, item.id, name);
                    if (result.ok) {
                      onChange(result.scale);
                      return null;
                    }
                    return result.reason;
                  }}
                  onRemove={() => onChange(removeMotionCurve(scale, item.id))}
                />
              ))}
            </div>
            {scale.curves.length < MAX_MOTION_CURVES ? (
              <div className="space-actions">
                <button type="button" className="add" onClick={() => onChange(addMotionCurve(scale))}>
                  Add curve
                </button>
              </div>
            ) : null}
          </div>

          <div className="spacing-stage">
            <h2>Preview</h2>
            <p className="hint">Hover a bar to preview.</p>
            <div className="motion-group">
              <h2>Durations</h2>
              <TimeList kind="duration" steps={scale.durations} moveMs={moveMs} curve={curve} />
            </div>
            <div className="motion-group">
              <h2>Delays</h2>
              <TimeList kind="delay" steps={scale.delays} moveMs={moveMs} curve={curve} />
            </div>
            <div className="motion-group">
              <h2>Curves</h2>
              <p className="hint">Previewed at {CURVE_PREVIEW_MS} ms.</p>
              <div className="motion-list">
                {scale.curves.map((item) => (
                  <div key={item.id} className="motion-card">
                    <div className="motion-card-bar">
                      <span className="space-token">motion/curve/{item.name}</span>
                      <span className="type-meta">{item.curve}</span>
                    </div>
                    <MotionPreview
                      ms={CURVE_PREVIEW_MS}
                      delay={0}
                      curve={item.curve}
                      label={`motion/curve/${item.name}, ${CURVE_PREVIEW_MS} milliseconds`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CurveEditor({
  item,
  kinds,
  onKind,
  onValues,
  onRename,
  onRemove,
}: {
  item: MotionCurve;
  kinds: MotionCurveKind[];
  onKind: (kind: MotionCurveKind) => void;
  onValues: (values: [number, number, number, number]) => boolean;
  onRename: (name: string) => "empty" | "duplicate" | "locked" | null;
  onRemove: () => void;
}) {
  const locked = item.kind === "linear";
  const [valuesDraft, setValuesDraft] = useState(formatCurveValues(item.values));
  const [nameDraft, setNameDraft] = useState(item.name);
  const [nameError, setNameError] = useState<"empty" | "duplicate" | null>(null);

  useEffect(() => setValuesDraft(formatCurveValues(item.values)), [item.id, item.values]);
  useEffect(() => {
    setNameDraft(item.name);
    setNameError(null);
  }, [item.id, item.name]);

  function commitValues() {
    const parsed = parseCurveValues(valuesDraft);
    if (!parsed || !onValues(parsed)) {
      setValuesDraft(formatCurveValues(item.values));
    }
  }

  function commitName() {
    if (item.kind !== "custom") return;
    if (nameDraft.trim() === item.name) {
      setNameError(null);
      return;
    }
    const reason = onRename(nameDraft);
    if (reason === "duplicate" || reason === "empty") {
      setNameError(reason);
      return;
    }
    if (reason === "locked") {
      setNameDraft(item.name);
      setNameError(null);
      return;
    }
    setNameError(null);
  }

  return (
    <div className="motion-curve">
      <div className="motion-curve-head">
        {item.kind === "custom" ? (
          <label className="motion-name">
            <span>motion/curve/</span>
            <input
              type="text"
              aria-label="Custom curve token name"
              aria-invalid={nameError ? true : undefined}
              value={nameDraft}
              spellCheck={false}
              onChange={(event) => {
                setNameDraft(event.target.value);
                setNameError(null);
              }}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
        ) : (
          <span className="space-token">motion/curve/{item.name}</span>
        )}
        {locked ? (
          <span />
        ) : (
          <button type="button" className="icon" title="Remove curve" aria-label={`Remove motion/curve/${item.name}`} onClick={onRemove}>
            <X size={14} />
          </button>
        )}
      </div>
      {nameError ? (
        <p className="warn" role="alert">
          {nameError === "duplicate" ? "That token name is already used." : "Enter a token name."}
        </p>
      ) : null}
      <div className="motion-curve-fields">
        <label className="motion-curve-field">
          <span>Type</span>
          <select
            aria-label={`Type of motion/curve/${item.name}`}
            value={item.kind}
            disabled={locked}
            onChange={(event) => onKind(event.target.value as MotionCurveKind)}
          >
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="motion-curve-field">
          <span>Values</span>
          <input
            type="text"
            aria-label={`Values of motion/curve/${item.name}`}
            value={valuesDraft}
            spellCheck={false}
            readOnly={locked}
            disabled={locked}
            onChange={(event) => setValuesDraft(event.target.value)}
            onBlur={commitValues}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

function TimeList({
  kind,
  steps,
  moveMs,
  curve,
}: {
  kind: "duration" | "delay";
  steps: MotionScale["durations"];
  moveMs: number;
  curve: string;
}) {
  return (
    <div className="motion-list">
      {steps.map((item) => (
        <div key={item.id} className="motion-card">
          <div className="motion-card-bar">
            <span className="space-token">
              motion/{kind}/{item.name}
            </span>
            <span className="type-meta">{item.ms} ms</span>
          </div>
          <MotionPreview
            ms={kind === "duration" ? item.ms : moveMs}
            delay={kind === "delay" ? item.ms : 0}
            curve={curve}
            label={
              kind === "duration"
                ? `motion/duration/${item.name}, ${item.ms} milliseconds`
                : `motion/delay/${item.name}, waits ${item.ms} milliseconds`
            }
          />
        </div>
      ))}
    </div>
  );
}

function MotionPreview({ ms, delay, curve, label }: { ms: number; delay: number; curve: string; label: string }) {
  const [on, setOn] = useState(false);
  return (
    <span
      className="motion-track"
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
      tabIndex={0}
      aria-label={label}
    >
      <i
        style={{
          transform: on ? "translate(calc(100cqi - 24px), -50%)" : "translate(0, -50%)",
          transitionProperty: "transform",
          transitionDuration: `${Math.max(0, ms)}ms`,
          transitionTimingFunction: curve || "linear",
          transitionDelay: on ? `${Math.max(0, delay)}ms` : "0ms",
        }}
      />
    </span>
  );
}

function SliderNumber({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
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

  return (
    <label className="elev-slider">
      <span className="elev-slider-top">
        <span>{shown}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          aria-label={`${label} value`}
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
        aria-label={label}
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
