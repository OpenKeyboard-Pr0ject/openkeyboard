## Wooting protocol notes

Observed on a Wooting 80HE TenZ, firmware 2.14.0 and 2.14.1, Windows 11.

| Interface | Usage page | Role |
|---|---|---|
| MI_00 | `0xFF00` | Legacy vendor interface |
| MI_01 | `0x01:0x06` | Standard keyboard |
| MI_02 | `0xFF55` | **Config commands** |
| MI_03 | `0x01:0x80`, `0x0C:0x01`, mouse | System, consumer and mouse controls |
| MI_04 | `0xFF53` | **Analog key stream** |

The browser device picker is filtered to `0xFF55` and `0xFF53`, both with usage `0x01`. Chrome groups interfaces by physical device, so the keyboard appears once and both interfaces are granted together. Users who connected before live key input existed have only `0xFF55` granted. The live key panel then offers a **Grant access** button.

### Commands

**Command:** feature report ID `0x01` with the payload `D1 DA <command> <parameter bytes…>` (seven bytes in total). Report ID `0x00` is rejected by Windows. The old `D0 DA` magic is answered with status `0xFF`.

**Reply:** an input report with the payload `D1 DA <command> <status> <length u16 LE> <payload>`. A status of `0x88` means success, and `0x66` means the firmware does not support the command (seen for `0x09`, `0x0A` and `0x10` on 2.14.1). Short replies use input report ID `0x01`. Larger ones use `0x02` or `0x03`, so replies are matched by magic and command id rather than by report ID.

**Profile slot:** profile commands take the slot as their first parameter byte. For example `D1 DA 27 01` reads the settings of slot 1. Wootility reads slots 0–2 this way. Slot 3 answers with an empty payload.

| Command | Id | Reply payload |
|---|---|---|
| Firmware version | `0x01` | `major minor patch` (for example `02 0E 00` = 2.14.0) |
| Current profile index | `0x0B` | Byte 0 is the active slot, zero-based |
| Keyboard profile | `0x27` | Protobuf. Field 1 is the settings message (see below) |
| Key mapping | `0x30` | Protobuf. Repeated field 1 holds one message per matrix row. Its field 1 holds one Wooting key code per column. Only slot 0 stores a mapping on the 80HE, and the other slots answer empty |
| Actuation profile | `0x31` | Protobuf with per-key actuation, see below |
| Mapping layers | `0x29` | Protobuf, the read counterpart of write report `0x13`. Not decoded yet |
| Unknown | `0x34`, `0x42` | Read by Wootility per slot. `0x42` is the read counterpart of write report `0x20` |
| Per-key Rapid Trigger | `0x3D` | Protobuf with per-key Rapid Trigger groups, see below |
| Profile metadata | `0x37` | Protobuf: 1 = name, 2 = color message (1 red, 2 green, 3 blue), 3 = icon id |

`0x29`, `0x34`, `0x3D` and `0x42` are not in the community tables. They were found in the read traffic of Wootility Web 5.4.2. The other command ids come from the community tables in [libwootility](https://github.com/meeuw/libwootility) and the [Wooting USB config protocol gist](https://gist.github.com/PastaJ36/04b82556bde3cd49183e913c833988ec). The slot parameter was observed in the traffic of Wootility Web 5.4.1. Each command was checked against the 80HE before it was used.

**Key codes:** codes `0x01`–`0x62` are the HID usage minus 3, and `0x63`–`0x6A` are the modifiers Left Ctrl to Right Win. `0xFF` marks an empty matrix position. The remaining codes (`0xE6`, `0xF2`, `0xF4`–`0xF6`, `0xE7`) are Wooting functions such as Fn and Mode. When a slot has no mapping of its own, key names come from slot 0.

**Keyboard profile settings** (field 1 of the `0x27` reply):

| Field | Meaning | How it was confirmed |
|---|---|---|
| 1 | Global actuation point (travel value) | Wootility shows 1.00 mm |
| 3 | Rapid Trigger on (1) or off (0) | Switched off and on in Wootility while polling |
| 4 | Rapid Trigger sensitivity (travel value) | Changed from 0.4 mm to 0.2 mm in Wootility |
| 7 | Continuous Rapid Trigger **off** (1) or on (0) | Switched off and back on in Wootility. Wootility also writes 0 while Rapid Trigger itself is off |
| 2, 5, 6, 9 | Unknown (seen as 0–2) | Did not change during the experiment |

### Travel values

Two encodings appear side by side, even within one keyboard:

| Encoding | Range | Millimeters | Seen in |
|---|---|---|---|
| Precise | `0x4000` and above | (raw − `0x4000`) / `0x3FFF` × 4.0 | Slots 0 and 1 |
| Legacy 8-bit | `0x00`–`0xFF` | raw / 255 × 4.0 | Slot 2 (TenZ Ultra profile) |

| Raw | Millimeters | Wootility |
|---|---|---|
| `0x4333` | 0.200 | 0.20 mm |
| `0x4666` | 0.400 | 0.40 mm |
| `0x4686` | 0.408 | 0.40 mm |
| `0x4FD0` | 0.988 | 1.00 mm |
| `0x6FEF` | 2.996 | 3.00 mm |
| `0x6F32` | 2.950 | 2.95 mm |
| `0x6FFF` | 3.000 | 3.00 mm |
| `0x1A` (legacy) | 0.408 | |
| `0x3F` (legacy) | 0.988 | |
| `0xBF` (legacy) | 2.996 | |

The odd factory values in slot 0 (`0x4686`, `0x4FD0`, `0x6FEF`) are the legacy values `0x1A`, `0x3F` and `0xBF` converted to the precise encoding. Values written by the current Wootility are exact. The app rounds to Wootility's 0.05 mm step and shows two decimals, as Wootility does.

**Per-key actuation** (`0x31` read, `0x15` write): field 4 → field 1 is a list of `precise value << 16 | matrix position`. Field 2 → field 1 is the legacy form, `8-bit value << 8 | matrix position`. The keyboard answers with a packed list, while Wootility writes the same list unpacked. For example, Wootility wrote `22 06 08 c1 80 80 c0 05` for Q (`0x41`) at 1.50 mm (`0x5800`).

**Per-key Rapid Trigger** (`0x3D` read, `0x1D` write): repeated field 1 holds one group per shared setting.

| Group field | Meaning |
|---|---|
| 1 | Matrix positions of the keys in the group (packed when read, unpacked when written) |
| 2 | Custom sensitivity message. Its field 1 is the press sensitivity (travel value) |
| 3 | `1`: the keys use the profile's Rapid Trigger sensitivity (settings field 4) |

A listed key has Rapid Trigger on. Captured from Wootility on the Typing Profile, whose own Rapid Trigger is off: Q with the profile sensitivity and W with 0.60 mm were written as `0a 08 08 42 12 04 08 99 93 01` and `0a 04 08 41 18 01`. Keys that are not listed follow the profile. How Wootility turns Rapid Trigger off for a single key in a profile that has it on, and how split release sensitivity is stored, have not been observed yet.

### Analog key stream

The keyboard sends a 64-byte input report without a report ID whenever key travel changes. It sends about 1000 reports a second while keys move. Each report is a snapshot of every key that is currently held, written as up to 16 entries of 4 bytes and terminated by an all-zero entry:

```
byte 0  matrix position: row << 5 | column
byte 1  HID keyboard usage (0x04 = A, 0x29 = Esc, 0xE1 = Left Shift)
byte 2  travel, u16 little-endian: 0 at rest, 0xFFC1 fully pressed
byte 3
```

For example, `61 04 00 08` is A (row 3, column 1) at `0x0800`, about 3% of full travel.

This layout was confirmed against a 3-minute capture of 6,397 reports covering 25 keys. Every key peaked at exactly `0xFFC1`. Replaying the capture through the decoder reproduces the text that was typed.

### Editing settings

OpenKeyboard edits these settings of **any stored profile**, active or not, without switching profiles:

- **Profile:** the global actuation point, Rapid Trigger on/off, Rapid Trigger sensitivity, and Continuous Rapid Trigger.
- **Per key:** a key's own actuation point, and a key's own Rapid Trigger, either with the profile sensitivity or with its own.

The steps are:

1. Check every value against Wootility's limits: actuation 0.1–4.0 mm, sensitivity 0.1–2.35 mm, both in 0.05 mm steps.
2. Read the parts that change (`0x27`, `0x31`, `0x3D`) and refuse an empty slot. Change only the requested entries; unknown fields and untouched groups keep their exact bytes.
3. Write only the changed parts, in Wootility's order: `0x1D` per-key Rapid Trigger, then `0x11` settings, then `0x15` per-key actuation. Each uses `storage = slot << 1 | 1`. An empty list is sent as the header alone, as Wootility does (`D1 DA 15 03`).
4. Read every written part again and compare its meaning, because the keyboard answers with packed lists. Fail if anything did not stick, or if the active slot moved.

Per-key actuation is refused for profiles that still store the 8-bit legacy list (field 2), such as the factory TenZ Ultra profile, until Wootility has saved them once.

Verified on the 80HE:

- **Saving is immediate:** a report saved to a slot is written to flash on its own. The value survived unplugging the keyboard, and no feature command was needed.
- **Active profile:** sensitivity 0.4 → 0.5 → 0.4 mm with a test script, then 0.40 → 0.45 → 0.40 mm through the app in Chrome.
- **Inactive profile:** Wootility set the Typing Profile (slot 1) to 2.95 mm. Then the app, with TenZ Profile still active, set it back to 3.00 mm.
- **Per key:** Wootility gave Q in the Typing Profile 1.50 mm, Rapid Trigger with the profile sensitivity 0.30 mm, and W Rapid Trigger at 0.60 mm. Then the app, in Chrome, reset Q and W and set the sensitivity back to 0.40 mm.
- **Restored state:** after every round trip, all slots, `0x29`, `0x34`, `0x3D`, `0x42`, the device config and the global settings read back byte-identical to the start.

### Write protocol

Captured from Wootility Web 5.4.1 while Rapid Trigger sensitivity was changed from 0.4 mm to 0.5 mm and back, with a logging-only hook on `HIDDevice.prototype`. Writes are **output** reports. The report ID is chosen by size (1 up to 32 bytes, 2 up to 62, 3 up to 254, 4 up to 510):

```
D1 DA <report type> <storage> <length u16 LE> <protobuf payload>
```

- **Storage byte:** `00` applies a preview to the active profile without saving. For profile reports, `slot << 1 | 1` saves into that slot: `01` for slot 0, `03` for slot 1. Reports that are not tied to a profile (`0x17`, `0x21`, `0x28`) always use `01`. The feature commands of the save sequence take the slot as their parameter (`0801`, `3501`, `4801`).
- **Apply without saving:** when a value changes, Wootility previews the per-key Rapid Trigger report `0x1D` and the settings report with storage `00`. The keyboard keeps answering `0x27` with the saved value until Save.
- **Switching profiles:** when a profile is selected in Wootility, it sends feature command `D1 DA 17 <slot>` (ActivateProfile), then previews that profile's reports. OpenKeyboard does not need this, because a save can target any slot directly.
- **Save:** Save to Keyboard sends the same 27 reports and commands every time, whatever changed. Saving 0.5 mm and then 0.4 mm differed in exactly one report: the `0x11` settings report, field 4.

| Report type | Content | Read counterpart |
|---|---|---|
| `0x0E`, `0x0F` | RGB colors, two halves | |
| `0x11` | Keyboard profile settings, the same protobuf as the `0x27` reply | `0x27` |
| `0x12`, `0x18`, `0x1B`, `0x21`, `0x28` | Not identified yet | |
| `0x13` | Not decoded yet | `0x29` |
| `0x1D` | Per-key Rapid Trigger groups | `0x3D` |
| `0x20` | Not decoded yet | `0x42` |
| `0x14` | Key mapping, four parts with a part index before the length | `0x30` |
| `0x15` | Per-key actuation (the repeated values are not packed here) | `0x31` |
| `0x16` | RGB core settings | |
| `0x17` | Global settings, the same protobuf as the `0x33` reply | `0x33` |
| `0x1A` | Profile metadata | `0x37` |

The save sequence also sends the feature commands `0x08`, `0x35` and `0x48`. Which of them commits to flash is not known yet.

### Commands that are never sent

Apart from the `0x11`, `0x15` and `0x1D` reports above, commands that write, save, reset, or change the scanning mode are deliberately not implemented. That includes `0x02` (bootloader), `0x07`/`0x26` (reload), `0x08`/`0x2A`/`0x2F`/`0x35` (save), feature commands `0x15`/`0x16` (keys off/on), `0x17` (activate profile), `0x19` (soft reset), `0x2B` (reset flash), and `0x2C` (raw scanning).