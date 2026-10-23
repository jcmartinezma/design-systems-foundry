import { useState } from "react";
import { Plus } from "lucide-react";
import { contrastBackgroundHex, contrastVerdict, generateStops, type ContrastGround, type ContrastTest } from "../../shared/color";
import { randomRampName } from "../../shared/names";
import { colorTokenNames } from "../../shared/export";
import { createRamp } from "../../shared/project";
import type { Ramp, Stop } from "../../shared/types";
import { Inspector } from "../components/Inspector";
import { RampCard } from "../components/RampCard";
import { Tabs } from "../components/Tabs";

type Mode = "ramps" | "contrast";

type Props = {
  colors: Ramp[];
  preview: "light" | "dark";
  onChange: (colors: Ramp[]) => void;
  onToast: (message: string) => void;
};

export function Studio({ colors, preview, onChange, onToast }: Props) {
  const [mode, setMode] = useState<Mode>("ramps");
  const [rampId, setRampId] = useState<string | null>(colors[0]?.id ?? null);
  const [stopIndex, setStopIndex] = useState(0);
  const [contrastTest, setContrastTest] = useState<ContrastTest>("none");
  const [contrastGround, setContrastGround] = useState<ContrastGround>("white");
  const [contrastCustomHex, setContrastCustomHex] = useState("#f4f4f5");
  const contrastBackground = contrastBackgroundHex(contrastGround, contrastCustomHex);
  const ramp = colors.find((item) => item.id === rampId) ?? colors[0] ?? null;

  function addRamp() {
    const last = colors[0];
    const next = createRamp(randomRampName(colors.map((item) => item.name)), {
      hue: ((last?.hue ?? 220) + 28) % 360,
      chroma: last?.chroma ?? 0.14,
      lightnessLight: last?.lightnessLight ?? 0.97,
      lightnessDark: last?.lightnessDark ?? 0.22,
    });
    onChange([next, ...colors]);
    setRampId(next.id);
    setStopIndex(0);
  }

  function updateRamp(next: Ramp) {
    onChange(colors.map((item) => (item.id === next.id ? next : item)));
  }

  const stops = ramp ? generateStops(ramp) : [];
  const index = Math.min(stopIndex, Math.max(stops.length - 1, 0));
  const stop = stops[index] ?? null;

  return (
    <div className="foundation">
      <div className="foundation-main">
        <div className="mode-tabs">
          <Tabs
            label="Color"
            value={mode}
            tabs={[
              { id: "ramps", label: "Ramps" },
              { id: "contrast", label: "Contrast Summary" },
            ]}
            onChange={setMode}
          />
          {mode === "ramps" && colors.length > 0 ? (
            <div className="mode-bar">
              <ContrastFilter
                test={contrastTest}
                ground={contrastGround}
                customHex={contrastCustomHex}
                onTest={setContrastTest}
                onGround={setContrastGround}
                onCustomHex={setContrastCustomHex}
              />
              <button type="button" className="add" onClick={addRamp}>
                <Plus size={14} />
                New ramp
              </button>
            </div>
          ) : null}
        </div>

        {mode === "ramps" ? (
          colors.length === 0 || !ramp ? (
            <div className="blank">
              <h1>This system has no ramps</h1>
              <p>Add the first color scale. Steps run from 50, the lightest, to 950, the darkest.</p>
              <button type="button" onClick={addRamp}>
                <Plus size={14} />
                New ramp
              </button>
            </div>
          ) : (
            <>
              <p className="hint ramp-hint">
                Every ramp is built in OKLCH: the hue stays and lightness runs from the light step to the dark step.
              </p>
              <div className="ramp-list">
                {colors.map((item, at) => (
                  <RampCard
                    key={item.id}
                    ramp={item}
                    canMoveUp={at > 0}
                    canMoveDown={at < colors.length - 1}
                    selectedIndex={item.id === ramp.id ? index : null}
                    contrastTest={contrastTest}
                    contrastBackground={contrastBackground}
                    onSelectStop={(nextIndex) => {
                      setRampId(item.id);
                      setStopIndex(nextIndex);
                    }}
                    onChange={updateRamp}
                    onDuplicate={() => {
                      const copy = createRamp(`${item.name} copy`, {
                        hue: item.hue,
                        chroma: item.chroma,
                        stepNames: [...item.stepNames],
                        easeChroma: item.easeChroma,
                        lightnessLight: item.lightnessLight,
                        lightnessDark: item.lightnessDark,
                      });
                      const next = [...colors];
                      next.splice(at + 1, 0, copy);
                      onChange(next);
                      setRampId(copy.id);
                      setStopIndex(0);
                    }}
                    onDelete={() => {
                      const next = colors.filter((entry) => entry.id !== item.id);
                      onChange(next);
                      if (ramp.id === item.id) setRampId(next[0]?.id ?? null);
                    }}
                    onMove={(direction) => {
                      const to = at + direction;
                      if (to < 0 || to >= colors.length) return;
                      const next = [...colors];
                      const [moved] = next.splice(at, 1);
                      if (!moved) return;
                      next.splice(to, 0, moved);
                      onChange(next);
                    }}
                    onToast={onToast}
                  />
                ))}
              </div>
            </>
          )
        ) : null}

        {mode === "contrast" ? (
          colors.length === 0 || !ramp ? (
            <div className="blank">
              <h1>This system has no ramps</h1>
              <p>Add a color scale on Ramps before checking contrast.</p>
            </div>
          ) : (
            <div className="zone">
              <p className="eyebrow">Contrast</p>
              <p className="hint">
                Every ramp, each step on white and near-black. The sample uses that step’s color, the same as the swatches.
                Green passes the same bar. Red fails it. The marked column follows the Light/Dark preview.
              </p>
              {colors.map((item) => (
                <ContrastTable
                  key={item.id}
                  ramp={item}
                  stops={generateStops(item)}
                  preview={preview}
                  selectedIndex={item.id === ramp.id ? index : -1}
                  onSelect={(next) => {
                    setRampId(item.id);
                    setStopIndex(next);
                  }}
                />
              ))}
            </div>
          )
        ) : null}
      </div>

      <Inspector title="Token">
        {ramp && stop ? (
          <StopInspector ramp={ramp} stop={stop} onToast={onToast} />
        ) : (
          <p className="inspector-note">Select a step on the scale.</p>
        )}
      </Inspector>
    </div>
  );
}

function StopInspector({ ramp, stop, onToast }: { ramp: Ramp; stop: Stop; onToast: (message: string) => void }) {
  const token = colorTokenNames(ramp.name, stop.step);

  async function copyHex() {
    try {
      await navigator.clipboard.writeText(stop.hex);
      onToast(`${stop.hex} copied`);
    } catch {
      onToast("Could not copy the hex.");
    }
  }

  return (
    <>
      <div className="inspector-token">
        <i className="swatch lg" style={{ background: stop.hex }} />
        <div>
          <strong title="Name in Figma">{token.name}</strong>
          <p title="Name in CSS">{token.code}</p>
          <button type="button" className="hex-copy" title="Copy hex" onClick={() => void copyHex()}>
            {stop.hex}
          </button>
        </div>
      </div>
      <dl className="lch">
        <div>
          <dt>L</dt>
          <dd>{stop.l.toFixed(3)}</dd>
        </div>
        <div>
          <dt>C</dt>
          <dd>{stop.c.toFixed(3)}</dd>
        </div>
        <div>
          <dt>H</dt>
          <dd>{Math.round(stop.h)}</dd>
        </div>
      </dl>
      <div className="contrast-pair">
        <h3>WCAG</h3>
        <InspectorScore label="On white" stop={stop} ground="white" test="wcag" />
        <InspectorScore label="On black" stop={stop} ground="black" test="wcag" />
        <h3>APCA</h3>
        <InspectorScore label="On white" stop={stop} ground="white" test="apca" />
        <InspectorScore label="On black" stop={stop} ground="black" test="apca" />
      </div>
      {stop.clipped ? <p className="inspector-note">Chroma was reduced so this step fits in sRGB.</p> : null}
    </>
  );
}

function InspectorScore({
  label,
  stop,
  ground,
  test,
}: {
  label: string;
  stop: Stop;
  ground: "white" | "black";
  test: "wcag" | "apca";
}) {
  const verdict = contrastVerdict(stop.rgb, ground === "white" ? "#ffffff" : "#111111", test);
  return (
    <p>
      {label}{" "}
      <span className={verdict.passes ? "verdict pass" : "verdict fail"}>
        {verdict.score} {verdict.grade}
      </span>
    </p>
  );
}

function ContrastTable({
  ramp,
  stops,
  preview,
  selectedIndex,
  onSelect,
}: {
  ramp: Ramp;
  stops: Stop[];
  preview: "light" | "dark";
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const ink = (stop: Stop) => (stop.l > 0.68 ? "#1a1a1a" : "#f5f5f5");
  return (
    <section className="contrast-ramp">
      <h2>{ramp.name || "Color"}</h2>
      <div className="table-wrap">
        <table className="contrast-table">
          <thead>
            <tr>
              <th>Step</th>
              <th className={preview === "light" ? "is-preview" : ""}>WCAG white</th>
              <th className={preview === "dark" ? "is-preview" : ""}>WCAG black</th>
              <th className={preview === "light" ? "is-preview" : ""}>APCA white</th>
              <th className={preview === "dark" ? "is-preview" : ""}>APCA black</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((stop, index) => (
              <tr key={`${stop.step}-${index}`} className={index === selectedIndex ? "selected" : ""} onClick={() => onSelect(index)}>
                <td>
                  <span className="contrast-chip" style={{ background: stop.hex, color: ink(stop) }}>
                    {stop.step}
                  </span>
                </td>
                <td className={preview === "light" ? "is-preview" : ""}>
                  <ContrastScore stop={stop} ground="white" test="wcag" />
                </td>
                <td className={preview === "dark" ? "is-preview" : ""}>
                  <ContrastScore stop={stop} ground="black" test="wcag" />
                </td>
                <td className={preview === "light" ? "is-preview" : ""}>
                  <ContrastScore stop={stop} ground="white" test="apca" />
                </td>
                <td className={preview === "dark" ? "is-preview" : ""}>
                  <ContrastScore stop={stop} ground="black" test="apca" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ContrastScore({ stop, ground, test }: { stop: Stop; ground: "white" | "black"; test: "wcag" | "apca" }) {
  const background = ground === "white" ? "#ffffff" : "#111111";
  const verdict = contrastVerdict(stop.rgb, background, test);
  return (
    <span className="contrast-score">
      <span className="sample" style={{ background, color: stop.hex }} title={`${stop.hex} on ${ground}`}>
        Aa
      </span>
      <span className={verdict.passes ? "verdict pass" : "verdict fail"}>
        {verdict.score} {verdict.grade}
      </span>
    </span>
  );
}

function ContrastFilter({
  test,
  ground,
  customHex,
  onTest,
  onGround,
  onCustomHex,
}: {
  test: ContrastTest;
  ground: ContrastGround;
  customHex: string;
  onTest: (test: ContrastTest) => void;
  onGround: (ground: ContrastGround) => void;
  onCustomHex: (hex: string) => void;
}) {
  return (
    <div className="contrast-filter">
      <div className="contrast-field">
        <span>Contrast test</span>
        <div className="segment" role="group" aria-label="Contrast test">
          {(
            [
              ["wcag", "WCAG"],
              ["apca", "APCA"],
              ["none", "None"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={test === value ? "active" : ""}
              title={
                value === "wcag"
                  ? "WCAG 2.2 contrast ratio. 4.5 is AA for normal text."
                  : value === "apca"
                    ? "APCA Lc. About 75 is body text, 60 is large text, 45 is UI."
                    : "Hide the text samples and scores."
              }
              onClick={() => onTest(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {test === "none" ? null : (
        <div className="contrast-field">
          <span>Background</span>
          <div className="segment" role="group" aria-label="Contrast background">
            {(
              [
                ["white", "White"],
                ["black", "Black"],
                ["custom", "Other"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={ground === value ? "active" : ""}
                title={value === "black" ? "Near-black, the same background as the Contrast table." : undefined}
                onClick={() => onGround(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {test !== "none" && ground === "custom" ? (
        <label className="picker">
          <span>Background color</span>
          <input
            type="color"
            value={customHex}
            aria-label="Custom contrast background"
            onChange={(event) => onCustomHex(event.target.value)}
          />
        </label>
      ) : null}
    </div>
  );
}
