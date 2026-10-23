import { Inspector } from "../components/Inspector";

export function PlaceholderView({ title, text }: { title: string; text: string }) {
  return (
    <div className="foundation">
      <div className="foundation-main">
        <section className="zone">
          <p className="eyebrow">Parameters</p>
          <h2>{title}</h2>
          <p className="hint">{text}</p>
        </section>
        <section className="zone">
          <p className="eyebrow">Scale</p>
          <p className="hint">Nothing generated yet.</p>
        </section>
      </div>
      <Inspector title="Token">
        <p className="inspector-note">When this foundation has steps, the one you select will show its values here.</p>
      </Inspector>
    </div>
  );
}
