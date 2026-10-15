import type { KeyColor } from "../../keyboard/lighting";
import type { LightingPreset } from "../../keyboard/lighting-effects";
import { colorFromRgb565 } from "../../protocol/wooting/wooting-rgb-codec";

const HEXADECIMAL = 16;

const WOOTILITY_PRESET_ROWS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["Rainbow", [
    "ff00 fee0 fea1 fe62 fe43 fe03 fdc4 fd85 fd65 fd26 fce7 fcc8 f46a ebec db8e d310 c2b2 ba54 a9d6 a178 911b",
    "ff00 fec1 fe81 fe42 fe23 fde4 fda4 fd85 fd46 fd07 fce7 fc88 f42b e3cd db4f caf1 c273 b215 a9b7 9939 90db",
    "fee0 fea1 fe62 fe42 fe03 fdc4 fda5 fd65 fd26 fce7 fcc8 f469 ebec db8e d330 c2b2 ba54 a9d6 a178 911a 889c",
    "fec1 fe81 fe62 fe23 fde4 fda4 fd85 fd46 fd07 fce7 fca8 f42a e3cd db4f caf1 c293 b215 a9b7 9959 90db 807d",
    "fea1 fe62 fe42 fe03 fdc4 fda5 fd65 fd26 fd07 fcc8 f469 ec0b db8e d330 c2b2 ba54 b1f6 a178 991a 88bc 803e",
    "fe81 fe62 fe23 fde4 fdc4 fd85 fd46 fd06 fce7 fca8 f42a e3cc db6f caf1 c293 b235 a9b7 9959 90db 807d 781f",
  ]],
  ["Seawave", [
    "001f 001f 001f 001f 001f 03bf 03bf 03bf 03bf 071f 071f 071f 071f 07f1 07f1 07f1 07f1 6fe0 6fe0 6fe0 6fe0",
    "001f 001f 001f 001f 001f 03bf 03bf 03bf 03bf 071f 071f 071f 071f 07f1 07f1 07f1 07f1 6fe0 6fe0 6fe0 6fe0",
    "001f 001f 001f 001f 001f 03bf 03bf 03bf 03bf 071f 071f 071f 071f 07f1 07f1 07f1 07f1 6fe0 6fe0 6fe0 6fe0",
    "001f 001f 001f 001f 001f 03bf 03bf 03bf 03bf 071f 071f 071f 071f 07f1 07f1 07f1 07f1 6fe0 6fe0 6fe0 6fe0",
    "001f 001f 001f 001f 001f 03bf 03bf 03bf 03bf 071f 071f 071f 071f 07f1 07f1 07f1 07f1 6fe0 6fe0 6fe0 6fe0",
    "001f 001f 001f 001f 001f 03bf 03bf 03bf 03bf 071f 071f 071f 071f 07f1 07f1 07f1 07f1 6fe0 6fe0 6fe0 6fe0",
  ]],
  ["Inferno", [
    "f800 f800 f800 f800 f800 fa00 fa00 fa00 fa00 fba0 fba0 fba0 fba0 fd60 fd60 fd60 fd60 ff60 ff60 ff60 ff60",
    "f800 f800 f800 f800 f800 fa00 fa00 fa00 fa00 fba0 fba0 fba0 fba0 fd60 fd60 fd60 fd60 ff60 ff60 ff60 ff60",
    "f800 f800 f800 f800 f800 fa00 fa00 fa00 fa00 fba0 fba0 fba0 fba0 fd60 fd60 fd60 fd60 ff60 ff60 ff60 ff60",
    "f800 f800 f800 f800 f800 fa00 fa00 fa00 fa00 fba0 fba0 fba0 fba0 fd60 fd60 fd60 fd60 ff60 ff60 ff60 ff60",
    "f800 f800 f800 f800 f800 fa00 fa00 fa00 fa00 fba0 fba0 fba0 fba0 fd60 fd60 fd60 fd60 ff60 ff60 ff60 ff60",
    "f800 f800 f800 f800 f800 fa00 fa00 fa00 fa00 fba0 fba0 fba0 fba0 fd60 fd60 fd60 fd60 ff60 ff60 ff60 ff60",
  ]],
  ["Miami FPS", [
    "981f 981f 981f 981f 981f 981f 981f 981f 981f 981f 981f 981f 981f 981f 981f 981f 981f ff20 ff20 ff20 981f",
    "981f f816 f816 f816 f816 f816 f816 f816 f816 f816 f816 f816 f816 981f 981f 981f 981f 981f 981f 981f 981f",
    "981f 07fe ff20 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 981f 981f 981f 981f f816 f816 f816 981f",
    "981f ff20 ff20 ff20 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 981f 981f 981f 981f f816 f816 f816 981f",
    "981f 981f 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 981f 981f ff20 ff20 f816 f816 f816 981f",
    "981f 981f 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 07fe 981f 981f 981f ff20 ff20 ff20 ff20 f816 f816 ff20",
  ]],
  ["Summer Breeze", [
    "e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 07f0",
    "fe40 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 fe40 07f0 07f0 07f0 07f0 07f0 07f0 07f0",
    "fe40 07f0 e7e0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 fe40 07f0 07f0 07f0 07f0 07f0 07f0 07f0",
    "fe40 e7e0 e7e0 e7e0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 fe40 fe40 1fe0 1fe0 07f0 07f0 07f0 1fe0",
    "fe40 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 07f0 fe40 07f0 e7e0 1fe0 07f0 07f0 07f0 07f0",
    "fe40 fe40 fe40 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 e7e0 fe40 fe40 fe40 fe40 e7e0 e7e0 e7e0 1fe0 07f0 07f0 1fe0",
  ]],
  ["Alternator", [
    "ffc0 07fd 07fd 07fd 07fd ffc0 ffc0 ffc0 ffc0 07fd 07fd 07fd 07fd 07fd ffc0 ffc0 ffc0 07fd 07fd 07fd ffc0",
    "07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd ffc0 ffc0 07fd 07fd ffc0 ffc0 ffc0 ffc0",
    "ffc0 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd ffc0",
    "ffc0 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fe ffc0 ffc0 981f 981f 07fd 07fd 07fd 981f",
    "ffc0 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fd 07fe ffc0 ffc0 07fd ff20 07fd 07fd 07fd ffc0",
    "ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 ffc0 07fd 07fd 07fd ff20 07fd 07fd ff20",
  ]],
  ["Clay", [
    "027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f f812 f812 f812 f812",
    "027f f81f f81f f81f f81f f81f f81f f81f f81f f81f f81f 027f 027f 027f f81f f81f f81f 027f 027f 027f 027f",
    "027f f812 f812 f812 f812 f812 f812 f812 f812 f812 f812 027f 027f 027f f81f f81f f81f f81f f81f f81f 027f",
    "027f f812 f812 f812 f812 f812 f812 f812 f812 f812 027f 027f 027f 027f 027f 981f 981f f81f f81f f81f 981f",
    "027f f812 f812 f812 f812 f812 f812 f812 f812 027f 027f 027f 027f 027f 027f f812 ff20 f81f f81f f81f 027f",
    "027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f 027f f812 f812 f812 ff20 f81f 027f ff20",
  ]],
  ["Lekker", [
    "fe20 f7ff f7ff f7ff f7ff 2f34 2f34 2f34 2f34 f7ff f7ff f7ff f7ff f7ff 2f34 2f34 2f34 fe20 fe20 fe20 fe20",
    "f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff 2f34 2f34 2f34 2f34 2f34 2f34 2f34 2f34",
    "2f34 f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff 2f34 2f34 2f34 f7ff f7ff f7ff 2f34",
    "2f34 f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff fe20 2f34 2f34 2f34 f7ff f7ff f7ff 2f34",
    "2f34 f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff f7ff 2f34 fe20 fe20 fe20 f7ff f7ff f7ff 2f34",
    "2f34 2f34 2f34 f7ff f7ff f7ff f7ff f7ff f7ff f7ff 2f34 2f34 2f34 2f34 fe20 fe20 fe20 f7ff f7ff f7ff 2f34",
  ]],
  ["Sunset", [
    "f817 f817 781f 001f 001f 07ff 07ef 07e0 07e0 dfe0 fe00 fe00 fe00 fe00 fbe0 fbe0 f9c0 f800 f80e f80e f80e",
    "f817 f817 781f 001f 001f 07ff 07ef 07ef 07e0 07e0 dfe0 dfe0 fe00 fe00 fbe0 fbe0 f9c0 f800 f800 f80e f80e",
    "f817 f817 781f 001f 001f 07ff 07ef 07ef 07e0 07e0 dfe0 dfe0 fe00 fe00 fe00 fbe0 f9c0 f9c0 f800 f80e f80e",
    "f817 f817 781f 001f 001f 07ff 07ef 07ef 07e0 07e0 dfe0 dfe0 dfe0 fe00 fe00 fe00 fe00 f9c0 f800 f80e f80e",
    "f817 f817 f817 781f 001f 001f 07ff 07ef 07ef 07e0 07e0 dfe0 dfe0 dfe0 dfe0 fbe0 fbe0 f9c0 f800 f80e f80e",
    "f817 f817 f817 781f 781f 001f 07ff 07ef 07ef 07e0 07e0 dfe0 dfe0 fe00 fe00 fe00 fbe0 fbe0 f9c0 f800 f800",
  ]],
];

export const WOOTING_RGB_PRESETS: readonly LightingPreset[] = WOOTILITY_PRESET_ROWS.map(([name, rows]) => ({
  name,
  keyColors: rows.flatMap((row, matrixRow) => row.split(" ").map((rgb565, matrixColumn): KeyColor => ({
    matrixRow,
    matrixColumn,
    color: colorFromRgb565(parseInt(rgb565, HEXADECIMAL)),
  }))),
}));
