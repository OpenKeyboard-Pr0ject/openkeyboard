import { hidUsageName } from "../../keyboard/hid-key-names";
import { formatHex } from "../../shared/hex";

export type QmkKeycodeGeneration = "v5" | "v6";

interface KeycodeRange {
  readonly first: number;
  readonly last: number;
  describe(keycode: number): string;
}

const KC_NO = 0x0000;
const KC_TRANSPARENT = 0x0001;
const BASIC_KEYCODE_MASK = 0xff;
const MODS_MASK = 0x1f;
const RIGHT_HAND_MODS = 0x10;
const MOD_NAMES: ReadonlyArray<readonly [number, string]> = [[0x01, "Ctrl"], [0x02, "Shift"], [0x04, "Alt"], [0x08, "Win"]];

const MEDIA_KEY_NAMES: ReadonlyArray<readonly [number, string]> = [
  [0xa5, "Power"], [0xa6, "Sleep"], [0xa7, "Wake"], [0xa8, "Mute"], [0xa9, "Volume Up"], [0xaa, "Volume Down"],
  [0xab, "Next Track"], [0xac, "Previous Track"], [0xad, "Stop"], [0xae, "Play/Pause"], [0xaf, "Media Select"],
  [0xb0, "Eject"], [0xb1, "Mail"], [0xb2, "Calculator"], [0xb3, "My Computer"], [0xb4, "Browser Search"],
  [0xb5, "Browser Home"], [0xb6, "Browser Back"], [0xb7, "Browser Forward"], [0xb8, "Browser Stop"],
  [0xb9, "Browser Refresh"], [0xba, "Browser Favorites"], [0xbb, "Fast Forward"], [0xbc, "Rewind"],
  [0xbd, "Brightness Up"], [0xbe, "Brightness Down"],
];

const MOUSE_KEY_NAMES = ["Mouse Up", "Mouse Down", "Mouse Left", "Mouse Right", "Mouse 1", "Mouse 2", "Mouse 3",
  "Mouse 4", "Mouse 5"];

const BASIC_NAMES_BY_GENERATION: Record<QmkKeycodeGeneration, ReadonlyMap<number, string>> = {
  v5: new Map([...MEDIA_KEY_NAMES, ...MOUSE_KEY_NAMES.map((name, index) => [0xf0 + index, name] as const)]),
  v6: new Map([
    ...MEDIA_KEY_NAMES,
    [0xbf, "Control Panel"], [0xc0, "Assistant"], [0xc1, "Mission Control"], [0xc2, "Launchpad"],
    ...MOUSE_KEY_NAMES.map((name, index) => [0xcd + index, name] as const),
  ]),
};

export function qmkKeycodeLabel(keycode: number, generation: QmkKeycodeGeneration): string {
  const range = KEYCODE_RANGES[generation].find((candidate) => keycode >= candidate.first && keycode <= candidate.last);
  return range ? range.describe(keycode) : formatHex(keycode, 4);
}

function basicLabel(keycode: number, generation: QmkKeycodeGeneration): string {
  if (keycode === KC_NO) return "";
  if (keycode === KC_TRANSPARENT) return "▽";
  return hidUsageName(keycode) ?? BASIC_NAMES_BY_GENERATION[generation].get(keycode) ?? formatHex(keycode, 4);
}

function modsLabel(mods: number): string {
  const side = (mods & RIGHT_HAND_MODS) !== 0 ? "Right " : "";
  const names = MOD_NAMES.filter(([bit]) => (mods & bit) !== 0).map(([, name]) => name);
  return `${side}${names.join("+")}`;
}

function wrapped(name: string, ...argumentsList: string[]): string {
  return `${name}(${argumentsList.join(", ")})`;
}

function rangeOf(first: number, last: number, describe: (keycode: number) => string): KeycodeRange {
  return { first, last, describe };
}

function layerRange(first: number, last: number, name: string, layerMask: number): KeycodeRange {
  return rangeOf(first, last, (keycode) => wrapped(name, String(keycode & layerMask)));
}

function sharedRanges(generation: QmkKeycodeGeneration): KeycodeRange[] {
  const basic = (keycode: number) => basicLabel(keycode & BASIC_KEYCODE_MASK, generation);
  return [
    rangeOf(0x0000, 0x00ff, (keycode) => basicLabel(keycode, generation)),
    rangeOf(0x0100, 0x1fff, (keycode) => `${modsLabel((keycode >> 8) & MODS_MASK)}+${basic(keycode)}`),
    rangeOf(0x4000, 0x4fff, (keycode) => wrapped("LT", String((keycode >> 8) & 0x0f), basic(keycode))),
    rangeOf(0x5700, 0x57ff, (keycode) => wrapped("TD", String(keycode & 0xff))),
  ];
}

const KEYCODE_RANGES: Record<QmkKeycodeGeneration, readonly KeycodeRange[]> = {
  v5: [
    ...sharedRanges("v5"),
    layerRange(0x5000, 0x50ff, "TO", 0x0f),
    layerRange(0x5100, 0x51ff, "MO", 0xff),
    layerRange(0x5200, 0x52ff, "DF", 0xff),
    layerRange(0x5300, 0x53ff, "TG", 0xff),
    layerRange(0x5400, 0x54ff, "OSL", 0xff),
    rangeOf(0x5500, 0x55ff, (keycode) => wrapped("OSM", modsLabel(keycode & MODS_MASK))),
    layerRange(0x5800, 0x58ff, "TT", 0xff),
    rangeOf(0x5900, 0x59ff, (keycode) => wrapped("LM", String((keycode >> 4) & 0x0f), modsLabel(keycode & 0x0f))),
    rangeOf(0x5c00, 0x5c00, () => "Boot"),
    rangeOf(0x6000, 0x7fff, (keycode) => wrapped(
      "MT",
      modsLabel((keycode >> 8) & MODS_MASK),
      basicLabel(keycode & BASIC_KEYCODE_MASK, "v5"),
    )),
  ],
  v6: [
    ...sharedRanges("v6"),
    rangeOf(0x2000, 0x3fff, (keycode) => wrapped(
      "MT",
      modsLabel((keycode >> 8) & MODS_MASK),
      basicLabel(keycode & BASIC_KEYCODE_MASK, "v6"),
    )),
    rangeOf(0x5000, 0x51ff, (keycode) => wrapped("LM", String((keycode >> 5) & 0x0f), modsLabel(keycode & MODS_MASK))),
    layerRange(0x5200, 0x521f, "TO", 0x1f),
    layerRange(0x5220, 0x523f, "MO", 0x1f),
    layerRange(0x5240, 0x525f, "DF", 0x1f),
    layerRange(0x5260, 0x527f, "TG", 0x1f),
    layerRange(0x5280, 0x529f, "OSL", 0x1f),
    rangeOf(0x52a0, 0x52bf, (keycode) => wrapped("OSM", modsLabel(keycode & MODS_MASK))),
    layerRange(0x52c0, 0x52df, "TT", 0x1f),
    layerRange(0x52e0, 0x52ff, "PDF", 0x1f),
    rangeOf(0x7700, 0x777f, (keycode) => wrapped("M", String(keycode & 0x7f))),
    rangeOf(0x7c00, 0x7c00, () => "Boot"),
    rangeOf(0x7c01, 0x7c01, () => "Reboot"),
    rangeOf(0x7e00, 0x7e3f, (keycode) => wrapped("Custom", String(keycode & 0x3f))),
    rangeOf(0x7e40, 0x7fff, (keycode) => wrapped("User", String(keycode - 0x7e40))),
  ],
};
