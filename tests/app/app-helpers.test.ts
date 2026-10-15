import { describe, expect, it } from "vitest";
import {
  deviceSettingsChange,
  idleTimeoutOptions,
  pollingRateOptions,
} from "../../src/app/pages/device-settings/device-settings-draft";
import { keyGroupDetails, rapidTriggerDetails } from "../../src/app/format/profile-format";
import {
  navigationFor,
  RAILS,
  railOf,
  railsWithSections,
  sectionsFor,
  sectionsOfRail,
} from "../../src/app/layout/sections";
import { showcaseHue, showcaseLayout } from "../../src/app/screens/showcase-layout";
import {
  readStoredPreference,
  resolveTheme,
  storePreference,
} from "../../src/app/theme/theme-preference";
import type { KeyboardDeviceSettingsEditor } from "../../src/keyboard/device-settings";
import type { KeyboardCapabilities } from "../../src/drivers/keyboard-driver";

const razerSettingsEditor = {
  supportedPollingRatesHz: [125, 500, 1000],
  idleTimeoutRangeSeconds: { min: 60, max: 900, step: 60 },
} as unknown as KeyboardDeviceSettingsEditor;

describe("theme preference", () => {
  it("follows the system until the user chooses", () => {
    expect([resolveTheme("system", true), resolveTheme("system", false)]).toEqual(["dark", "light"]);
  });

  it("uses the chosen theme over the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("reads a stored preference and ignores anything else", () => {
    expect(readStoredPreference({ getItem: () => "dark" })).toBe("dark");
    expect(readStoredPreference({ getItem: () => "purple" })).toBe("system");
  });

  it("falls back to the system when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("Storage is disabled.");
      },
    };

    expect(readStoredPreference(blocked)).toBe("system");
  });

  it("ignores a storage that refuses to save", () => {
    const refusing = {
      setItem: () => {
        throw new Error("Quota exceeded.");
      },
    };

    expect(() => storePreference(refusing, "dark")).not.toThrow();
  });
});

describe("sectionsFor", () => {
  it("offers only the sections of capabilities the keyboard has, then the device", () => {
    const razer = { lighting: {}, deviceSettings: {} } as unknown as KeyboardCapabilities;

    expect(sectionsFor(razer).map((section) => section.id)).toEqual(["lighting", "device-settings", "device"]);
  });

  it("keeps a fixed order across keyboards", () => {
    const wooting = { analogKeys: {}, profiles: {} } as unknown as KeyboardCapabilities;

    expect(sectionsFor(wooting).map((section) => section.id)).toEqual(["profiles", "live-keys", "device"]);
  });
});

describe("navigation rails", () => {
  const razer = { lighting: {}, deviceSettings: {} } as unknown as KeyboardCapabilities;

  it("adds the interface and about pages after the keyboard sections", () => {
    expect(navigationFor(razer).map((section) => section.id)).toEqual([
      "lighting",
      "device-settings",
      "device",
      "interface",
      "about",
    ]);
  });

  it("puts each section on one rail", () => {
    const railIds = navigationFor(razer).map((section) => [section.id, railOf(section).id]);

    expect(railIds).toEqual([
      ["lighting", "keyboard"],
      ["device-settings", "keyboard"],
      ["device", "settings"],
      ["interface", "settings"],
      ["about", "help"],
    ]);
  });

  it("lists the sections of a rail in order", () => {
    const settings = RAILS.find((rail) => rail.id === "settings")!;

    expect(sectionsOfRail(navigationFor(razer), settings).map((section) => section.id)).toEqual([
      "device",
      "interface",
    ]);
  });

  it("hides the keyboard rail when the keyboard offers no configuration", () => {
    const bare = {} as KeyboardCapabilities;

    expect(railsWithSections(navigationFor(bare)).map((rail) => rail.id)).toEqual(["settings", "help"]);
  });
});

describe("keyboard showcase", () => {
  const layout = showcaseLayout();

  it("draws a tenkeyless board of 87 keys", () => {
    expect(layout.keys).toHaveLength(87);
    expect([layout.width, layout.height]).toEqual([18.25, 6.25]);
  });

  it("fills the main block rows to the same width", () => {
    const rowEnds = [1.25, 2.25, 3.25, 4.25, 5.25].map((y) => {
      const row = layout.keys.filter((key) => key.y === y && key.x < 15);
      return Math.max(...row.map((key) => key.x + key.width));
    });

    expect(rowEnds).toEqual([15, 15, 15, 15, 15]);
  });

  it("colors keys from left to right like a rainbow", () => {
    const escape = layout.keys.find((key) => key.label === "Esc")!;
    const pause = layout.keys.find((key) => key.label === "Pause")!;

    expect(showcaseHue(escape, layout)).toBeLessThan(showcaseHue(pause, layout));
  });
});

describe("device settings form", () => {
  it("offers whole minutes from 1 to 15", () => {
    const options = idleTimeoutOptions(razerSettingsEditor, 900);

    expect(options).toHaveLength(15);
    expect([options[0].label, options[14].label]).toEqual(["1 minute", "15 minutes"]);
  });

  it("keeps a current sleep timer that is not on a whole minute", () => {
    const options = idleTimeoutOptions(razerSettingsEditor, 90);

    expect(options.map((option) => option.value)).toContain("90");
  });

  it("labels polling rates in hertz", () => {
    const labels = pollingRateOptions(razerSettingsEditor).map((option) => option.label);

    expect(labels).toEqual(["125 Hz", "500 Hz", "1000 Hz"]);
  });

  it("contains only the settings that changed", () => {
    const current = { pollingRateHz: 1000, idleTimeoutSeconds: 900, battery: { levelPercent: 100, charging: true } };

    expect(deviceSettingsChange(current, 1000, 600)).toEqual({ idleTimeoutSeconds: 600 });
  });
});

describe("profile details", () => {
  it("shows continuous Rapid Trigger only while Rapid Trigger is on", () => {
    expect(rapidTriggerDetails({ enabled: false, sensitivityMillimeters: 0.3, continuous: true })).toEqual([
      { label: "Rapid Trigger", value: "Off" },
    ]);
  });

  it("groups keys by setting in natural order", () => {
    const entries = [
      { key: { hidUsage: 0x14, matrixRow: 2, matrixColumn: 1 }, label: "1.50 mm" },
      { key: { hidUsage: 0x1a, matrixRow: 2, matrixColumn: 2 }, label: "0.60 mm" },
      { key: { hidUsage: 0x08, matrixRow: 2, matrixColumn: 3 }, label: "1.50 mm" },
    ];

    expect(keyGroupDetails(entries, (entry) => entry.label)).toEqual([
      { label: "0.60 mm", value: "W" },
      { label: "1.50 mm", value: "Q, E" },
    ]);
  });
});
