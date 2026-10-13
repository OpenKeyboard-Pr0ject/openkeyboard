# OpenKeyboard

Browser-based control panel for gaming keyboards. It talks to the keyboard over WebHID, so it needs Chrome or Edge on desktop. No vendor app or driver install is required.

## Status

OpenKeyboard detects a supported keyboard, connects to it, and reads its identity and firmware version.

| Keyboard family | What OpenKeyboard does | Hardware status |
|---|---|---|
| Wooting (config interface `0xFF55`) | Shows every stored profile: name, color, actuation point, Rapid Trigger (on/off, sensitivity, continuous), per-key actuation and per-key Rapid Trigger. Shows live analog key input. **Edits** all of these settings in any stored profile without switching profiles | Verified on a Wooting 80HE TenZ (`0x31E3:0x1402`), firmware 2.14.0 and 2.14.1, Windows 11. Editing is enabled only on that model |
| Razer BlackWidow V3 Mini (control collection `0x0C:0x01`, 90-byte feature report) | Shows and **edits** brightness and the lighting effect (static, spectrum cycling, breathing, wave, reactive, starlight, off), polling rate and sleep timer. Shows battery level and charging | Protocol verified on the wired keyboard (`0x1532:0x0258`), firmware 2.3, Windows 11, through node-hid. **Chrome on Windows does not offer its control interface to web pages**, so in the browser the app explains this and points to the OpenKeyboard desktop app, which reaches it natively. The HyperSpeed receiver (`0x0271`) is read-only and not yet verified |
| QMK with VIA or Vial (raw HID `0xFF60`) | VIA and Vial protocol versions, and every keymap layer drawn on the physical layout | Not yet verified on hardware. Built from the QMK and Vial sources and tested against a simulated keyboard |

Other Wooting boards are detected but shown as not yet verified.

## Development

```
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck, tests, production build
```

## Architecture

```
src/
  hid/          WebHID helpers: collection lookup, report sizes, waiting for input reports
  keyboard/     Vendor-neutral model: profiles, keymaps, analog readings, key names
  protocol/     Transport-independent codecs, one folder per protocol family
  drivers/      KeyboardDriver implementations and the driver registry
  connection/   KeyboardConnection: authorization, auto-reconnect, unplug handling
  ui/           DOM rendering of the connection state and the capability panels
tests/          Unit tests with fake HID devices replaying captured replies
```

A driver opens a `KeyboardSession`, which may offer optional capabilities: `profiles`, `profileEditor`, `keymap`, `definitionLoader`, `analogKeys`, `lighting`, `lightingEditor`, `deviceSettings` and `deviceSettingsEditor`. The UI shows one panel per capability, so a new vendor only needs a codec under `src/protocol/`, a driver under `src/drivers/`, and an entry in `keyboard-driver-registry.ts`.

## Documentation

Start with [docs/README.md](docs/README.md).

- [Architecture](docs/architecture.md): layers, capabilities, the safe write path, and tests.
- [Wooting protocol](docs/wooting.md): commands, profiles, per-key formats, travel encodings, the analog stream, and writing.
- [Razer protocol](docs/razer.md): the 90-byte control report, lighting effects, polling rate, sleep timer and battery.
- [VIA and Vial](docs/via.md): raw HID commands, Vial definitions, KLE layouts, and keycodes.
- [WebHID notes](docs/webhid.md): browser, Windows, and node-hid behavior.
- [Reverse engineering](docs/reverse-engineering.md): safety rules, tools, and the experiment log.
- [Background](docs/background.md): OpenMouse, related projects, and licensing.
- [Open questions](docs/open-questions.md): unknowns and next steps.
