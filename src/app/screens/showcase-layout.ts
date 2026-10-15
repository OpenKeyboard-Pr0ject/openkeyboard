export interface ShowcaseKey {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ShowcaseLayout {
  readonly width: number;
  readonly height: number;
  readonly keys: readonly ShowcaseKey[];
}

type RowEntry = readonly [label: string | null, width: number];
type Row = readonly [x: number, y: number, entries: readonly RowEntry[]];

const KEY_HEIGHT = 1;
const NAVIGATION_COLUMN = 15.25;

const unitKeys = (labels: string): RowEntry[] => [...labels].map((label) => [label, 1]);
const gap = (width: number): RowEntry => [null, width];

const ROWS: readonly Row[] = [
  [0, 0, [
    ["Esc", 1], gap(1), ["F1", 1], ["F2", 1], ["F3", 1], ["F4", 1], gap(0.5),
    ["F5", 1], ["F6", 1], ["F7", 1], ["F8", 1], gap(0.5), ["F9", 1], ["F10", 1], ["F11", 1], ["F12", 1],
  ]],
  [0, 1.25, [...unitKeys("`1234567890-="), ["Backspace", 2]]],
  [0, 2.25, [["Tab", 1.5], ...unitKeys("QWERTYUIOP[]"), ["\\", 1.5]]],
  [0, 3.25, [["Caps", 1.75], ...unitKeys("ASDFGHJKL;'"), ["Enter", 2.25]]],
  [0, 4.25, [["Shift", 2.25], ...unitKeys("ZXCVBNM,./"), ["Shift", 2.75]]],
  [0, 5.25, [
    ["Ctrl", 1.25], ["Win", 1.25], ["Alt", 1.25], ["", 6.25], ["Alt", 1.25], ["Fn", 1.25], ["Menu", 1.25],
    ["Ctrl", 1.25],
  ]],
  [NAVIGATION_COLUMN, 0, [["PrtSc", 1], ["ScrLk", 1], ["Pause", 1]]],
  [NAVIGATION_COLUMN, 1.25, [["Ins", 1], ["Home", 1], ["PgUp", 1]]],
  [NAVIGATION_COLUMN, 2.25, [["Del", 1], ["End", 1], ["PgDn", 1]]],
  [NAVIGATION_COLUMN, 4.25, [gap(1), ["↑", 1]]],
  [NAVIGATION_COLUMN, 5.25, [["←", 1], ["↓", 1], ["→", 1]]],
];

export function showcaseLayout(): ShowcaseLayout {
  const keys = ROWS.flatMap(([startX, y, entries]) => {
    let x = startX;
    return entries.flatMap(([label, width]) => {
      const key = label === null ? [] : [{ label, x, y, width, height: KEY_HEIGHT }];
      x += width;
      return key;
    });
  });
  return {
    width: Math.max(...keys.map((key) => key.x + key.width)),
    height: Math.max(...keys.map((key) => key.y + key.height)),
    keys,
  };
}

const RAINBOW_DEGREES = 300;
const HUE_PER_ROW = 8;

export function showcaseHue(key: ShowcaseKey, layout: ShowcaseLayout): number {
  const center = key.x + key.width / 2;
  return Math.round((center / layout.width) * RAINBOW_DEGREES + key.y * HUE_PER_ROW) % 360;
}
