import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@jcmartinezma/jcbrand/fonts.css";
import "@jcmartinezma/jcbrand/dist/css/tokens.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
