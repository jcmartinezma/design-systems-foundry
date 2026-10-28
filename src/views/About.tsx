import { useEffect, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { enablePublish } from "../features";

type Props = {
  theme: "light" | "dark";
  onTheme: (theme: "light" | "dark") => void;
};

export function AboutView(props: Props) {
  const [version, setVersion] = useState("0.2.1");

  useEffect(() => {
    if (!enablePublish) return;
    fetch("/api/health")
      .then((response) => response.json() as Promise<{ version?: string }>)
      .then((body) => {
        if (body.version) setVersion(body.version);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="doc-page">
      <div className="doc-tools">
        <ThemeToggle value={props.theme} onChange={props.onTheme} />
      </div>
      <p className="eyebrow">About</p>
      <h1>Foundry</h1>
      <p className="lede">
        {enablePublish
          ? "A local tool for building a design system — color, type, border, spacing, radius, shadow, motion, and blur — and taking it to Figma, CSS, or JSON."
          : "A tool for building a design system — color, type, border, spacing, radius, shadow, motion, and blur — and exporting it to CSS or JSON."}
      </p>
      <dl className="about-facts">
        <div>
          <dt>Version</dt>
          <dd>{version}</dd>
        </div>
        <div>
          <dt>Author</dt>
          <dd>jcmartinezma</dd>
        </div>
        <div>
          <dt>GitHub repository</dt>
          <dd>
            <a href="https://github.com/jcmartinezma/design-systems-foundry" target="_blank" rel="noopener noreferrer">
              github.com/jcmartinezma/design-systems-foundry
            </a>
          </dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>MIT License</dd>
        </div>
        <div>
          <dt>Where your data lives</dt>
          <dd>
            In this browser on your computer. Nothing is uploaded or shared by the app.
          </dd>
        </div>
        {enablePublish ? (
          <div>
            <dt>Figma token</dt>
            <dd>
              Each design system keeps its own token and file link in this browser. They are not written into the project,
              so they are not included if the project is shared or published.
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
