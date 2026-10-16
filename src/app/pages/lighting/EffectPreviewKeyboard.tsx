import type { AnalogKeySource } from "../../../keyboard/analog-keys";
import type { LayeredEffectAnimator } from "../../../keyboard/lighting-animation";
import type { LayeredEffects } from "../../../keyboard/lighting-effects";
import { matrixKeyId, type PhysicalLayout } from "../../../keyboard/physical-layout";
import { KeyboardCanvas } from "../../components/KeyboardCanvas";
import { useEffectAnimation } from "./use-effect-animation";

export const EFFECT_PREVIEW_HINT = "The picture shows the selected effects as closely as OpenKeyboard can draw them. "
  + "The keyboard itself is the reference.";
export const KEY_PRESS_EFFECTS_HINT = "Press keys on the keyboard, or hold keys in the picture, to try the effect layers.";

interface EffectPreviewKeyboardProps {
  readonly layout: PhysicalLayout;
  readonly animator: LayeredEffectAnimator | undefined;
  readonly effects: LayeredEffects;
  readonly keyColors: ReadonlyMap<string, string>;
  readonly isRunning: boolean;
  readonly analogKeys: AnalogKeySource | undefined;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleKey: ((id: string) => void) | undefined;
}

export function EffectPreviewKeyboard(
  { layout, animator, effects, keyColors, isRunning, analogKeys, selectedIds, onToggleKey }: EffectPreviewKeyboardProps,
) {
  const animation = useEffectAnimation({ animator, layout, effects, keyColors, isRunning, analogKeys });
  const shownColors = animation.fills ?? keyColors;
  const isAnimated = animation.fills !== undefined;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <KeyboardCanvas
        layout={layout}
        label="Key colors"
        selectedIds={selectedIds}
        onToggleKey={onToggleKey}
        isAnimated={isAnimated}
        onHoldKey={isRunning && animation.respondsToKeyPresses ? animation.holdKey : undefined}
        appearanceOf={(key) => ({ fill: shownColors.get(matrixKeyId(key)) })}
      />
      {isAnimated && (
        <p className="m-0 text-xs text-muted">
          {isRunning && animation.respondsToKeyPresses ? `${KEY_PRESS_EFFECTS_HINT} ` : ""}
          {EFFECT_PREVIEW_HINT}
        </p>
      )}
    </div>
  );
}
