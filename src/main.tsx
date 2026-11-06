import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/funnel-display";
import "@fontsource-variable/funnel-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import App from "./app/App";
import "./app/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
