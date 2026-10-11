## Wooting protocol notes

Observed on a Wooting 80HE TenZ, firmware 2.14.0, Windows 11.

| Interface | Usage page | Role |
|---|---|---|
| MI_00 | `0xFF00` | Legacy vendor interface |
| MI_01 | `0x01:0x06` | Standard keyboard |
| MI_02 | `0xFF55` | **Config commands** |
| MI_03 | `0x01:0x80`, `0x0C:0x01`, mouse | System, consumer and mouse controls |
| MI_04 | `0xFF53` | Analog key stream (64-byte reports, not decoded yet) |

The browser device picker is filtered to `0xFF55` usage `0x01`, so the keyboard appears only once.

**Command:** feature report ID `0x01` with the payload `D1 DA <command> <p3> <p2> <p1> <p0>`. Report ID `0x00` is rejected by Windows. The old `D0 DA` magic is answered with status `0xFF`.

**Reply:** input report ID `0x01` with the payload `D1 DA <command> <status> <length u16 LE> <payload>`. A status of `0x88` means success.

| Command | Id | Reply payload |
|---|---|---|
| Firmware version | `0x01` | `major minor patch` (e.g. `02 0E 00` = 2.14.0) |

Commands that reset the board, enter the bootloader, or disable keys are deliberately not implemented.