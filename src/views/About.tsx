import { useEffect, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

type Props = {
  theme: "light" | "dark";
  onTheme: (theme: "light" | "dark") => void;
};

export function AboutView(props: Props) {
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json() as Promise<{ version?: string }>)
      .then((body) => {
        if (body.version) setVersion(body.version);
      })
      .catch(() => setVersion("0.1.0"));
  }, []);

  return (
    <div className="doc-page">
      <div className="doc-tools">
        <ThemeToggle value={props.theme} onChange={props.onTheme} />
      </div>
      <p className="eyebrow">About</p>
      <h1>DS Foundry</h1>
      <p className="lede">
        A local tool for building a design system — color, type, border, spacing, radius, shadow, motion, and blur — and taking it
        to Figma, CSS, or JSON.
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
          <dt>Where it runs</dt>
          <dd>On this computer. The project stays in the local .data folder and is not sent anywhere by the app.</dd>
        </div>
        <div>
          <dt>Figma token</dt>
          <dd>
            Each design system keeps its own token and file link in this browser. They are not written into the project,
            so they are not included if the project is shared or published.
          </dd>
        </div>
      </dl>
    </div>
  );
}
