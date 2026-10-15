import { describe, expect, it } from "vitest";
import {
  analogSettingsChange,
  coversWholeBoard,
  effectiveActuation,
  hasAnalogChanges,
  initialAnalogDraft,
  keyRapidTriggerState,
  withActuation,
  withContinuousRapidTrigger,
  withProfileActuation,
  withRapidTriggerEnabled,
  withRapidTriggerSensitivity,
} from "../../src/app/profile-editing/analog-draft";
import type { KeyboardProfile } from "../../src/keyboard/keyboard-profile";
import type { MatrixKey } from "../../src/keyboard/matrix-key";

const Q: MatrixKey = { hidUsage: 0x14, matrixRow: 2, matrixColumn: 1 };
const W: MatrixKey = { hidUsage: 0x1a, matrixRow: 2, matrixColumn: 2 };
const E: MatrixKey = { hidUsage: 0x08, matrixRow: 2, matrixColumn: 3 };
const BOARD = [Q, W, E];

function profile(overrides: Partial<KeyboardProfile> = {}): KeyboardProfile {
  return {
    slot: 1,
    name: "Typing Profile",
    color: "#d00707",
    actuationMillimeters: 3,
    rapidTrigger: { enabled: false, sensitivityMillimeters: 0.4, continuous: true },
    keyActuations: [],
    keyRapidTriggers: [],
    layout: BOARD,
    ...overrides,
  };
}

describe("analog draft", () => {
  it("starts from the profile with no changes", () => {
    const typing = profile({ keyActuations: [{ key: Q, actuationMillimeters: 1.5 }] });
    const draft = initialAnalogDraft(typing);

    expect(effectiveActuation(draft, Q)).toBe(1.5);
    expect(effectiveActuation(draft, W)).toBe(3);
    expect(hasAnalogChanges(typing, draft)).toBe(false);
  });

  it("gives selected keys their own actuation point", () => {
    const typing = profile();

    const draft = withActuation(initialAnalogDraft(typing), [Q, W], 1.2, BOARD);

    expect(analogSettingsChange(typing, draft)).toEqual({
      keys: [
        { key: Q, actuation: { kind: "custom", millimeters: 1.2 } },
        { key: W, actuation: { kind: "custom", millimeters: 1.2 } },
      ],
    });
  });

  it("lets a key follow the profile again when it gets the profile value", () => {
    const typing = profile({ keyActuations: [{ key: Q, actuationMillimeters: 1.5 }] });

    const draft = withActuation(initialAnalogDraft(typing), [Q], 3, BOARD);

    expect(analogSettingsChange(typing, draft)).toEqual({
      keys: [{ key: Q, actuation: { kind: "follow-profile" } }],
    });
  });

  it("changes the profile value and clears key values when every key is selected", () => {
    const typing = profile({ keyActuations: [{ key: Q, actuationMillimeters: 1.5 }] });

    const draft = withActuation(initialAnalogDraft(typing), BOARD, 2, BOARD);

    expect(analogSettingsChange(typing, draft)).toEqual({
      keys: [{ key: Q, actuation: { kind: "follow-profile" } }],
      actuationMillimeters: 2,
    });
  });

  it("resets selected keys to the profile actuation point", () => {
    const typing = profile({ keyActuations: [{ key: Q, actuationMillimeters: 1.5 }] });

    const draft = withProfileActuation(initialAnalogDraft(typing), [Q]);

    expect(effectiveActuation(draft, Q)).toBe(3);
  });

  it("enables Rapid Trigger on selected keys with the profile sensitivity", () => {
    const typing = profile();

    const draft = withRapidTriggerEnabled(initialAnalogDraft(typing), [Q], true, BOARD);

    expect(keyRapidTriggerState(draft, Q)).toEqual({
      enabled: true,
      sensitivityMillimeters: 0.4,
      hasOwnSensitivity: false,
    });
    expect(analogSettingsChange(typing, draft)).toEqual({
      keys: [{ key: Q, rapidTrigger: { kind: "profile-sensitivity" } }],
    });
  });

  it("turns Rapid Trigger on for the whole profile when every key is selected", () => {
    const typing = profile();

    const draft = withRapidTriggerEnabled(initialAnalogDraft(typing), BOARD, true, BOARD);

    expect(analogSettingsChange(typing, draft)).toEqual({ rapidTriggerEnabled: true });
  });

  it("keeps the other keys on when some keys leave a profile that has Rapid Trigger on", () => {
    const tenz = profile({ rapidTrigger: { enabled: true, sensitivityMillimeters: 0.4, continuous: true } });

    const draft = withRapidTriggerEnabled(initialAnalogDraft(tenz), [Q], false, BOARD);

    expect(BOARD.map((key) => keyRapidTriggerState(draft, key).enabled)).toEqual([false, true, true]);
    expect(analogSettingsChange(tenz, draft)).toEqual({
      keys: [
        { key: W, rapidTrigger: { kind: "profile-sensitivity" } },
        { key: E, rapidTrigger: { kind: "profile-sensitivity" } },
      ],
      rapidTriggerEnabled: false,
    });
  });

  it("gives selected keys their own sensitivity", () => {
    const typing = profile({
      keyRapidTriggers: [{ key: Q, sensitivityMillimeters: 0.4, usesProfileSensitivity: true }],
    });

    const draft = withRapidTriggerSensitivity(initialAnalogDraft(typing), [Q], 0.25, BOARD);

    expect(keyRapidTriggerState(draft, Q)).toEqual({
      enabled: true,
      sensitivityMillimeters: 0.25,
      hasOwnSensitivity: true,
    });
  });

  it("shares one sensitivity when every key is selected", () => {
    const typing = profile({
      rapidTrigger: { enabled: true, sensitivityMillimeters: 0.4, continuous: true },
      keyRapidTriggers: [{ key: W, sensitivityMillimeters: 0.6, usesProfileSensitivity: false }],
    });

    const draft = withRapidTriggerSensitivity(initialAnalogDraft(typing), BOARD, 0.3, BOARD);

    expect(analogSettingsChange(typing, draft)).toEqual({
      keys: [{ key: W, rapidTrigger: { kind: "profile-sensitivity" } }],
      rapidTriggerSensitivityMillimeters: 0.3,
    });
  });

  it("changes Continuous Rapid Trigger for the profile", () => {
    const typing = profile();

    const draft = withContinuousRapidTrigger(initialAnalogDraft(typing), false);

    expect(analogSettingsChange(typing, draft)).toEqual({ continuousRapidTrigger: false });
  });

  it("knows when a selection covers the whole board", () => {
    expect(coversWholeBoard([E, Q, W], BOARD)).toBe(true);
    expect(coversWholeBoard([Q, W], BOARD)).toBe(false);
    expect(coversWholeBoard([], [])).toBe(false);
  });
});
