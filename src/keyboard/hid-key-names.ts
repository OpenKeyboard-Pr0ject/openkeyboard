import type { MatrixKey } from "./matrix-key";

const FIRST_LETTER_USAGE = 0x04;
const FIRST_DIGIT_USAGE = 0x1e;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "1234567890".split("");

const NAMED_USAGE_RANGES: ReadonlyArray<readonly [number, readonly string[]]> = [
  [FIRST_LETTER_USAGE, LETTERS],
  [FIRST_DIGIT_USAGE, DIGITS],
  [0x28, ["Enter", "Esc", "Backspace", "Tab", "Space", "-", "=", "[", "]", "\\", "#", ";", "'", "`", ",", ".", "/",
    "Caps Lock"]],
  [0x3a, ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Print Screen", "Scroll Lock",
    "Pause", "Insert", "Home", "Page Up", "Delete", "End", "Page Down", "Right", "Left", "Down", "Up", "Num Lock",
    "Num /", "Num *", "Num -", "Num +", "Num Enter", "Num 1", "Num 2", "Num 3", "Num 4", "Num 5", "Num 6", "Num 7",
    "Num 8", "Num 9", "Num 0", "Num .", "\\", "Menu", "Power", "Num ="]],
  [0x68, ["F13", "F14", "F15", "F16", "F17", "F18", "F19", "F20", "F21", "F22", "F23", "F24"]],
  [0xe0, ["Left Ctrl", "Left Shift", "Left Alt", "Left Win", "Right Ctrl", "Right Shift", "Right Alt", "Right Win"]],
];

const KEY_NAMES: ReadonlyMap<number, string> = new Map(
  NAMED_USAGE_RANGES.flatMap(([firstUsage, names]) => names.map((name, index) => [firstUsage + index, name] as const)),
);

export function hidUsageName(usage: number): string | undefined {
  return KEY_NAMES.get(usage);
}

export function keyLabel(key: MatrixKey): string {
  return hidUsageName(key.hidUsage) ?? `Row ${key.matrixRow}, Col ${key.matrixColumn}`;
}
