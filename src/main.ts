import "./styles.css";
import { KeyboardConnection } from "./connection/keyboard-connection";
import { mountConnectionView } from "./ui/connection-view";

const appRoot = document.querySelector<HTMLElement>("#app");
if (!appRoot) throw new Error("The page is missing the #app container.");

const connection = new KeyboardConnection(navigator.hid);
mountConnectionView(appRoot, connection);
void connection.start();
