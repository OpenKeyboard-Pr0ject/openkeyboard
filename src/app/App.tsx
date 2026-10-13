import type { KeyboardConnection } from "../connection/keyboard-connection";
import type { AppBranding } from "./branding";
import { useConnectionState } from "./hooks/use-connection-state";
import { AppShell } from "./layout/AppShell";
import { ConnectionScreen } from "./screens/ConnectionScreen";
import { useTheme } from "./theme/use-theme";

interface AppProps {
  readonly connection: KeyboardConnection;
  readonly branding: AppBranding;
}

export function App({ connection, branding }: AppProps) {
  const state = useConnectionState(connection);
  const theme = useTheme();
  if (state.kind === "connected") {
    const sessionKey = `${state.identity.vendorId}:${state.identity.productId}:${state.identity.productName}`;
    return <AppShell key={sessionKey} state={state} connection={connection} theme={theme} />;
  }
  return <ConnectionScreen state={state} connection={connection} theme={theme} branding={branding} />;
}
