import { useEffect, useState } from "react";
import type { ConnectionState, KeyboardConnection } from "../../connection/keyboard-connection";

export function useConnectionState(connection: KeyboardConnection): ConnectionState {
  const [state, setState] = useState<ConnectionState>({ kind: "disconnected" });
  useEffect(() => {
    const unsubscribe = connection.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, [connection]);
  return state;
}
