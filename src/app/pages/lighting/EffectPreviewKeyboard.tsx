import type { AnalogKeySource } from "../../../keyboard/analog-keys";
import type { LightingFrameReader } from "../../../keyboard/lighting";
import type { LayeredEffectAnimator } from "../../../keyboard/lighting-animation";
import type { LayeredEffects } from "../../../keyboard/lighting-effects";
import { matrixKeyId, type PhysicalLayout } from "../../../keyboard/physical-layout";
import { KeyboardCanvas } from "../../components/KeyboardCanvas";
import { type EffectAnimation, useEffectAnimation } from "./use-effect-animation";

export const KEYBOARD_FRAMES_HINT = "The picture shows the lighting the keyboard is showing right now, read from it "
  + "many times a second.";
export const DRAWN_EFFECTS_HINT = "The picture draws the selected effects as closely as OpenKeyboard can. "
  + "The keyboard itself is the reference.";
export const LIVE_PREVIEW_FOR_FRAMES_HINT = "Turn on Live preview to see the keyboard's own lighting here.";
export const KEY_PRESS_EFFECTS_HINT = "Press keys on the keyboard, or hold keys in the picture, "
  + "to try the effect layers.";

interface EffectPreviewKeyboardProps {
  readonly layout: PhysicalLayout;
  readonly animator: LayeredEffectAnimator | undefined;
  readonly effects: LayeredEffects;
  readonly keyColors: ReadonlyMap<string, string>;
  readonly isRunning: boolean;
  readonly analogKeys: AnalogKeySource | undefined;
  readonly frames: LightingFrameReader | undefined;
  readonly keyboardShowsDraft: boolean;
  readonly holdsKeyboardFrames: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleKey: ((id: string) => void) | undefined;
}

export function EffectPreviewKeyboard(props: EffectPreviewKeyboardProps) {
  const { layout, keyColors, isRunning, frames, selectedIds, onToggleKey } = props;
  const animation = useEffectAnimation(props);
  const shownColors = animation.fills ?? keyColors;
  const hint = hintFor(animation, isRunning, frames !== undefined);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <KeyboardCanvas
        layout={layout}
        label="Key colors"
        selectedIds={selectedIds}
        onToggleKey={onToggleKey}
        isAnimated={animation.fills !== undefined}
        onHoldKey={isRunning && animation.respondsToKeyPresses ? animation.holdKey : undefined}
        appearanceOf={(key) => ({ fill: shownColors.get(matrixKeyId(key)) })}
      />
      {hint && <p className="m-0 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function hintFor(animation: EffectAnimation, isRunning: boolean, canReadKeyboard: boolean): string | undefined {
  if (animation.source === "key-colors") return undefined;
  if (animation.source === "keyboard") return KEYBOARD_FRAMES_HINT;
  return [
    isRunning && animation.respondsToKeyPresses ? KEY_PRESS_EFFECTS_HINT : undefined,
    DRAWN_EFFECTS_HINT,
    canReadKeyboard ? LIVE_PREVIEW_FOR_FRAMES_HINT : undefined,
  ].filter(Boolean).join(" ");
}
