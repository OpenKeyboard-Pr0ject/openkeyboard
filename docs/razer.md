# Razer protocol

Reference for the Razer control protocol as used by OpenKeyboard. Everything marked *verified* was observed on a **Razer BlackWidow V3 Mini** (`0x1532:0x0258`, bcdDevice `0x0200`, firmware 2.3) connected by cable, on Windows 11, on 2026-10-13. Command layouts come from [OpenRazer](https://github.com/openrazer/openrazer) (`razerchromacommon.c`, `razercommon.h`) and were then checked on the keyboard. See [README.md](README.md) for the meaning of *verified*, *from source* and *hypothesis*.

## Contents

1. [USB interfaces](#usb-interfaces)
2. [Report format](#report-format)
3. [Command table](#command-table)
4. [Lighting](#lighting)
5. [Device settings](#device-settings)
6. [HyperSpeed receiver](#hyperspeed-receiver)
7. [Commands that are never sent](#commands-that-are-never-sent)

## USB interfaces

The keyboard and its HyperSpeed receiver enumerate as separate products. Both were plugged in during the session.

| Product | PID | Interfaces |
|---|---|---|
| BlackWidow V3 Mini, cable | `0x0258` | MI_00 keyboard, MI_01 (keyboard, consumer, system control, two `0x01:0x00` collections), MI_03 consumer `0x0C:0x01`, MI_04 LampArray `0x59:0x01` and consumer |
| HyperSpeed receiver | `0x0271` | Same layout, with an extra MI_05 LampArray `0x59:0x01` |

- **Control collection:** the 90-byte feature report lives on **MI_03**, a top-level collection with usage page `0x0C` and usage `0x01` (consumer control). Verified by sending the firmware query to every collection: only MI_03 answered, every other one failed with `Incorrect function` or `The parameter is incorrect`.
- **WebHID on Windows: not available.** Chrome 155 on Windows never offers MI_03 to web pages, so the app cannot reach the keyboard from the browser there. See [Chrome on Windows](#chrome-on-windows).
- **Matching:** the MI_01 and MI_04 consumer collections have the same usage `0x0C:0x01` but no 90-byte feature report, so the driver matches on that report as well.
- **LampArray:** MI_04 is a HID LampArray (usage page `0x59`), the standard behind Windows Dynamic Lighting. OpenKeyboard does not use it.

## Report format

Every command is a **feature report without a report ID** (ID `0x00`), 90 bytes long. The keyboard answers in the same feature report, which is read back with `receiveFeatureReport`.

| Offset | Size | Field |
|---|---|---|
| 0 | 1 | Status: `00` in a request |
| 1 | 1 | Transaction id: `1F` for this keyboard |
| 2 | 2 | Remaining packets (BE), always `00 00` |
| 4 | 1 | Protocol type, always `00` |
| 5 | 1 | Data size: number of argument bytes |
| 6 | 1 | Command class |
| 7 | 1 | Command id. Reads set bit 7 (`0x80`) on the matching write id |
| 8 | 80 | Arguments |
| 88 | 1 | Checksum: XOR of bytes 2 to 87 |
| 89 | 1 | Reserved, `00` |

Reply status:

| Status | Meaning |
|---|---|
| `00` | New, not processed yet |
| `01` | Busy: read again |
| `02` | Success |
| `03` | Failure |
| `04` | No response: the receiver could not reach the keyboard |
| `05` | Not supported |

- **Polling:** the reply is not ready immediately. OpenKeyboard waits 8 ms, reads, and keeps reading while the status is `00` or `01`, or while the buffer still holds the reply to another command. It gives up after 60 reads.
- **Checksum:** every captured reply carried a correct checksum, so replies with a wrong checksum are rejected.
- **Report ID byte:** node-hid returns 91 bytes (report ID first). The channel keeps the last 90 bytes of any longer reply, so either form works.
- **Transaction id:** `1F` was tried first and worked. Other ids were not needed.

Example, firmware version:

```
request  00 1f 00 00 00 02 00 81 00 …  83 00
reply    02 1f 00 00 00 02 00 81 02 03 …  82 00     firmware 2.3
```

## Command table

| Class:Id | Name | Arguments | Status in OpenKeyboard |
|---|---|---|---|
| `00:81` | Get firmware version | reply `major minor` | **Used.** `02 03` = 2.3 |
| `00:84` | Get device mode | reply `00 00` | Read once. Never written |
| `00:85` / `00:05` | Get / set polling rate | `01` 1000 Hz, `02` 500 Hz, `08` 125 Hz | **Used, writes verified** |
| `00:86` | Get keyboard layout | reply `01 82` | Read once. `01` is US in OpenRazer. `82` not decoded |
| `00:87` | Unknown | reply `02 03 01 00` | Read once. Not decoded |
| `00:C0` | Polling rate v2 | | Status `05`, not supported |
| `07:80` | Get battery level | reply `00 <level>`, level 0–255 | **Used.** `FF` = 100 % |
| `07:82` | Get low battery threshold | reply `FF` | Read once. Not used |
| `07:83` / `07:03` | Get / set idle time | seconds, u16 BE | **Used, writes verified.** `03 84` = 900 s |
| `07:84` | Get charging status | reply `00 <charging>` | **Used.** `01` while on the cable |
| `0F:84` / `0F:04` | Get / set matrix brightness | `01 05 <brightness>` | **Used, writes verified** |
| `0F:82` / `0F:02` | Get / set matrix effect | `01 05 <effect> …` | **Used, writes verified** |
| `03:80`, `03:83` | Standard LED state and brightness | | Status `05`, not supported |

The first two arguments of every lighting command are the **storage** (`01` = saved on the keyboard, OpenRazer's `VARSTORE`) and the **LED id** (`05` = backlight).

## Lighting

**Brightness** is one byte, 0–255. OpenKeyboard shows percent: `percent = round(byte / 255 × 100)`, and writes `round(percent / 100 × 255)`. Every whole percent maps back to itself. The captured `99` is 60 %.

**Effects** (`0F:02`, read back with `0F:82`). The keyboard stores the arguments exactly as written, and `0F:82` returns them unchanged. That makes reading back a full check.

| Effect | Id | Arguments after `01 05 <id>` | Written and read back |
|---|---|---|---|
| Off | `00` | `00 00 00` | `010500000000` |
| Static | `01` | `00 00 01 RR GG BB` | `010501000001ff0000` (red) |
| Breathing | `02` | `<count> 00 <count> colors…`, count 0 = random | `01050201000100ff00`, `010502020002ff00000000ff`, `010502000000` |
| Spectrum cycling | `03` | `00 00 00` | `010503000000` |
| Wave | `04` | `<direction> 28 00` | `010504012800`, `010504022800` |
| Reactive | `05` | `00 <duration> 01 RR GG BB` | `0105050001010000ff`, `0105050003010000ff` |
| Starlight | `07` | `00 <duration> <count> colors…`, count 0 = random | `01050700020100ff00`, `010507000102ff00000000ff`, `010507000300` |

- **Wave direction:** `01` runs left to right (from Esc toward Backspace) and `02` right to left. Verified by watching the keyboard. `28` is OpenRazer's fixed wave speed.
- **Duration:** `01` short, `02` medium, `03` long. Any other value is shown as an unrecognized effect.
- **Colors:** at most two per effect.
- **Unknown effects:** any other effect id, for example a custom frame (`08`) written by Razer Synapse, is shown as "Unrecognized (Effect 0x08)" and cannot be written back.

## Device settings

- **Polling rate:** 125, 500 and 1000 Hz were written and read back.
- **Idle time:** the time before the keyboard sleeps in wireless mode. OpenRazer clamps it to 60–900 seconds. OpenKeyboard offers whole minutes, 1 to 15. 600 s was written and read back.
- **Battery:** level and charging status are read-only. On the cable the keyboard reports 100 % and charging.

## Chrome on Windows

Observed on 2026-10-14 with Chrome 155 on Windows 11, owner's keyboard on the cable:

- **Enumerated but not offered:** `chrome://device-log` lists MI_03 of both `0x0258` and `0x0271` as detected. After granting the keyboard in the chooser, `navigator.hid.getDevices()` returns MI_01 (consumer and two `0x01:0x00` collections), MI_04 (LampArray and consumer) and, for the receiver, MI_05. MI_03 is never among them, even after granting every chooser entry.
- **Not the blocklist:** Chromium's static blocklist has no Razer entry, and Chrome started with `--disable-hid-blocklist` behaved the same.
- **Not access rights:** Windows opens MI_03 for reading and writing from a normal process, and node-hid talks to it.
- **The descriptor describes no fields:** `HidP_GetCaps` on MI_03 reports one link collection (`0x0C:0x01`), a feature report length of 91 bytes, and **zero** feature value caps and button caps. MI_04's consumer collection, by comparison, reports one input button cap. Chrome on Windows builds the report list of a collection from these caps, so MI_03 appears to it as a collection without reports. Hypothesis: Chrome leaves such a device out of the chooser and `getDevices()`.

When the browser shares only the other interfaces, the driver's `explainUnusableInterface` turns this into a clear error instead of "No keyboard connected", and points to the OpenKeyboard desktop app, which reaches MI_03 natively through hidapi. Chrome on Linux and macOS parses the report descriptor itself and has not been tried.

## HyperSpeed receiver

The receiver (`0x0271`) forwards the same commands to the keyboard. With the keyboard on the cable, every command sent through the receiver answered with status `04`, so OpenKeyboard tells the user to turn the keyboard on in HyperSpeed mode or to use the cable.

- **Reads only:** the receiver is accepted by the driver and marked "Not yet verified on hardware".
- **No writes:** editing stays disabled until the wireless path is verified.

## Commands that are never sent

OpenKeyboard only sends the reads in the command table and writes `00:05`, `07:03`, `0F:02` and `0F:04`, each verified on the keyboard. It never sends:

- set device mode (`00:04`), which switches the keyboard to driver mode
- the custom frame write (`0F:03`)
- the serial number read (`00:82`), which returns personal data
- firmware update or bootloader commands
