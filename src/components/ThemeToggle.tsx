type Props = {
  value: "light" | "dark";
  onChange: (value: "light" | "dark") => void;
};

export function ThemeToggle(props: Props) {
  return (
    <div className="segment" role="group" aria-label="Appearance">
      <button type="button" className={props.value === "light" ? "active" : ""} onClick={() => props.onChange("light")}>
        Light
      </button>
      <button type="button" className={props.value === "dark" ? "active" : ""} onClick={() => props.onChange("dark")}>
        Dark
      </button>
    </div>
  );
}
