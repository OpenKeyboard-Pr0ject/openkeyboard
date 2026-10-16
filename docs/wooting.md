# Wooting protocol

Reference for the Wooting configuration protocol as used by OpenKeyboard. Everything here was observed on a **Wooting 80HE TenZ** (`0x31E3:0x1402`, bcdDevice `0x0250`, product string `Wooting 80HE TenZ`) on Windows 11 with firmware 2.14.0 and 2.14.1, unless marked otherwise. See [README.md](README.md) for the meaning of *verified*, *observed in Wootility* and *hypothesis*.

## Contents

1. [USB interfaces](#usb-interfaces)
2. [Commands](#commands)
3. [Command table](#command-table)
4. [Profiles and slots](#profiles-and-slots)
5. [Profile settings](#profile-settings)
6. [Travel values](#travel-values)
7. [Key mapping and key codes](#key-mapping-and-key-codes)
8. [Per-key actuation](#per-key-actuation)
9. [Per-key Rapid Trigger](#per-key-rapid-trigger)
10. [RGB lighting](#rgb-lighting)
11. [Other payloads](#other-payloads)
12. [Analog key stream](#analog-key-stream)
13. [Writing](#writing)
14. [What Wootility sends](#what-wootility-sends)
15. [Commands that are never sent](#commands-that-are-never-sent)

## USB interfaces

| Interface | Usage page : usage | Role |
|---|---|---|
| MI_00 | `0xFF00 : 0x01` | Legacy vendor interface, unused by OpenKeyboard |
| MI_01 | `0x01 : 0x06` | Standard keyboard (owned by the OS) |
| MI_02 | `0xFF55 : 0x01` | **Configuration**: feature report commands, input report replies, output report writes |
| MI_03 | `0x01 : 0x80`, `0x0C : 0x01`, mouse | System control, consumer control, mouse |
| MI_04 | `0xFF53 : 0x01` | **Analog key stream**: input reports only |

On the `0xFF55` collection, the 60HE descriptor published in libwootility declares input and output reports with IDs 1–6 (32, 62, 254, 510, 1022 and 2046 bytes) and feature report 1 (7 bytes). The 80HE behaves the same way. OpenKeyboard reads the sizes from `HIDDevice.collections` rather than hard-coding them.

**Output reports carry constant padding:** on the 80HE every output report is declared as a data item (`8 × 32`, `8 × 62`, `8 × 254` …) followed by a constant item that pads it to 2046 bytes. The keyboard reads only the data item. Choosing a report by its total size therefore picks report 1 for everything, and a 207-byte `0x0E` report sent on report 1 is cut after 32 bytes: the keyboard keeps the header and 7 colors and fills the rest of the declared length from an old buffer. `smallestOutputReportHolding` counts only items that are not constant, so `0x0E` and `0x0F` go out on report 3 (254 bytes), as Wootility sends them.

## Commands

A command is a **feature report** with ID `0x01`:

```
D1 DA <command> <p0> <p1> <p2> <p3>      (7 bytes after the report ID)
```

- The magic `D1 DA` is required. The older `D0 DA` magic is answered with status `0xFF`.
- Report ID `0x00` is rejected by Windows (`HidD_SetFeature: The parameter is incorrect`).
- For profile commands, the first parameter byte (`p0`) is the profile slot.

The reply arrives as an **input report** on the same interface:

```
D1 DA <command> <status> <payload length u16 LE> <payload>
```

| Status | Meaning |
|---|---|
| `0x88` | Success |
| `0x66` | The firmware does not support the command (`0x09`, `0x0A`, `0x10` on 2.14.x) |
| `0xFF` | Bad magic |

- **Report IDs:** short replies use input report ID 1. Larger replies use ID 2 (metadata, per-key actuation) or ID 3 (mapping). OpenKeyboard therefore matches replies by magic and command byte, never by report ID.
- **Stale bytes:** the reply buffer often carries bytes from earlier replies after the payload, so always cut at the declared length.
- **No reply to writes:** the keyboard sends no reply to output-report writes. Confirm a write by reading it back.

## Command table

Command names come from [libwootility](https://github.com/meeuw/libwootility) (`libwootility_feature.py`, last updated 2025-12), which extends the older [Wooting USB config protocol gist](https://gist.github.com/PastaJ36/04b82556bde3cd49183e913c833988ec). The status column says how far each command is understood here.

| Id | libwootility name | Status in OpenKeyboard |
|---|---|---|
| `0x00` | PING | Sent by Wootility on connect. Not used |
| `0x01` | GET_VERSION | **Used.** Payload `major minor patch`, for example `02 0E 01` = 2.14.1 |
| `0x02` | RESET_TO_BOOTLOADER | **Never sent** |
| `0x03` | GET_SERIAL | Wootility sends it with parameters `01`, `02`, `03`. Not used, because it returns personal data |
| `0x04` | GET_RGB_PROFILE_COUNT | Not used |
| `0x07` | RELOAD_PROFILE0 | **Never sent** |
| `0x08` | SAVE_RGB_PROFILE | Sent by `WootingLightingEditor` as `08 <active slot>` after the RGB previews, as Wootility does |
| `0x09`, `0x0A`, `0x10` | GET_DIGITAL_PROFILES_COUNT, GET_ANALOG_PROFILES_COUNT, GET_NUMBER_OF_KEYS | Status `0x66` (unsupported) |
| `0x0B` | GET_CURRENT_KEYBOARD_PROFILE_INDEX | **Used.** Payload `<active slot> 00` |
| `0x13` | GET_DEVICE_CONFIG | Read only. Payload `00 00 00 00 11 00 0c`, not decoded |
| `0x15`, `0x16` | KEYS_OFF, KEYS_ON | **Never sent** |
| `0x17` | ACTIVATE_PROFILE | **Never sent.** Wootility sends `17 <slot>` when a profile is selected |
| `0x19` | DO_SOFT_RESET | **Never sent** |
| `0x23`, `0x24` | GET_RGB_PROFILE_COLOR_PART1/2 | **Used.** Per-key colors, see [RGB lighting](#rgb-lighting) |
| `0x26` | RELOAD_PROFILE | **Never sent** |
| `0x27` | GET_KEYBOARD_PROFILE | **Used.** Profile settings, see [Profile settings](#profile-settings) |
| `0x28` | GET_GAMEPAD_MAPPING | Read only. Empty on every slot |
| `0x29` | GET_GAMEPAD_PROFILE | Read only. Same payload for slots 0 and 1, empty for slot 2. Write counterpart is report `0x13` |
| `0x2A`, `0x2F`, `0x35` | SAVE_KEYBOARD_PROFILE, SAVE_DKS_PROFILE, SAVE_AKC_PROFILE | **Never sent.** Wootility sends `35 <slot>` while saving |
| `0x2B` | RESET_FLASH | **Never sent** |
| `0x2C` | SET_RAW_SCANNING | **Never sent** |
| `0x30` | GET_MAPPING_PROFILE | **Used.** Key mapping, see [Key mapping and key codes](#key-mapping-and-key-codes) |
| `0x31` | GET_ACTUATION_PROFILE | **Used.** Per-key actuation |
| `0x32` | GET_RGB_PROFILE_CORE | **Used.** Brightness and effect layers, see [RGB lighting](#rgb-lighting) |
| `0x33` | GET_GLOBAL_SETTINGS | Read only. See [Other payloads](#other-payloads) |
| `0x34` | GET_AKC_PROFILE | Read only. `10 00 18 00` on slots 0 and 1, entries on slot 2 (advanced keys, hypothesis) |
| `0x36` | GET_RAPID_TRIGGER_PROFILE | Read only. Always empty on 2.14.x, even when keys have their own Rapid Trigger |
| `0x37` | GET_PROFILE_METADATA | **Used.** Name, color, icon |
| `0x39` | GET_RGB_LAYER | Read by Wootility with parameters such as `00 01`, `00 01 01`. Not used |
| `0x3B` | GET_RGB_BINS | Read by Wootility on connect. Not used |
| `0x3D` | *(not in libwootility)* | **Used.** Per-key Rapid Trigger, see [Per-key Rapid Trigger](#per-key-rapid-trigger) |
| `0x3E`, `0x43`, `0x46`, `0x47`, `0x48`, `0x51`–`0x53` | *(not in libwootility)* | Read by Wootility on connect. `0x48` also appears in the save sequence. Unknown |
| `0x42` | *(not in libwootility)* | Read only. Write counterpart is report `0x20` |
| `0x49` | *(not in libwootility)* | Wootility polls it occasionally. Read only. `08 01 10 00 18 00 20 00` on 2.14.1. Unknown |
| `0x4A` | *(not in libwootility)* | **Used.** The lighting frame the keyboard shows right now, see [Lighting frame](#lighting-frame). Wootility polls it constantly |

The feature command ids and the output report types in [Writing](#writing) are **separate namespaces**. For example, feature command `0x15` is KEYS_OFF, while output report type `0x15` writes per-key actuation.

## Profiles and slots

- **Slots:** the 80HE stores up to four profiles in slots 0–3. Wootility calls them "Onboard profiles 3/4" when three are used.
- **Active slot:** `0x0B` returns the active slot. Reading another slot never changes it.
- **Empty slot:** an empty slot answers every profile command with status `0x88` and an empty payload.

**Metadata** (`0x37`) is protobuf:

| Field | Meaning | Example |
|---|---|---|
| 1 | Name | `TenZ Profile` |
| 2 | Color message: 1 red, 2 green, 3 blue | `{255, 40, 40}` |
| 3 | Icon id | `switchy:gamer`, `woot:p:black`, `switchy:gamerUltra` |

The verified keyboard holds these profiles:

| Slot | Name | Notes |
|---|---|---|
| 0 | TenZ Profile | Active. Precise encoding with factory values converted from legacy |
| 1 | Typing Profile | Rapid Trigger off, actuation 3.00 mm |
| 2 | TenZ Ultra Profile | Legacy 8-bit encoding throughout, advanced keys present |

## Profile settings

The `0x27` reply (and the `0x11` write) is a protobuf whose field 1 is the settings message:

| Field | Meaning | How it was established |
|---|---|---|
| 1 | Global actuation point (travel value) | Matches Wootility's 1.00 mm. Changing it in Wootility and in OpenKeyboard was verified |
| 2 | Unknown, always `1` | Never changed |
| 3 | Rapid Trigger on (`1`) or off (`0`) | Toggled in Wootility while polling. Verified |
| 4 | Rapid Trigger sensitivity (travel value). Also the default sensitivity for keys that use the profile sensitivity | Changed 0.4 → 0.2 mm in Wootility. Verified |
| 5 | Unknown (`0` on slots 0 and 1, `1` on slot 2) | |
| 6 | Unknown (`2` on slots 0 and 1, absent on slot 2) | |
| 7 | Continuous Rapid Trigger **off** (`1`) or on (`0`) | Toggled in Wootility. Wootility writes `0` while Rapid Trigger itself is off. Verified |
| 9 | Unknown (`0` on slots 0 and 1, `1` on slot 2) | |

Captured payloads:

```
slot 0  0a 14 08 d0 9f 01 10 01 18 01 20 e6 8c 01 28 00 30 02 38 00 48 00
slot 1  0a 14 08 ff df 01 10 01 18 00 20 e6 8c 01 28 00 30 02 38 01 48 00
slot 2  0a 0e 08 3f 10 01 18 01 20 1a 28 01 38 00 48 01
```

Wootility's limits, read from its inputs: actuation 0.1–4.0 mm and Rapid Trigger sensitivity 0.1–2.35 mm, both in 0.05 mm steps.

## Travel values

Distances are stored in one of two encodings, sometimes mixed within one keyboard:

| Encoding | Raw range | Millimeters | Encoding millimeters |
|---|---|---|---|
| Precise | `0x4000`–`0x7FFF` | (raw − `0x4000`) / `0x3FFF` × 4.0 | `0x4000 + round(mm / 4 × 0x3FFF)` |
| Legacy 8-bit | `0x00`–`0xFF` | raw / 255 × 4.0 | Never written by OpenKeyboard |

The precise formula reproduces every value Wootility wrote:

| mm in Wootility | Raw written | Notes |
|---|---|---|
| 0.20 | `0x4333` | Verified |
| 0.30 | `0x44CD` | Verified |
| 0.40 | `0x4666` | Verified |
| 0.50 | `0x4800` | Verified |
| 0.60 | `0x4999` | Verified |
| 1.50 | `0x5800` | Verified |
| 2.95 | `0x6F32` | Verified. The earlier `round(mm × 4096)` would give `0x6F33` |
| 3.00 | `0x6FFF` | Verified. The earlier formula would give `0x7000` |

- **Factory profile values:** the factory values in slot 0 are legacy values converted to precise: `0x4686` (from `0x1A`, 0.408 mm), `0x4FD0` (`0x3F`, 0.988 mm), `0x6FEF` (`0xBF`, 2.996 mm). Wootility shows them as 0.40, 1.00 and 3.00 mm. OpenKeyboard shows the same by rounding to the 0.05 mm step.
- **When values become precise:** the first Wootility save of a value rewrites it in the precise form, as happened to slot 0's sensitivity (`0x4686` → `0x4666`).

## Key mapping and key codes

`0x30 <slot>` returns a protobuf with one repeated field 1 per matrix row. Each row message's field 1 holds 21 bytes, one Wooting key code per column. On the 80HE only slot 0 stores a mapping; slots 1 and 2 answer empty and use slot 0's. Wootility also reads `30 00 00 00 01` and `30 00 00 00 02`, which return the same data for slot 0.

| Wooting code | Meaning |
|---|---|
| `0x01`–`0x62` | HID keyboard usage + 3 (`0x01` = A, `0x26` = Esc, `0x25` = Enter, `0x4F` = Up) |
| `0x63`–`0x6A` | Left Ctrl, Left Shift, Left Alt, Left Win, Right Ctrl, Right Shift, Right Alt, Right Win |
| `0xE6` | Mode key (row 0, column 14) |
| `0xE7` | Fn key (row 5, column 12) |
| `0xF2`, `0xF4`, `0xF5`, `0xF6` | Matrix positions with no key on the ANSI 80HE (rows 4/12, 1/13, 5/9, 5/3). Hypothesis: alternative layout positions |
| `0xFF` | Empty matrix position |

The Space bar occupies three matrix positions (row 5, columns 4, 6 and 8). The analog stream reports it at column 6.

## Per-key actuation

`0x31 <slot>` reads and output report `0x15` writes the same protobuf:

| Field | Content |
|---|---|
| 4 → 1 | Precise entries: `travel << 16 \| matrix position` |
| 2 → 1 | Legacy entries: `8-bit travel << 8 \| matrix position` |

- **Packed vs unpacked:** the keyboard answers with packed lists (`22 07 0a 05 c1 80 80 c0 05`). Wootility writes unpacked repeated varints (`22 06 08 c1 80 80 c0 05`). Both decode to Q (`0x41`) at 1.50 mm (`0x5800`).
- **Empty list:** a profile without per-key actuation answers with an empty payload, and Wootility writes the header alone (`D1 DA 15 <storage>`).
- **Legacy list:** slot 2 still uses the legacy list (`12 18 0a 16 c2 34 …`). OpenKeyboard reads it but refuses to edit it.

## Per-key Rapid Trigger

`0x3D <slot>` reads and output report `0x1D` writes a protobuf whose repeated field 1 holds one **group** per shared setting:

| Group field | Content |
|---|---|
| 1 | Matrix positions of the keys in the group (packed when read, unpacked when written) |
| 2 | Custom sensitivity message: field 1 is the press sensitivity (travel value) |
| 3 | `1`: the keys use the profile sensitivity (settings field 4) |

- **Listed keys:** a key listed in a group has Rapid Trigger on. Keys that are not listed follow the profile's field 3.
- **Example:** captured on the Typing Profile, whose own Rapid Trigger is off. Q uses the profile sensitivity and W uses 0.60 mm:

```
written by Wootility   0a 08 08 42 12 04 08 99 93 01   0a 04 08 41 18 01
read back              0a 09 0a 01 42 12 04 08 99 93 01   0a 05 0a 01 41 18 01
```

- **Profile sensitivity changes too:** when Q alone was given 0.30 mm, Wootility put Q in a "profile sensitivity" group and changed the profile sensitivity (settings field 4) to 0.30 mm.
- **Not yet observed:** how Wootility turns Rapid Trigger off for a single key in a profile that has it on, and how split release sensitivity is stored.

## RGB lighting

Lighting is stored per profile. Wootility reads `32`, `23` and `24` for every slot when it connects; OpenKeyboard reads them for the active slot only. Reads verified on the 80HE (firmware 2.14.1) on 2026-10-16. The write sequence was captured from Wootility the same day, see [Writing lighting](#writing-lighting).

**Key colors** (`0x23 <slot>` rows 0-2, `0x24 <slot>` rows 3-5): a protobuf with one repeated field 1 per matrix row. Each row's field 1 holds 21 packed varints, one RGB565 color per matrix column, so the colors follow the matrix positions in [Key mapping](#key-mapping-and-key-codes).

```
0a 41 0a 3f 80 f0 03 80 f0 03 ...   row: field 1 (65 bytes), field 1 (63 bytes), 21 varints
80 f0 03 = 0xF800 = red             RGB565: red 5 bits << 11, green 6 bits << 5, blue 5 bits
```

Slots 0-2 of the user's 80HE all held the same left-to-right gradient: columns 0-4 `0xF800` (red), 5-8 `0xFA00`, 9-12 `0xFBA0`, 13-16 `0xFD60` and 17-20 `0xFF60` (yellow). The empty slot 3 was all black. This matches the red-to-yellow board Wootility shows.

**Core** (`0x32 <slot>`):

| Field | Slot 0 (TenZ) | Slot 1 (Typing) | Slot 2 (TenZ Ultra) | Meaning |
|---|---|---|---|---|
| 1.1 | `179` | `255` | `112` | Brightness out of 255. Wootility showed 100 % for Typing Profile |
| 1.2, 1.3 | `0xFFFF` | `0xFFFF` | `0xFFFF` | Unknown |
| 4 | empty | `0a 08 0a 06 08 00 10 10 18 00` | absent | Effects: a base effect and up to three Fx layers, see [Effects](#effects). Typing Profile runs Wave |

OpenKeyboard shows brightness as field 1.1 / 255 in whole percent, the key colors on the keyboard drawing, and the decoded effects.

### Effects

Captured from Wootility Web 5.4.2 on 2026-10-16 by changing one thing at a time in preview and logging the `0x16` report each change sent (experiments 16 and 17 in [reverse-engineering.md](reverse-engineering.md#wooting-rgb)).

Core field 4 holds repeated field 1 messages, one per layer. Each layer holds exactly one field, and **the field number is the effect**. A layer whose effect is a base effect comes first; Fx layers follow in the order shown in Wootility. **Static is no layer at all**: Static without Fx layers is `22 00` (or field 4 absent, as after a preset), Static with an RT display layer is `22 07 0a 05 5a 03 08 8c 01`. Wootility allows at most three Fx layers and writes every known field, zeros included.

```
22 0f                     field 4, 15 bytes
   0a 06 22 04 08 00 10 30      layer: field 4 = Cycle {1: look 0, 2: speed 48}
   0a 05 5a 03 08 8c 01         layer: field 11 = RT display {1: base brightness 140}
```

| Field | Effect | Role | Fields inside (Wootility default) | Ranges and display |
|---|---|---|---|---|
| 1 | Wave | Base | 1 look (0), 2 speed (16), 3 direction (0) | Look 0 Rainbow, 1 Ocean, 2 Inferno, 3 Spring, 4 Pink!, 5 Blue Spectrum. Speed 4–60, shown as raw × 0.25 s. Direction 0 Right, 1 Left |
| 4 | Cycle | Base | 1 look (0), 2 speed (48) | Looks as Wave. Speed 4–80, raw × 0.25 s |
| 14 | Noise | Base | 1 primary color (`0x181F`), 2 secondary color (`0x07E1`), 3 speed (50), 4 scale (25) | Colors in RGB565. Speed 0–255, shown as raw / 255 in %. Scale 0–100 % |
| 15 | Spiral | Base | 1 primary (`0xF81F`), 2 secondary (`0x07FF`), 3 spin (100), 4 spiral (139) | 3 and 4 are zigzag-signed (sint32): the magnitude 0–127 is the speed, shown as / 127 in %, and a negative value means clockwise. 100 = 50 counter-clockwise, 139 = 70 clockwise |
| 2 | Scan | Fx | 1 width (1), 2 speed (15), 3 base brightness (30), 4 direction (0) | Width 1–7 keys, speed 1–50 keys/s, brightness 0–255 shown as / 255 in %. Direction 0 Horizontal, 3 Vertical |
| 3 | Breath | Fx | 1 speed (15), 3 secondary brightness (0) | Speed 1–40, raw × 0.25 s. Field 2 never appeared |
| 5 | Ripple | Fx | 1 flags (0), 2 spread speed (20), 3 fade speed (30), 4 base brightness (30) | Flags bit 0 Random Colors, bit 2 Inverted. Spread 1–50 keys/s. Fade 1–253, raw × 0.015 s |
| 6 | Trail | Fx | 1 base brightness (30), 2 speed (4), 3 mode (0), 4 custom color (`0xFFFF`) | Mode bits 0–1: 0 Base Layer, 1 Random Colors, 2 Single Color (shows field 4); bit 2: Inverted fade. Speed 1–40, raw × 0.25 s |
| 7 | Touch | Fx | 1 base brightness (30), 2 analog curve (0), 3 (0), 4 (0), 5 (1) | Fields 3–5 have no control in Wootility and are kept as stored |
| 8 | Jelly | Fx | 1 base brightness (30), 2 analog curve (0) | |
| 9 | AOE | Fx | 1 base brightness (30), 2 analog curve (0) | |
| 10 | Mixing | Fx | 1 analog curve (0) | |
| 11 | RT display | Fx | 1 base brightness (140) | |

- **Presets are key colors:** Wootility's nine presets (Rainbow, Seawave, Inferno, Miami FPS, Summer Breeze, Alternator, Clay, Lekker, Sunset) preview `0x0E` and `0x0F` with fixed 6 × 21 color grids and a core without field 4, so they also set the base effect to Static and remove every Fx layer. The grids are in `wooting-rgb-presets.ts`.
- **Fn Layer 1** has its own key colors in Wootility, but selecting it sends nothing and saving sends no extra RGB report. Where those colors live is open.
- **Base effects cover key colors:** Wootility warns about a non-Static base effect. With a Static base, Fx layers draw over the key colors.

- **Drawing effects in the UI:** when the keyboard does not show the draft (unsaved changes with live preview off), or the [lighting frame](#lighting-frame) cannot be read, `wooting-effect-animation.ts` draws every effect from the parameters above. This is an approximation. Speeds marked "raw × 0.25 s" are the period of one cycle (Wave, Cycle, Breath) or the fade time (Trail). The look palettes are estimates by eye. Wave fits one cycle of its look across the board. Noise is value noise between the two colors, and Scale sets the blob size. Spiral turns two arms around the board center. Base brightness is the share of light left on keys that no effect lights. Jelly, AOE and Mixing were not studied on the keyboard: Jelly lights a soft area around a held key that wobbles and shrinks after release, AOE lights a hard-edged area while the key is held, and Mixing turns the held key toward the inverse of its color. Comparing them with the keyboard is open.

`wooting-rgb-effects-codec.ts` decodes field 4 into a base effect and Fx layers, and writes them back by editing the stored layer when its effect is unchanged, so fields without a control keep their values. A new layer starts from Wootility's default bytes. Its tests rebuild every captured preview byte for byte.

### Writing lighting

Captured from Wootility Web 5.4.2 while it lowered Typing Profile's brightness from 255 to 230 (90 %) and saved. Typing Profile was the active profile (slot 1).

1. **Preview while editing:** releasing the brightness slider sent one output report `D1 DA 16 00 <length> <core>`, storage `00`. Moving the slider with the arrow keys sent nothing and did not enable Save.
2. **Save to Keyboard:** the 26-message save started with the RGB part:

```
output r1  D1 DA 16 00 19 00  0a0b08e60110ffff0318ffff03220a0a080a06080010101800   core, storage 00
output r3  D1 DA 0E 00 C9 00  <201 bytes, the 0x23 reply unchanged>              rows 0-2, storage 00
output r3  D1 DA 0F 00 C9 00  <201 bytes, the 0x24 reply unchanged>              rows 3-5, storage 00
feature    D1 DA 08 01                                                           SAVE_RGB_PROFILE, slot 1
```

- **Same layout as the reads:** the `0x16`, `0x0E` and `0x0F` payloads are byte-identical to the `0x32`, `0x23` and `0x24` replies except for the changed value. Rows are packed varints, as in the reads.
- **Preview, then save:** unlike profile settings, which are written with storage `slot << 1 | 1`, RGB is previewed with storage `00` on the active profile and committed with feature `08 <slot>`. RGB can therefore only be saved for the active profile.
- **Nothing else changed:** reading all 43 known structures before and after the save showed one difference, `0x32` slot 1 field 1.1 `ff` → `e6`.

- **Save replies:** feature `08 <slot>` answers with status `0x88` and an empty payload, like the read commands.
- **Effects cover key colors:** on Typing Profile, whose `0x32` field 4 is not empty, the owner set F (row 3, column 4) to white through OpenKeyboard. `0x24` read back `0xFFFF` at that position, but the keyboard kept showing the Wave effect. Field 4 holds the effects, see [Effects](#effects). OpenKeyboard sets `effectHidesKeyColors` and warns on RGB Settings when the base effect is not Static.
- **Damaged rows came from cut reports, not from reading during a preview:** after experiment 13, `0x23` and `0x24` returned rows whose row 0 kept 7 colors and then held the tail of the `0x37` metadata reply (`80 0c "woot:p:black" 00`), still 21 values long. This was first blamed on reading during a preview. Experiment 18 produced the same damage with correct bytes, and a replug showed it was stored: the rows had been sent on report 1 and cut after 32 bytes (see [USB interfaces](#usb-interfaces)). OpenKeyboard still reads every part once before writing, as Wootility does.

`WootingLightingEditor` reads `0x32`, `0x23` and `0x24` once, before any write, and refuses rows that are not 3 rows of 21 colors. It then sends the same four messages as Wootility, changing only brightness (field 1.1), the effects (field 4) and the colors of the keys that changed, and reads all three parts back to compare them by meaning. Its tests replay the captured bytes exactly and model the garbled reads. See [reverse-engineering.md](reverse-engineering.md#wooting-rgb) for what happened on hardware.

### Lighting frame

Read command `0x4A` (no parameters) answers with the colors the LEDs show at that moment, effects and key presses included. Wootility polls it many times a second to draw its keyboard, which is why its picture matches the keys exactly. Found on 2026-10-16 with a read-only probe while Typing Profile ran Rainbow Wave.

- **Layout:** 224 bytes on the 80HE, read as little-endian `u16` RGB565 colors. The first 102 are 6 matrix rows of 17 columns (the 80HE's matrix columns 0–16), row by row. Positions without a key repeat a neighbor's color.
- **Trailing values:** the last 10 colors were all `0xD020` in every frame. Unknown, not used.
- **Speed:** a read takes about 2.4 ms. Three frames 0.3 s apart showed the wave's hue moving 26°, which is a 4 s cycle, matching Speed 16 × 0.25 s.
- **Rainbow Wave:** going right, the hue falls from left to right (magenta, blue, cyan, green, yellow, red) and covers about one cycle over the 17 columns.

RGB Settings reads the frame about 30 times a second (`WootingLightingFrameReader`) while the keyboard shows the draft: with no unsaved changes, or with live preview on. Reads pause while the page is hidden and while saving or discarding.

### Live preview

Wootility shows every change on the keyboard before it is saved: releasing a slider or picking an option sends only the changed part with storage `00`, and nothing else. OpenKeyboard does the same through `KeyboardLightingEditor.beginPreview()`:

1. **Read first:** the preview reads the active slot, `0x32`, `0x23` and `0x24` once, before its first report.
2. **Show:** each change sends the parts whose bytes differ from what the keyboard shows now, as `0x16`, `0x0E` or `0x0F` with storage `00`. No `08`.
3. **Save:** sends all three parts and `08 <slot>`, as Wootility's save does, then reads back and compares by meaning. It refuses if the active profile changed.
4. **Discard:** sends the bytes read in step 1 and `08 <slot>`. This rewrites the profile with what it already held, the same way the Wootility sessions were ended (experiments 16 and 17).

While a preview is pending, `WootingRgbPreviewState` keeps the bytes from step 1, and the reader and the editor use them for the previewed slot instead of reading the keyboard. This was meant to avoid garbled reads during a preview; experiment 18 showed the garbling was stored damage from cut reports, but keeping the saved bytes is still right, because they are what Save and Discard build on. Leaving RGB Settings discards the preview; closing the tab asks the browser to confirm, because a pending preview cannot be ended once the page is gone.

## Other payloads

| Read | Payload | Interpretation |
|---|---|---|
| `0x33` global settings | `0a 06 08 05 10 0a 18 01 10 00` | Hypothesis from libwootility's `rgb_power_off` notes: field 1.1 = RGB dim after 5 minutes, 1.2 = off after 10 minutes |
| `0x13` device config | `00 00 00 00 11 00 0c` | Not decoded. Not protobuf |
| `0x29` | `0a 1c 0a 04 08 00 10 14 0a 04 08 3c 10 3c …` | Gamepad profile by libwootility's name. Not decoded |
| `0x42` | `08 01 18 01 20 7f` (slot 0), `08 01 18 01 20 ff 01` (slot 2) | Not decoded |

From the write side (libwootility and captured saves):

- **RGB color rows** (`0x0E`, `0x0F`): RGB565 colors (`(r & 0xF8) << 8 | (g & 0xFC) << 3 | b >> 3`) packed as varints, three rows of 21 keys per report. `80 f0 03` is `0xF800`, pure red, the TenZ profile color.
- **RGB core** (`0x16`): field 1.1 looks like brightness (`230` on TenZ Profile, `255` on Typing Profile when captured), followed by `0xFFFF` values. It matches the `0x32` read layout, see [RGB lighting](#rgb-lighting).

## Analog key stream

The `0xFF53` interface sends a 64-byte input report without a report ID whenever any key's travel changes. Nothing is sent while the keyboard is idle. Each report is a snapshot of every key currently held: up to 16 entries of 4 bytes, ended by an all-zero entry.

```
byte 0     matrix position: row << 5 | column
byte 1     HID keyboard usage (0x04 = A, 0x29 = Esc, 0xE1 = Left Shift)
bytes 2–3  travel, u16 LE: 0 at rest, 0xFFC1 fully pressed
```

`61 04 00 08` is A (row 3, column 1) at `0x0800`, about 3% of full travel.

The layout was confirmed on a 77-second capture of 6,397 distinct reports covering 25 keys:

- **Rate:** the median was 274 distinct reports per second while keys moved, with a peak of 822.
- **Simultaneous keys:** at most 4 keys were held at once.
- **Full travel:** every key peaked at exactly `0xFFC1`.
- **Replay:** replaying the capture through the decoder reproduced the text typed during it, including a Vietnamese Telex sentence.

## Writing

Writes are **output reports** on the `0xFF55` interface. The report ID is the smallest declared output report that holds the data, zero-padded to its size.

```
D1 DA <report type> <storage> <payload length u16 LE> <protobuf payload>
D1 DA <report type> <storage>                          (empty payload)
```

**Storage byte:**

| Value | Meaning |
|---|---|
| `00` | Preview: applied to the active profile, not saved. `0x27` keeps returning the saved value |
| `slot << 1 \| 1` | Save into that slot: `01` slot 0, `03` slot 1, `05` slot 2, `07` slot 3 |
| `01` | Used by reports that are not tied to a profile (`0x17`, `0x21`, `0x28`), whatever slot is being saved |

- **No commit command:** a profile report saved with storage `slot << 1 | 1` is written to flash immediately. Verified: the value survived unplugging the keyboard, and no feature command was sent.
- **Inactive slots:** saving to a slot that is not active works and leaves the active slot unchanged. Verified on slot 1 while slot 0 was active.

Report types:

| Type | Content | Read with | OpenKeyboard |
|---|---|---|---|
| `0x07` | Unknown, sent with storage `00` (`D1 DA 07 00 00 00 00 00 00 00 0C`) | | Never |
| `0x0E`, `0x0F` | RGB color rows, upper and lower half | `0x23`, `0x24` (same layout) | **Writes, verified**, storage `00` |
| `0x11` | Profile settings | `0x27` | **Writes, verified** |
| `0x12` | Unknown, empty on every capture | | Never |
| `0x13` | Same protobuf as the `0x29` reply | `0x29` | Never |
| `0x14` | Key mapping in four parts: `14 <storage> <part u16 LE> <length u16 LE> …`. Parts 2 and 3 are empty | `0x30` | Never |
| `0x15` | Per-key actuation | `0x31` | **Writes, verified** |
| `0x16` | RGB core | `0x32` (same layout) | **Writes, verified**, storage `00` |
| `0x17` | Global settings, same protobuf as the `0x33` reply | `0x33` | Never |
| `0x18` | Unknown, header only without a storage byte | | Never |
| `0x1A` | Profile metadata, same protobuf as the `0x37` reply | `0x37` | Never |
| `0x1B` | Unknown, four 510-byte parts. The byte after the type differs per slot (`00 21 40 60` for slot 0, `02 23 42 62` for slot 1) | | Never |
| `0x1D` | Per-key Rapid Trigger groups | `0x3D` | **Writes, verified** |
| `0x20` | Same protobuf as the `0x42` reply | `0x42` | Never |
| `0x21`, `0x28` | Unknown, always storage `01` | | Never |

## What Wootility sends

These sequences were captured from Wootility Web with a logging-only hook. See [reverse-engineering.md](reverse-engineering.md).

**Connecting.** Reads in this order: `00`, `03 02`, `13`, `01`, `3B`, `03 01`, `03 03`, `3E`, `48 00–02`, `51`, `0B`, `53`, `52`, `43`, `47`, `33`. Then, for each slot 0–2: `32`, `23`, `24`, `39 …`, `42`, `46`, `27`, `36`, `3D`, `29`, `28`, `30`, `31`, `34`, `37`. Then `4A` polling.

**Selecting a profile.** Sends feature `17 <slot>` (ActivateProfile), then previews that profile with storage `00`: `20`, `0E`, `0F`, `13`, `15`, `18`, `1A`, `1D`, `16`, `12`, `11`.

**Changing a value.** Previews the per-key Rapid Trigger report `0x1D` and the settings report `0x11` with storage `00`.

**Save to Keyboard.** Sends the same 27 messages every time, whatever changed. For slot 0:

```
 1  0x16 00     RGB core (preview)          15  0x14 01  mapping part 1
 2  0x0E 00     RGB rows, upper             16  0x14 01  mapping part 2 (empty)
 3  0x0F 00     RGB rows, lower             17  0x14 01  mapping part 3 (empty)
 4  feature 08  save RGB profile            18  0x15 01  per-key actuation
 5–8 0x1B ×4    unknown                     19  0x18     unknown
 9  0x20 01                                 20  feature 35
10  0x1D 01     per-key Rapid Trigger       21  0x1A 01  metadata
11  0x11 01     profile settings            22  feature 48
12  0x13 01                                 23  0x1A 00  metadata (preview)
13  0x12 01     (empty)                     24  0x07 00
14  0x14 01     mapping part 0              25  0x28 01, 26 0x21 01, 27 0x17 01
```

- **Saving another slot:** the profile reports use storage `03`, and the feature commands carry the slot (`08 01`, `35 01`, `48 01`).
- **RGB is saved differently:** the RGB reports are sent as previews and then saved with feature `08`. This is a hypothesis: RGB is committed by SAVE_RGB_PROFILE rather than by the storage byte.
- **Two saves compared:** saving 0.5 mm and then 0.4 mm produced identical sequences except for report 11.

**Onboarding.** Wootility Web's first-run wizard, with the existing settings kept, sent only `0x07 00`, `0x28 01`, `0x21 01` and `0x17 01`, all with unchanged values.

## Commands that are never sent

OpenKeyboard only sends the read commands marked **Used** above. It writes output reports `0x11`, `0x15` and `0x1D`, and the RGB reports `0x16`, `0x0E`, `0x0F` with feature `0x08`, each verified on hardware. It never sends these feature commands:

- bootloader (`0x02`)
- reload (`0x07`, `0x26`)
- save (`0x2A`, `0x2F`, `0x35`)
- keys off/on (`0x15`, `0x16`)
- activate profile (`0x17`)
- soft reset (`0x19`)
- reset flash (`0x2B`)
- raw scanning (`0x2C`)
- serial (`0x03`)
