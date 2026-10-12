# OpenKeyboard documentation

These documents collect everything learned while building OpenKeyboard: how the code is organized, how the supported keyboards talk over HID, and how that knowledge was obtained and verified.

| Document | Read it when you want to… |
|---|---|
| [architecture.md](architecture.md) | Understand the codebase, add a vendor, or change how settings are written |
| [wooting.md](wooting.md) | Look up a Wooting command, report, protobuf field or travel encoding |
| [via.md](via.md) | Work on QMK keyboards that speak VIA or Vial |
| [webhid.md](webhid.md) | Understand browser, WebHID and Windows HID behavior the code relies on |
| [reverse-engineering.md](reverse-engineering.md) | Learn a new part of a protocol safely, or repeat an experiment |
| [open-questions.md](open-questions.md) | Pick up unfinished work: unknown fields, untested paths, next features |

## Conventions

- **Verified** means the behavior was observed on real hardware: a Wooting 80HE TenZ (`0x31E3:0x1402`) on Windows 11, firmware 2.14.0 and 2.14.1, in October 2026. Every write described as verified was undone afterwards, and the keyboard read back byte-identical to its starting state.
- **Observed in Wootility** means the bytes were captured from Wootility Web 5.4.1 or 5.4.2 talking to that keyboard.
- **From source** means it was taken from published source code (QMK, Vial, kle-serial, libwootility) without hardware confirmation.
- **Hypothesis** marks anything that fits the data but has not been proven. Do not build writes on a hypothesis.
- Byte sequences are hexadecimal. Multi-byte values say whether they are little-endian (LE) or big-endian (BE).
- Matrix positions on Wooting boards are `row << 5 | column`. For example `0x41` is row 2, column 1 (Q).
