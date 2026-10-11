import type { ConnectionState, KeyboardConnection } from "../connection/keyboard-connection";
import type { KeyboardIdentity } from "../drivers/keyboard-driver";
import { formatHex } from "../shared/hex";
import { actionButton, element } from "./dom";

type StatusTone = "idle" | "busy" | "online" | "error";

interface StatusCardContent {
  readonly tone: StatusTone;
  readonly title: string;
  readonly body: readonly Node[];
  readonly actions: readonly HTMLButtonElement[];
}

export function mountConnectionView(root: HTMLElement, connection: KeyboardConnection): void {
  connection.subscribe((state) => root.replaceChildren(statusCard(cardContentFor(state, connection))));
}

function cardContentFor(state: ConnectionState, connection: KeyboardConnection): StatusCardContent {
  switch (state.kind) {
    case "unsupported-browser":
      return unsupportedBrowserContent();
    case "disconnected":
      return disconnectedContent(connection, state.notice);
    case "connecting":
      return { tone: "busy", title: `Connecting to ${state.deviceName}…`, body: [], actions: [] };
    case "connected":
      return connectedContent(connection, state.identity);
    case "failed":
      return failedContent(connection, state.deviceName, state.reason);
  }
}

function unsupportedBrowserContent(): StatusCardContent {
  return {
    tone: "error",
    title: "WebHID is not available",
    body: [paragraph("OpenKeyboard needs WebHID. Open this page in Chrome or Edge on a desktop computer.")],
    actions: [],
  };
}

function disconnectedContent(connection: KeyboardConnection, notice?: string): StatusCardContent {
  const hint = "Plug in your keyboard, then choose it from the browser's device list.";
  return {
    tone: "idle",
    title: "No keyboard connected",
    body: notice ? [paragraph(notice), paragraph(hint)] : [paragraph(hint)],
    actions: [actionButton("Connect keyboard", "primary", () => void connection.requestKeyboard())],
  };
}

function connectedContent(connection: KeyboardConnection, identity: KeyboardIdentity): StatusCardContent {
  return {
    tone: "online",
    title: identity.productName,
    body: [identityDetails(identity)],
    actions: [
      actionButton("Disconnect", "secondary", () => void connection.disconnect()),
      actionButton("Forget device", "secondary", () => void connection.forget()),
    ],
  };
}

function failedContent(connection: KeyboardConnection, deviceName: string, reason: string): StatusCardContent {
  return {
    tone: "error",
    title: `Could not connect to ${deviceName}`,
    body: [paragraph(reason)],
    actions: [
      actionButton("Try again", "primary", () => void connection.connectAuthorizedKeyboard()),
      actionButton("Choose another keyboard", "secondary", () => void connection.requestKeyboard()),
    ],
  };
}

function identityDetails(identity: KeyboardIdentity): HTMLDListElement {
  const support = identity.hardwareVerified ? "Verified on hardware" : "Not yet verified on hardware";
  return element("dl", "details", [
    ...detailRow("Vendor", identity.vendorName),
    ...detailRow("Firmware", identity.firmwareVersion),
    ...detailRow("Vendor ID", formatHex(identity.vendorId, 4)),
    ...detailRow("Product ID", formatHex(identity.productId, 4)),
    ...detailRow("Support", support),
  ]);
}

function detailRow(label: string, value: string): HTMLElement[] {
  return [element("dt", "details__label", [label]), element("dd", "details__value", [value])];
}

function statusCard(content: StatusCardContent): HTMLElement {
  const heading = element("div", "status-card__heading", [
    element("span", `status-dot status-dot--${content.tone}`),
    element("h2", "status-card__title", [content.title]),
  ]);
  const actions = element("div", "status-card__actions", content.actions);
  return element("section", "status-card", [heading, ...content.body, actions]);
}

function paragraph(text: string): HTMLParagraphElement {
  return element("p", "status-card__text", [text]);
}
