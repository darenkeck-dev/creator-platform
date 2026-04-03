import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element");
}

const shell = document.getElementById("app-shell");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (shell) {
  window.requestAnimationFrame(() => {
    shell.remove();
  });
}
