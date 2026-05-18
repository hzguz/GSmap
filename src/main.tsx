import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

function safeGetStoredTheme(): string | null {
  try {
    return localStorage.getItem("gsmap-theme");
  } catch {
    return null;
  }
}

const stored = safeGetStoredTheme();
const prefersDark =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;
const initial = stored ?? (prefersDark ? "dark" : "light");
document.documentElement.setAttribute("data-theme", initial);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
