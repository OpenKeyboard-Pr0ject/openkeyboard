import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardLightingEditor,
  LightingChange,
  LightingPreview,
  LightingState,
} from "../../../keyboard/lighting";
import { describeError } from "../../../shared/describe-error";
import { LatestValueSender } from "../../hooks/latest-value-sender";

export interface LivePreviewControls {
  readonly supported: boolean;
  readonly pending: boolean;
  readonly error: string | undefined;
  save(change: LightingChange): Promise<LightingState>;
  discard(): Promise<void>;
}

export function useLivePreview(
  editor: KeyboardLightingEditor,
  change: LightingChange,
  enabled: boolean,
): LivePreviewControls {
  const supported = editor.beginPreview !== undefined;
  const sessionRef = useRef<Promise<LightingPreview> | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const changeKey = JSON.stringify(change);

  const openSession = useCallback((): Promise<LightingPreview> => {
    if (!sessionRef.current) {
      const session = editor.beginPreview!();
      sessionRef.current = session;
      session.catch(() => {
        if (sessionRef.current === session) sessionRef.current = undefined;
      });
    }
    return sessionRef.current;
  }, [editor]);

  const sender = useMemo(() => new LatestValueSender<LightingChange>(
    async (next) => {
      const session = await openSession();
      await session.show(next);
      setError(undefined);
      if (!isEmptyChange(next)) setPending(true);
    },
    (failure) => setError(`Could not show the preview: ${describeError(failure)}`),
  ), [openSession]);

  const discard = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = undefined;
    setPending(false);
    await sender.settled();
    if (session) await (await session).discard();
  }, [sender]);

  const save = useCallback(async (saved: LightingChange) => {
    await sender.settled();
    const session = sessionRef.current;
    if (!session) return editor.updateLighting(saved);
    const state = await (await session).save(saved);
    sessionRef.current = undefined;
    setPending(false);
    return state;
  }, [editor, sender]);

  useEffect(() => {
    if (!supported) return;
    if (!enabled) {
      if (sessionRef.current) {
        discard().catch((failure) => setError(`Could not end the preview: ${describeError(failure)}`));
      }
      return;
    }
    const next = JSON.parse(changeKey) as LightingChange;
    if (!sessionRef.current && isEmptyChange(next)) return;
    sender.submit(next);
  }, [supported, enabled, changeKey, sender, discard]);

  useEffect(() => () => {
    if (sessionRef.current) discard().catch(() => undefined);
  }, [discard]);

  useEffect(() => {
    if (!pending) return undefined;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [pending]);

  return { supported, pending, error, save, discard };
}

function isEmptyChange(change: LightingChange): boolean {
  return Object.keys(change).length === 0;
}
