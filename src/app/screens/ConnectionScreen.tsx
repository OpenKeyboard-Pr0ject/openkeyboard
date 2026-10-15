import type { ConnectionState, KeyboardConnection } from "../../connection/keyboard-connection";
import type { AppBranding } from "../branding";
import { Button } from "../components/Button";
import { Callout } from "../components/feedback";
import { LogoIcon, PlugIcon, SpinnerIcon } from "../components/icons";
import { LinkCards } from "../components/LinkCards";
import { Brand } from "../layout/Brand";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";
import type { ThemeControl } from "../theme/use-theme";
import { KeyboardShowcase } from "./KeyboardShowcase";

type DisconnectedState = Exclude<ConnectionState, { kind: "connected" }>;

const STORED_ON_KEYBOARD =
  "Settings are saved on the keyboard itself, so nothing has to keep running when you are done.";
const STEP_NUMBER_CLASSES =
  "flex h-9 w-9 items-center justify-center rounded-full bg-accent text-base font-bold text-on-accent";
const CONNECT_HINT = "Plug in your keyboard, then pick it from the list that opens.";

const GETTING_STARTED_STEPS: ReadonlyArray<readonly [string, string]> = [
  ["Plug in your keyboard", "Connect it with its cable. Some models also work through their wireless receiver."],
  ["Connect it to OpenKeyboard", "Click Connect keyboard and choose it. Your choice is remembered for next time."],
  ["Change and save", "Every change is written to the keyboard and read back to confirm that it was stored."],
];

interface ConnectionScreenProps {
  readonly state: DisconnectedState;
  readonly connection: KeyboardConnection;
  readonly theme: ThemeControl;
  readonly branding: AppBranding;
}

export function ConnectionScreen({ state, connection, theme, branding }: ConnectionScreenProps) {
  return (
    <div className="min-h-full overflow-x-clip bg-backdrop">
      <header className="flex w-full items-center px-4 py-5 md:px-10">
        <Brand logoSize={40} />
      </header>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-16 px-4 pb-12 text-center">
        <section className="flex w-full flex-col items-center gap-5 pt-2 md:pt-6">
          <h1 className="m-0 text-4xl font-bold text-strong md:text-5xl">Welcome to OpenKeyboard</h1>
          <p className="m-0 max-w-3xl text-lg text-fg md:text-xl">
            {branding.tagline} {STORED_ON_KEYBOARD}
          </p>
          <ConnectionPanel state={state} connection={connection} />
        </section>
        <KeyboardShowcase />
        <LinkCards />
        <GettingStarted />
      </main>
      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-panel px-5 py-4">
          <span className="flex items-center gap-3">
            <LogoIcon size={32} />
            <span className="text-sm text-fg">{branding.footnote}</span>
          </span>
          <div className="w-full sm:w-80">
            <ThemeSwitcher control={theme} />
          </div>
        </div>
        <p className="mt-3 mb-0 text-center text-sm text-faint">OpenKeyboard is open source under AGPL-3.0.</p>
      </footer>
    </div>
  );
}

interface ConnectionPanelProps {
  readonly state: DisconnectedState;
  readonly connection: KeyboardConnection;
}

function ConnectionPanel({ state, connection }: ConnectionPanelProps) {
  const chooseKeyboard = () => void connection.requestKeyboard();
  switch (state.kind) {
    case "unsupported-browser":
      return (
        <div className="w-full max-w-xl">
          <Callout tone="negative" title="WebHID is not available">
            <p className="m-0">OpenKeyboard needs WebHID. Open this page in Chrome or Edge on a desktop computer.</p>
          </Callout>
        </div>
      );
    case "disconnected":
      return (
        <div className="flex w-full max-w-xl flex-col items-center gap-3">
          {state.notice && <Callout tone="warning" title={state.notice} />}
          <Button variant="primary" size="large" icon={<PlugIcon width={20} height={20} />} onClick={chooseKeyboard}>
            Connect keyboard
          </Button>
          <p className="m-0 text-sm text-muted">{CONNECT_HINT}</p>
        </div>
      );
    case "connecting":
      return (
        <Button
          variant="primary"
          size="large"
          disabled
          icon={<SpinnerIcon width={20} height={20} className="motion-safe:animate-spin-slow" />}
        >
          Connecting to {state.deviceName}…
        </Button>
      );
    case "failed":
      return (
        <div className="flex w-full max-w-xl flex-col items-center gap-4">
          <Callout tone="negative" title={`Could not connect to ${state.deviceName}`}>
            <p className="m-0">{state.reason}</p>
          </Callout>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" size="large" onClick={() => void connection.connectAuthorizedKeyboard()}>
              Try again
            </Button>
            <Button size="large" onClick={chooseKeyboard}>Choose another keyboard</Button>
          </div>
        </div>
      );
  }
}

function GettingStarted() {
  return (
    <section className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <h2 className="m-0 text-3xl font-bold text-strong">How to get started</h2>
        <p className="m-0 max-w-2xl text-base text-fg">
          Three steps from plugging in to a saved setting. No account and no background service.
        </p>
      </div>
      <ol className="m-0 grid w-full list-none gap-4 p-0 md:grid-cols-3">
        {GETTING_STARTED_STEPS.map(([title, text], index) => (
          <li key={title} className="flex flex-col items-start gap-3 rounded-lg bg-panel p-6 text-left">
            <span className={STEP_NUMBER_CLASSES}>
              {index + 1}
            </span>
            <p className="m-0 text-xl font-bold text-strong">{title}</p>
            <p className="m-0 text-base text-fg">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
