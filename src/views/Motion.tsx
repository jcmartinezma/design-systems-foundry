import { useEffect, useState } from "react";
import { generateTimes } from "../../shared/motion";
import type { MotionCurve, MotionScale } from "../../shared/types";

const CURVE_ROLE = [
  "Starts and ends gently.",
  "Slows as it arrives.",
  "Already moving when it starts.",
  "Keeps a constant speed.",
];

type Props = {
  scale: MotionScale;
  onChange: (scale: MotionScale) => void;
};

export function MotionView({ scale, onChange }: Props) {
  const curve = scale.curves[0]?.curve || "ease";
  const moveMs = scale.durations.find((item) => item.step === 1)?.ms ?? scale.baseMs;

  function tune(patch: Partial<Pick<MotionScale, "baseMs" | "baseDelay" | "ratio" | "count">>) {
    const next = { ...scale, ...patch };
    onChange({
      ...next,
      durations: generateTimes({ baseMs: next.baseMs, ratio: next.ratio, count: next.count, previous: scale.durations }),
      delays: generateTimes({ baseMs: next.baseDelay, ratio: next.ratio, count: next.count, previous: scale.delays }),
    });
  }

  function patchCurve(next: MotionCurve) {
    onChange({ ...scale, curves: scale.curves.map((item) => (item.id === next.id ? next : item)) });
  }

  return (
    <div className="workspace">
      <section className="editor spacing-editor">
        <div className="spacing-layout">
          <div className="spacing-options">
            <p className="hint">
              Motion is time. <b>Duration</b> is how long a change takes. <b>Delay</b> is how long it waits before it
              starts. The name is the step’s place in the list, not a role. <b>motion/duration/0</b> and{" "}
              <b>motion/delay/0</b> are 0 ms. <b>/100</b> is the base. Each next step multiplies that base by the ratio.
            </p>
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
            <p className="hint">
              A curve is written the same way as in CSS. The name is again the place: <b>motion/curve/0</b>, then 100,
              200, and 300.
            </p>
            <div className="motion-curves">
              {scale.curves.map((item, index) => (
                <div key={item.id} className="motion-curve">
                  <span className="space-token">motion/curve/{item.name}</span>
                  <input
                    type="text"
                    aria-label={`Curve of motion/curve/${item.name}`}
                    value={item.curve}
                    spellCheck={false}
                    onChange={(event) => patchCurve({ ...item, curve: event.target.value })}
                  />
                  <p>{CURVE_ROLE[index]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="spacing-stage">
            <h2>Preview</h2>
            <p className="hint">
              Hover a bar, or focus it with the keyboard. Duration bars use curve 0 and no delay. Delay bars wait, then
              move for the duration 100. Curve bars play at that same duration so you can compare them.
            </p>
            <h2>Durations</h2>
            <TimeList
              kind="duration"
              steps={scale.durations}
              moveMs={moveMs}
              curve={curve}
            />
            <h2>Delays</h2>
            <TimeList kind="delay" steps={scale.delays} moveMs={moveMs} curve={curve} />
            <h2>Curves</h2>
            <div className="motion-list">
              {scale.curves.map((item) => (
                <div key={item.id} className="motion-card">
                  <div className="motion-card-bar">
                    <span className="space-token">motion/curve/{item.name}</span>
                    <span className="type-meta">{item.curve}</span>
                  </div>
                  <MotionPreview
                    ms={moveMs}
                    delay={0}
                    curve={item.curve}
                    label={`motion/curve/${item.name}, ${moveMs} milliseconds`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
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
          transitionTimingFunction: curve || "ease",
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
      <input
        type="range"
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
