# VIA and Vial protocol

Reference for QMK keyboards that speak VIA or Vial. **Status: from source, not verified on hardware.** No QMK keyboard was available. Everything below was implemented from [`quantum/via.c`](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.c) and `quantum/via.h` in QMK, [`quantum/vial.c`](https://github.com/vial-kb/vial-qmk/blob/vial/quantum/vial.c) and `quantum/vial.h` in vial-qmk, [kle-serial](https://github.com/ijprest/kle-serial), and vial-gui's layout editor. It was tested against `FakeViaKeyboard`, which follows those sources.

OpenKeyboard only reads from VIA and Vial keyboards.

## Transport

- **Interface:** raw HID on usage page `0xFF60`, usage `0x61`. Any vendor id; the driver matches on the collection alone.
- **Reports:** output and input reports are 32 bytes, without a report ID (WebHID report ID `0`).
- **VIA replies:** the firmware returns the same buffer with values filled in, so byte 0 echoes the command id. An unknown command comes back with byte 0 set to `0xFF` (`id_unhandled`).
- **Vial commands:** they start with `0xFE` (`id_vial_prefix`) followed by a subcommand. Vial replies overwrite the buffer from byte 0, so they do **not** echo the command. The channel takes the next input report as the reply.
- **Keyboards without Vial:** they answer `FE 00` with `0xFF` in byte 0, which is how Vial is detected.

## Commands used

| Request | Bytes | Reply | Notes |
|---|---|---|---|
| Protocol version | `01` | `01 hi lo` | QMK master is protocol 13 (`0x000D`). vial-qmk reports 9 |
| Layout options | `02 02` | `02 02 <u32 BE>` | Unsupported keyboards answer `FF`. OpenKeyboard then assumes 0 |
| Layer count | `11` | `11 <count>` | |
| Keymap buffer | `12 <offset u16 BE> <size ≤ 28>` | `12 <offset> <size> <keycodes>` | Keycodes are u16 BE, in layer → row → column order |
| Vial keyboard id | `FE 00` | `<Vial protocol u32 LE> <keyboard uid u64 LE>` | Byte 12 = 1 when VialRGB is supported |
| Vial definition size | `FE 01` | `<size u32 LE>` | |
| Vial definition page | `FE 02 <page u16 LE>` | 32 bytes | The last page is cut at the size |

Reading a keymap takes `layers × rows × columns × 2` bytes in chunks of at most 28 bytes. For example, a 2×3 matrix with 3 layers is 36 bytes, read as `12 00 00 1C` and `12 00 1C 08`.

## Keyboard definitions

Rows, columns and the physical layout are not in the firmware's VIA protocol.

- **Vial:** the definition is embedded. It is minified JSON compressed with Python's `lzma.compress` (vial-qmk's `util/vial_generate_definition.py`), which produces an **.xz** stream. OpenKeyboard decompresses it with xz-decompress (WebAssembly, MIT).
- **Plain VIA:** the definition lives in VIA's keyboard repository, outside the keyboard. The keymap panel asks the user for the definition file (`.json`).

The fields that matter:

```json
{
  "name": "…",
  "matrix": { "rows": 2, "cols": 3 },
  "layouts": {
    "labels": [["Bottom row", "Three keys", "Wide key"], "Split backspace"],
    "keymap": [ [ "0,0", "0,1", { "w": 2 }, "0,2" ], … ]
  }
}
```

## KLE layouts

`layouts.keymap` uses the [Keyboard Layout Editor](http://www.keyboard-layout-editor.com/) format, parsed the way kle-serial does:

- **Rows and positions:** each array is a row. A string places a key at the cursor and advances it by the key's width. An object sets properties for the next key: `x`, `y` (offsets), `w`, `h`, `a` (alignment), `d` (decal), `rx` (row start).
- **Reordering:** legends are split on `\n` and reordered by the alignment table. With the default alignment 4, legend line 0 → slot 0, line 3 → slot 8, and line 9 → slot 4.
- **Slot 0 = `row,col`:** the key's matrix position. Keys without it are not matrix keys.
- **Slot 8 = `option,choice`:** the key belongs to that choice of a layout option.
- **Slot 4 = `e`:** the key is a rotary encoder, which is skipped.
- **Decals:** they are skipped.
- **Rotation:** rotated clusters (`r`, `rx`, `ry`) are drawn without rotation. This is a known limitation.

**Layout options.** The value from `02 02` packs every option's choice. The last option sits in the lowest bits. An option with N choices uses `bit_length(N − 1)` bits, and a plain string label is a 2-choice option (1 bit). This matches vial-gui's `LayoutEditor.unpack`. For example, sizes `[2, 3, 2]` with value `0b1101` give choices `[1, 2, 1]`.

## Keycodes

Two generations exist:

- **Modern (v6):** used by VIA protocol 12 and newer, and by Vial protocol 6 and newer (QMK 0.19+).
- **Legacy (v5):** used by older firmware.

| Range (modern) | Meaning | Label |
|---|---|---|
| `0x0000` | KC_NO | empty |
| `0x0001` | KC_TRNS | `▽` |
| `0x0004`–`0x00FF` | Basic HID usage, media `0xA5`–`0xC2`, mouse `0xCD`–`0xD5` | Key name |
| `0x0100`–`0x1FFF` | Modifiers + key, mods in bits 8–12 (bit 12 = right hand) | `Shift+A`, `Right Shift+A` |
| `0x2000`–`0x3FFF` | Mod-tap | `MT(Ctrl, A)` |
| `0x4000`–`0x4FFF` | Layer-tap, layer in bits 8–11 | `LT(1, Space)` |
| `0x5000`–`0x51FF` | Layer-mod, layer in bits 5–8 | `LM(1, Ctrl)` |
| `0x5200` / `0x5220` / `0x5240` / `0x5260` / `0x5280` / `0x52C0` / `0x52E0` | TO / MO / DF / TG / OSL / TT / PDF, layer in the low 5 bits | `MO(1)` |
| `0x52A0`–`0x52BF` | One-shot mod | `OSM(Shift)` |
| `0x5700`–`0x57FF` | Tap dance | `TD(3)` |
| `0x7700`–`0x777F` | Macro | `M(0)` |
| `0x7C00`, `0x7C01` | Boot, Reboot | |
| `0x7E00`–`0x7E3F`, `0x7E40`+ | Keyboard and user custom keycodes | `Custom(1)`, `User(0)` |

The legacy table differs:

- **Layer keys:** TO `0x5010`+, MO `0x5100`, DF `0x5200`, TG `0x5300`, OSL `0x5400`, OSM `0x5500`, TT `0x5800`, LM `0x5900`.
- **Mod-tap:** `0x6000`–`0x7FFF`.
- **Boot:** `0x5C00`.
- **Mouse keys:** `0xF0`–`0xF8`.

Anything outside a named range is shown as hex.

## Never sent

- set keycode (`05`)
- keymap reset (`06`)
- custom set and save (`07`, `09`)
- EEPROM reset (`0A`)
- bootloader jump (`0B`)
- macro writes (`0F`, `10`)
- set buffer (`13`)
- encoder writes
- every Vial unlock, lock, set, and QMK settings command

## Before relying on this on hardware

1. Connect a Vial keyboard and compare the drawn layout and layer labels with Vial's own app.
2. Connect a plain VIA keyboard, load its definition from the VIA repository, and compare with usevia.app.
3. Try a keyboard with layout options, for example split backspace or ISO enter, and check that the right alternative is drawn.
4. Record the results in this file and mark the protocol as verified.
