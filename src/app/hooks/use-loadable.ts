import { useCallback, useEffect, useRef, useState } from "react";

export type LoadState<Value> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: Value; readonly notice?: string }
  | { readonly status: "failed"; readonly error: unknown };

export interface Loadable<Value> {
  readonly state: LoadState<Value>;
  reload(): void;
  show(value: Value, notice?: string): void;
}

export function useLoadable<Value>(load: () => Promise<Value>): Loadable<Value> {
  const [state, setState] = useState<LoadState<Value>>({ status: "loading" });
  const latestRequest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    setState({ status: "loading" });
    loadRef.current().then(
      (value) => {
        if (request === latestRequest.current) setState({ status: "ready", value });
      },
      (error: unknown) => {
        if (request === latestRequest.current) setState({ status: "failed", error });
      },
    );
  }, []);

  const show = useCallback((value: Value, notice?: string) => {
    latestRequest.current += 1;
    setState({ status: "ready", value, notice });
  }, []);

  useEffect(() => {
    reload();
    return () => {
      latestRequest.current += 1;
    };
  }, [reload]);

  return { state, reload, show };
}
