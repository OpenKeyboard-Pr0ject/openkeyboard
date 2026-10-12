import { describe, expect, it } from "vitest";
import { viaKeyboardDriver } from "../../src/drivers/via/via-keyboard-driver";
import type { KeyboardSession } from "../../src/drivers/keyboard-driver";
import { KeyboardDefinitionRequiredError, type Keymap } from "../../src/keyboard/keymap";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  FakeViaKeyboard,
  TEST_MACROPAD_DEFINITION_JSON,
  TEST_MACROPAD_DEFINITION_XZ,
  type FakeViaKeyboardOptions,
} from "../fakes/fake-via-keyboard";

const noAuthorizedDevices = async (): Promise<HIDDevice[]> => [];

function vialMacropad(options: FakeViaKeyboardOptions = {}): FakeViaKeyboard {
  return new FakeViaKeyboard({ vialProtocolVersion: 6, vialDefinition: TEST_MACROPAD_DEFINITION_XZ, ...options });
}

async function openSession(keyboard: FakeViaKeyboard): Promise<KeyboardSession> {
  return viaKeyboardDriver.open(keyboard.asHidDevice(), noAuthorizedDevices);
}

async function readKeymapOf(keyboard: FakeViaKeyboard): Promise<Keymap> {
  return (await openSession(keyboard)).keymap!.readKeymap();
}

function labelsOf(keymap: Keymap, layer: number): string[] {
  return keymap.layers[layer].flat().map((assignment) => assignment.label);
}

describe("viaKeyboardDriver.supports", () => {
  it("accepts any keyboard that exposes the VIA raw HID interface", () => {
    expect(viaKeyboardDriver.supports(new FakeViaKeyboard().asHidDevice())).toBe(true);
  });

  it("rejects a Wooting config interface", () => {
    expect(viaKeyboardDriver.supports(new FakeHidDevice().asHidDevice())).toBe(false);
  });
});

describe("VIA keyboard identity", () => {
  it("reports the VIA and Vial protocol versions", async () => {
    const identity = await (await openSession(vialMacropad())).readIdentity();

    expect(identity).toMatchObject({
      vendorName: "QMK (Vial)",
      productName: "Test Macropad",
      firmwareVersion: "VIA protocol 9, Vial protocol 6",
      hardwareVerified: false,
    });
  });

  it("reports a keyboard without Vial as plain VIA", async () => {
    const identity = await (await openSession(new FakeViaKeyboard({ viaProtocolVersion: 12 }))).readIdentity();

    expect([identity.vendorName, identity.firmwareVersion]).toEqual(["QMK (VIA)", "VIA protocol 12"]);
  });

  it("asks a plain VIA keyboard for a definition file", async () => {
    const session = await openSession(new FakeViaKeyboard());

    expect(session.definitionLoader).toBeDefined();
  });

  it("does not ask a Vial keyboard for a definition file", async () => {
    const session = await openSession(vialMacropad());

    expect(session.definitionLoader).toBeUndefined();
  });
});

describe("Reading a Vial keymap", () => {
  it("names the keyboard from its embedded definition", async () => {
    expect((await readKeymapOf(vialMacropad())).name).toBe("Test Macropad");
  });

  it("reads every layer with modern keycode names", async () => {
    const keymap = await readKeymapOf(vialMacropad());

    expect(labelsOf(keymap, 0)).toEqual(["A", "B", "C", "Space", "MO(1)", "▽"]);
  });

  it("reads keycodes that span more than one 28-byte chunk", async () => {
    const keymap = await readKeymapOf(vialMacropad());

    expect(labelsOf(keymap, 2)).toEqual(["Boot", "MT(Ctrl, A)", "LT(1, Space)", "▽", "▽", "▽"]);
  });

  it("requests the keymap in chunks of at most 28 bytes", async () => {
    const keyboard = vialMacropad();
    await readKeymapOf(keyboard);

    const bufferRequests = keyboard.sentReports.filter((report) => report[0] === 0x12);

    expect(bufferRequests.map((report) => [report[1], report[2], report[3]])).toEqual([[0, 0, 28], [0, 28, 8]]);
  });

  it("lays out the keys of the layout option the keyboard reports", async () => {
    const keymap = await readKeymapOf(vialMacropad({ layoutOptions: 1 }));

    expect(keymap.physicalKeys).toHaveLength(4);
  });

  it("falls back to the default layout when the keyboard cannot report layout options", async () => {
    const keymap = await readKeymapOf(vialMacropad({ supportsLayoutOptions: false }));

    expect(keymap.physicalKeys).toHaveLength(6);
  });
});

describe("Reading a plain VIA keymap", () => {
  it("needs the definition file before it can lay out the keys", async () => {
    const session = await openSession(new FakeViaKeyboard());

    await expect(session.keymap!.readKeymap()).rejects.toBeInstanceOf(KeyboardDefinitionRequiredError);
  });

  it("reads the keymap once the definition file is loaded", async () => {
    const session = await openSession(new FakeViaKeyboard({ viaProtocolVersion: 12 }));
    session.definitionLoader!.loadDefinition(TEST_MACROPAD_DEFINITION_JSON);

    const keymap = await session.keymap!.readKeymap();

    expect(labelsOf(keymap, 1)).toEqual(["1", "2", "3", "Volume Up", "▽", ""]);
  });

  it("names keycodes with the legacy table on old VIA firmware", async () => {
    const legacyKeyboard = new FakeViaKeyboard({ viaProtocolVersion: 9, layers: [[0x5101, 0, 0, 0, 0, 0]] });
    const session = await openSession(legacyKeyboard);
    session.definitionLoader!.loadDefinition(TEST_MACROPAD_DEFINITION_JSON);

    const keymap = await session.keymap!.readKeymap();

    expect(keymap.layers[0][0][0].label).toBe("MO(1)");
  });
});
