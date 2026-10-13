import { describe, expect, it } from "vitest";
import {
  initialProfileDraft,
  keysAvailableToAdd,
  keySettingsChange,
  newKeyDraft,
  parseMillimeters,
  profileSettingsChange,
  resetKeyDraft,
} from "../../src/app/pages/profiles/profile-draft";
import type { KeyboardProfile } from "../../src/keyboard/keyboard-profile";

const keyQ = { hidUsage: 0x14, matrixRow: 2, matrixColumn: 1 };
const keyW = { hidUsage: 0x1a, matrixRow: 2, matrixColumn: 2 };
const keyE = { hidUsage: 0x08, matrixRow: 2, matrixColumn: 3 };

const typingProfile: KeyboardProfile = {
  slot: 1,
  name: "Typing Profile",
  color: "#d00707",
  actuationMillimeters: 3,
  rapidTrigger: { enabled: false, sensitivityMillimeters: 0.3, continuous: false },
  keyActuations: [{ key: keyQ, actuationMillimeters: 1.5 }],
  keyRapidTriggers: [
    { key: keyQ, sensitivityMillimeters: 0.3, usesProfileSensitivity: true },
    { key: keyW, sensitivityMillimeters: 0.6, usesProfileSensitivity: false },
  ],
  layout: [keyQ, keyW, keyE],
};

describe("initialProfileDraft", () => {
  it("shows the profile values with two decimals", () => {
    const draft = initialProfileDraft(typingProfile);

    expect(draft).toMatchObject({
      actuationMillimeters: "3.00",
      rapidTriggerEnabled: false,
      sensitivityMillimeters: "0.30",
      continuous: false,
    });
  });

  it("merges per-key actuation and Rapid Trigger into one row per key", () => {
    const keys = initialProfileDraft(typingProfile).keys;

    expect(keys.map((key) => [key.key.hidUsage, key.actuationMode, key.rapidTriggerMode])).toEqual([
      [0x14, "custom", "profile-sensitivity"],
      [0x1a, "follow-profile", "custom"],
    ]);
    expect(keys[0].actuationMillimeters).toBe("1.50");
    expect(keys[1].sensitivityMillimeters).toBe("0.60");
  });
});

describe("profileSettingsChange", () => {
  it("is empty when nothing changed", () => {
    expect(profileSettingsChange(typingProfile, initialProfileDraft(typingProfile))).toEqual({});
  });

  it("contains only the fields the user changed", () => {
    const draft = { ...initialProfileDraft(typingProfile), actuationMillimeters: "2.95", rapidTriggerEnabled: true };

    expect(profileSettingsChange(typingProfile, draft)).toEqual({
      actuationMillimeters: 2.95,
      rapidTriggerEnabled: true,
    });
  });

  it("passes an empty number field on as NaN, so the editor rejects it", () => {
    const draft = { ...initialProfileDraft(typingProfile), sensitivityMillimeters: "" };

    expect(profileSettingsChange(typingProfile, draft).rapidTriggerSensitivityMillimeters).toBeNaN();
  });

  it("includes only keys whose settings changed", () => {
    const draft = initialProfileDraft(typingProfile);
    const changedQ = { ...draft.keys[0], actuationMillimeters: "1.00" };

    const change = profileSettingsChange(typingProfile, { ...draft, keys: [changedQ, draft.keys[1]] });

    expect(change).toEqual({ keys: [{ key: keyQ, actuation: { kind: "custom", millimeters: 1 } }] });
  });
});

describe("key settings rows", () => {
  it("resets a key to follow the profile", () => {
    const [q] = initialProfileDraft(typingProfile).keys;

    expect(keySettingsChange(resetKeyDraft(q))).toEqual({
      key: keyQ,
      actuation: { kind: "follow-profile" },
      rapidTrigger: { kind: "follow-profile" },
    });
  });

  it("adds a key that follows the profile and starts from the profile values", () => {
    const added = newKeyDraft(keyE, typingProfile);

    expect(keySettingsChange(added)).toBeUndefined();
    expect([added.actuationMillimeters, added.sensitivityMillimeters]).toEqual(["3.00", "0.30"]);
  });

  it("offers only keys without a row", () => {
    expect(keysAvailableToAdd(typingProfile, initialProfileDraft(typingProfile).keys)).toEqual([keyE]);
  });
});

describe("parseMillimeters", () => {
  it.each([["1.50", 1.5], ["", Number.NaN], ["1e", Number.NaN]])("reads %j as %d", (text, expected) => {
    expect(parseMillimeters(text)).toEqual(expected);
  });
});
