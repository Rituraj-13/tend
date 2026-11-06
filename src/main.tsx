import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/funnel-display";
import "@fontsource-variable/funnel-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import App from "./app/App";
import { LivePage } from "./app/live/LivePage";
import "./app/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const page = path === "/live" ? <LivePage /> : <App />;

createRoot(root).render(<StrictMode>{page}</StrictMode>);
