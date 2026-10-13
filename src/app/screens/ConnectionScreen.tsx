import type { ReactNode } from "react";
import type { ConnectionState, KeyboardConnection } from "../../connection/keyboard-connection";
import { Button } from "../components/Button";
import { StatusDot, type Tone } from "../components/feedback";
import { PlugIcon } from "../components/icons";
import { Brand } from "../layout/Brand";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";
import type { ThemeControl } from "../theme/use-theme";
import type { AppBranding } from "../branding";

type DisconnectedState = Exclude<ConnectionState, { kind: "connected" }>;

interface ConnectionScreenProps {
  readonly state: DisconnectedState;
  readonly connection: KeyboardConnection;
  readonly theme: ThemeControl;
  readonly branding: AppBranding;
}

interface StateContent {
  readonly tone: Tone;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly actions: ReactNode;
}

export function ConnectionScreen({ state, connection, theme, branding }: ConnectionScreenProps) {
  const content = contentFor(state, connection);
  return (
    <div className="flex min-h-full flex-col items-center gap-10 px-4 py-10">
      <div className="flex w-full max-w-xl items-center justify-between gap-4">
        <Brand />
        <div className="w-60">
          <ThemeSwitcher control={theme} />
        </div>
      </div>
      <main className="flex w-full max-w-xl flex-1 flex-col justify-center gap-6">
        <p className="m-0 text-center text-sm text-muted">{branding.tagline}</p>
        <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <StatusDot tone={content.tone} />
            <h1 className="m-0 text-lg font-semibold text-fg">{content.title}</h1>
          </div>
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3 mb-0 text-sm text-muted">{paragraph}</p>
          ))}
          <div className="mt-6 flex flex-wrap gap-2 empty:hidden">{content.actions}</div>
        </section>
      </main>
      <footer className="text-center text-xs text-muted">{branding.footnote}</footer>
    </div>
  );
}

function contentFor(state: DisconnectedState, connection: KeyboardConnection): StateContent {
  const connectButton = (
    <Button
      variant="primary"
      icon={<PlugIcon width={16} height={16} />}
      onClick={() => void connection.requestKeyboard()}
    >
      Connect keyboard
    </Button>
  );
  switch (state.kind) {
    case "unsupported-browser":
      return {
        tone: "negative",
        title: "WebHID is not available",
        paragraphs: ["OpenKeyboard needs WebHID. Open this page in Chrome or Edge on a desktop computer."],
        actions: null,
      };
    case "disconnected": {
      const hint = "Plug in your keyboard, then choose it from the browser's device list.";
      return {
        tone: "neutral",
        title: "No keyboard connected",
        paragraphs: state.notice ? [state.notice, hint] : [hint],
        actions: connectButton,
      };
    }
    case "connecting":
      return { tone: "warning", title: `Connecting to ${state.deviceName}…`, paragraphs: [], actions: null };
    case "failed":
      return {
        tone: "negative",
        title: `Could not connect to ${state.deviceName}`,
        paragraphs: [state.reason],
        actions: (
          <>
            <Button variant="primary" onClick={() => void connection.connectAuthorizedKeyboard()}>Try again</Button>
            <Button onClick={() => void connection.requestKeyboard()}>Choose another keyboard</Button>
          </>
        ),
      };
  }
}
