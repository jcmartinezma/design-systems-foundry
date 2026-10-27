import type { CSSProperties, InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max"> & {
  value: number;
  min: number;
  max: number;
};

/* Range slider that exposes its progress (0 to 1) as the CSS variable --range-progress.
   The stylesheet uses it to paint the active part of the track, from the start up to the handle. */
export function RangeInput({ value, min, max, style, ...rest }: Props) {
  const span = max - min;
  const progress = span > 0 ? (value - min) / span : 0;
  return (
    <input
      {...rest}
      type="range"
      min={min}
      max={max}
      value={value}
      style={{ ...style, "--range-progress": String(Math.min(1, Math.max(0, progress))) } as CSSProperties}
    />
  );
}
