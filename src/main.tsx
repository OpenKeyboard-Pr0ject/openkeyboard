import "./app/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { BROWSER_BRANDING } from "./app/branding";
import { KeyboardConnection } from "./connection/keyboard-connection";

const appRoot = document.querySelector<HTMLElement>("#app");
if (!appRoot) throw new Error("The page is missing the #app container.");

const connection = new KeyboardConnection(navigator.hid);
createRoot(appRoot).render(
  <StrictMode>
    <App connection={connection} branding={BROWSER_BRANDING} />
  </StrictMode>,
);
void connection.start();
