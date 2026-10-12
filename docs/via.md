## VIA and Vial protocol notes

Implemented from [`quantum/via.c`](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.c) in QMK and [`quantum/vial.c`](https://github.com/vial-kb/vial-qmk/blob/vial/quantum/vial.c) in vial-qmk.

- **Transport:** raw HID on usage page `0xFF60`, usage `0x61`. Output and input reports are 32 bytes, without a report ID.
- **VIA replies** echo the command id in byte 0. An unknown command comes back as `0xFF`.
- **Vial commands** start with `0xFE`. Their replies do not echo the command id.

| Request | Bytes | Reply |
|---|---|---|
| Protocol version | `01` | `01 hi lo` |
| Layout options | `02 02` | `02 02 <u32 BE>` |
| Layer count | `11` | `11 <count>` |
| Keymap buffer | `12 <offset u16 BE> <size ≤ 28>` | `12 <offset> <size> <keycodes, u16 BE>` |
| Vial keyboard id | `FE 00` | `<Vial protocol u32 LE> <keyboard uid u64 LE>` |
| Vial definition size | `FE 01` | `<size u32 LE>` |
| Vial definition page | `FE 02 <page u16 LE>` | 32 bytes of the definition |

The Vial definition is minified JSON compressed with Python's `lzma.compress`, so it is an `.xz` stream. OpenKeyboard decompresses it with [xz-decompress](https://github.com/httptoolkit/xz-decompress). A keyboard with plain VIA does not carry its layout. The keymap panel then asks for the VIA definition file (`.json`).

**Layout:** `layouts.keymap` uses the [KLE](http://www.keyboard-layout-editor.com/) format. With the default alignment, label slot 0 holds `row,col`, slot 8 holds `option,choice` for layout options, and slot 4 holds `e` for encoders. Labels are reordered exactly as [kle-serial](https://github.com/ijprest/kle-serial) does. Layout options are unpacked as vial-gui does: the last option sits in the lowest bits, and an option with N choices uses `bit_length(N − 1)` bits. Rotated key clusters are drawn without rotation.

**Keycodes:** VIA protocol 12 and newer, and Vial protocol 6 and newer, use the QMK keycode ranges introduced in QMK 0.19. Older firmware uses the previous ranges. Both tables are implemented, and codes outside the named ranges are shown as hex.

**Never sent:** set keycode (`05`), keymap reset (`06`), set buffer (`13`), custom save (`09`), EEPROM reset (`0A`), bootloader jump (`0B`), and the Vial unlock and set commands.
