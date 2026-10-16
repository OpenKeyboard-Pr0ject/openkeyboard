# Architecture

OpenKeyboard is a single-page web app (Vite, TypeScript, React, Tailwind CSS) that talks to keyboards through WebHID. Everything runs in the browser. Besides React, the only runtime dependency is [xz-decompress](https://github.com/httptoolkit/xz-decompress), used to unpack Vial keyboard definitions.

## Layers

```
src/
  main.tsx      creates KeyboardConnection(navigator.hid) and renders <App>
  hid/          WebHID helpers that know nothing about vendors
  shared/       hex formatting and error descriptions
  keyboard/     vendor-neutral model: profiles, keymaps, analog readings, key names
  protocol/     pure codecs and command channels, one folder per protocol family
    protobuf/     minimal protobuf reader and writer that preserves unknown fields
    wooting/      Wooting config protocol, analog stream, per-key formats
    razer/        Razer 90-byte control report, lighting and device settings codecs
    via/          VIA and Vial commands, KLE layouts, QMK keycodes, xz
  drivers/      KeyboardDriver implementations that turn codecs into capabilities
    wooting/      reader, editor, analog source, driver
    razer/        lighting, device settings, driver
    via/          keymap reader, driver
  connection/   KeyboardConnection: authorization, reconnect, unplug, state
  app/          React UI: App, theme, layout (sidebar), pages per capability, components, pure draft helpers
```

Dependencies point downward only: `ui` → `connection` → `drivers` → `protocol` → `hid`, and everything may use `keyboard` and `shared`. Codecs in `protocol/` are pure functions over `Uint8Array`, so they are tested without any device.

## Drivers, sessions and capabilities

```ts
interface KeyboardDriver {
  readonly requestFilters: readonly HIDDeviceFilter[];
  supports(device: HIDDevice): boolean;
  open(device: HIDDevice, listAuthorizedDevices: AuthorizedDeviceLister): Promise<KeyboardSession>;
}

interface KeyboardSession extends KeyboardCapabilities {
  readonly device: HIDDevice;
  readIdentity(): Promise<KeyboardIdentity>;
  close(): Promise<void>;
}

interface KeyboardCapabilities {
  readonly analogKeys?: AnalogKeySource;          // Wooting
  readonly profiles?: KeyboardProfileReader;      // Wooting
  readonly profileEditor?: KeyboardProfileEditor; // Wooting, write-verified models only
  readonly keymap?: KeymapReader;                 // VIA and Vial
  readonly definitionLoader?: KeyboardDefinitionLoader; // plain VIA only
  readonly lighting?: KeyboardLightingReader;            // Razer; Wooting reads per-key colors
  readonly lightingEditor?: KeyboardLightingEditor;      // Razer, write-verified models only
  readonly deviceSettings?: KeyboardDeviceSettingsReader; // Razer: battery, polling rate, sleep timer
  readonly deviceSettingsEditor?: KeyboardDeviceSettingsEditor; // Razer, write-verified models only
  readonly physicalLayout?: PhysicalLayout;              // Wooting 80HE
}
```

- **Registry:** `keyboard-driver-registry.ts` lists the drivers in order: Wooting, Razer, then VIA. The browser chooser uses the union of their `requestFilters`. The first driver whose `supports()` accepts a granted `HIDDevice` opens it.
- **One HIDDevice per collection:** a physical keyboard shows up as several `HIDDevice` objects, one per top-level collection. Drivers match exactly one of them, the config collection, so the keyboard is not listed twice. The Wooting analog source finds its sibling interface (`0xFF53`) at runtime through `listAuthorizedDevices`. See [webhid.md](webhid.md).
- **Capabilities are optional:** the UI offers one sidebar section per capability that a session offers. A new vendor only adds a codec, a driver and a registry entry.
- **Physical layouts:** `keyboard/physical-layout.ts` describes where each key sits (`x`, `y`, `width`, `height` in key units) and which matrix position it reads. Layout data is device-specific, so it lives with the driver (`drivers/wooting/wooting-80he-layout.ts`) and reaches the UI through `physicalLayout`. Without one, the UI draws `matrixGridLayout` from the keys a profile maps: one cell per matrix position, labeled from the HID usage. A new keyboard with analog keys therefore works before anyone draws its layout.
- **Vendor-neutral settings:** analog settings use `KeyboardProfile` (actuation point, Rapid Trigger, per-key values) and lighting uses `LightingState` (brightness, an effect, optional `keyColors` per matrix position). A driver fills only what its keyboard has; for example Wooting reports `per-key` colors and `layeredEffects` (a base effect plus effect layers), Razer a single effect. A lighting editor that supports layered effects exposes a `LayeredEffectCatalog`: the effects, their parameters (slider, choice, toggle or color, with ranges and how to display them), presets and key color layers. RGB Settings renders effects from the catalog alone, so another vendor only needs its own catalog and codec.
- **Editing is gated:** `profileEditor` exists only for product ids in `WOOTING_WRITE_VERIFIED_PRODUCT_IDS` (the 80HE, `0x1402`). Other Wooting boards stay read-only, even though the protocol is probably shared. In the same way, `lightingEditor` and `deviceSettingsEditor` exist only for `RAZER_WRITE_VERIFIED_PRODUCT_IDS` (the wired BlackWidow V3 Mini, `0x0258`). Wooting `lightingEditor` exists only for `WOOTING_RGB_WRITE_VERIFIED_PRODUCT_IDS` (the 80HE); it edits brightness, key colors and layered effects of the active profile. Editors may also offer `beginPreview()`, a `LightingPreview` that shows changes on the keyboard before `save` or `discard`; RGB Settings uses it for live preview.

## Device sources

`main.tsx` gives `KeyboardConnection` the browser's `navigator.hid`. The connection only relies on the part of the `HID` and `HIDDevice` interfaces that the drivers use, so the [OpenKeyboard desktop app](../../openkeyboard-desktop) reuses these modules with its own native HID implementation in place of WebHID. It also reuses `tests/fakes` in its own tests.

If no granted device is supported, `KeyboardConnection` asks each driver's optional `explainUnusableInterface` and shows the first explanation as a failed connection. The Razer driver uses it when the browser shared only the media key or LampArray interfaces of a BlackWidow V3 Mini.

## Connection lifecycle

`KeyboardConnection` owns at most one session and publishes a `ConnectionState`:

```
unsupported-browser | disconnected(notice?) | connecting(deviceName) | connected(identity, capabilities) | failed(deviceName, reason)
```

- **On start:** it subscribes to `navigator.hid` `connect` and `disconnect` events, then opens the first already-authorized supported device, so a reload reconnects without a prompt.
- **`requestKeyboard()`:** opens the browser chooser with the registry filters.
- **On unplug:** a `disconnect` event for the session's device publishes `disconnected` with a notice.
- **On plug-in:** a `connect` event for a supported device opens it, if no session is active.
- **`disconnect()` and `forget()`:** close the session. `forget()` also calls `HIDDevice.forget()` to revoke permission.

Errors while opening or reading the identity become a `failed` state with the error message. Nothing is thrown into the UI.

## Command channels

Both protocol families serialize traffic through a promise queue, because a reply is matched to the request that is waiting for it.

- **`WootingCommandChannel`:**
  - `request(command, parameters)` sends a feature report and waits up to 1 s for an input report whose magic and command byte match.
  - `writeReport(report)` sends an output report on the smallest declared output report whose data items fit, zero-padded to that size. Constant items are padding and do not count: the 80HE declares every output report padded to 2046 bytes but reads only the data item.
- **`RazerCommandChannel`:**
  - `request(command, args)` sends a 90-byte feature report without a report ID, then reads the feature report back every 8 ms until the status leaves "new" or "busy" and the reply echoes the command. It gives up after 60 reads.
  - It keeps the last 90 bytes of the reply, so a reply that starts with the report ID byte also works.
- **`ViaCommandChannel`:**
  - `request(command, args)` sends a 32-byte output report and waits for the reply that echoes the command, or `0xFF` for unsupported.
  - `requestVial(subcommand, args)` takes the next input report, because Vial replies do not echo.

`waitForInputReport` in `hid/` removes its listener on reply, timeout, or cancellation. If sending fails, the pending reply is cancelled with the send error, so a failed write never hangs.

## Reading a Wooting profile

`WootingProfileReader.readProfile(slot)` combines these reads:

| Read | Command | Used for |
|---|---|---|
| Metadata | `0x37 <slot>` | Name and color |
| Settings | `0x27 <slot>` | Actuation, Rapid Trigger, sensitivity, continuous |
| Mapping | `0x30 <slot>`, or slot 0 if empty | Key names for matrix positions |
| Per-key actuation | `0x31 <slot>` | Keys with their own actuation point |
| Per-key Rapid Trigger | `0x3D <slot>` | Keys with their own Rapid Trigger |

`listProfiles()` reads metadata for slots 0–3 and stops at the first empty name. `readActiveSlot()` reads `0x0B`.

## Writing safely

`WootingProfileEditor.updateProfile(slot, change)` is the only code path that writes to a keyboard. Its rules exist because a wrong write can corrupt a profile.

1. **Validate first:** each value must be inside Wootility's range and on its 0.05 mm step. Otherwise `SettingOutOfRangeError` is thrown before any traffic.
2. **Read before write:** the current payload of every part that will change is read from the target slot. An empty settings payload means an empty slot, which raises `EmptyProfileSlotError`.
3. **Change only what was asked:** `ProtobufMessage` keeps every field it does not understand, byte for byte. Per-key edits move a single key between groups, and untouched groups keep their bytes.
4. **Send only what changed:** the editor writes only the changed parts, in Wootility's order: `0x1D`, `0x11`, `0x15`. An earlier version always sent an empty `0x1D`, which would have cleared every per-key Rapid Trigger setting. Tests now pin this behavior.
5. **Verify by reading back:** every written part is read again and compared by meaning, after normalizing packed and unpacked lists. Then the active slot is read again. A mismatch raises `ProfileWriteNotVerifiedError` or `ActiveSlotChangedError`.
6. **Refuse what is not understood:** per-key actuation lists in the legacy 8-bit form raise `LegacyPerKeyActuationError`. Report types that have not been verified on hardware have no encoder at all.

The UI only builds a `ProfileSettingsChange` with the fields the user actually changed.

### Razer writes

`RazerLighting.updateLighting` and `RazerDeviceSettings.updateDeviceSettings` follow the same rules in a smaller form:

1. **Validate first:** brightness must be a whole percent, colors whole numbers from 0 to 255, at most two colors per effect, polling rate one of 125, 500 and 1000 Hz, and the sleep timer whole minutes from 1 to 15.
2. **Send only what changed:** the UI builds a `LightingChange` or `DeviceSettingsChange` with the changed fields. The effect is written before the brightness.
3. **Verify by reading back:** the keyboard returns stored values unchanged, so every written value is read again and compared by meaning. A mismatch raises `RazerWriteNotVerifiedError`.

## UI

The UI lives in `src/app/` and uses React with Tailwind CSS v4. It only presents what the drivers offer; it adds no keyboard logic of its own.

- **`App`:** subscribes to `KeyboardConnection` (`useConnectionState`). While no keyboard is connected it shows `ConnectionScreen` for the current state; once connected it shows `AppShell`.
- **`AppShell`:** an icon rail (Keyboard, Settings, Help), a navigation panel for the chosen rail, a device bar and the page. Sections come from `navigationFor` in `layout/sections.ts`, in a fixed order: My Profiles, Actuation Point, Rapid Trigger, RGB Settings, Keymap, Battery and performance, Live key input, then Device, Interface and About. On narrow windows the rail becomes a top bar and the sections scroll horizontally.
- **Profile editing:** when a keyboard has `profiles`, `ProfileEditingProvider` (`app/profile-editing/`) holds the selected profile and one draft for the whole session, so changes made on Actuation Point and Rapid Trigger are saved together with **Save to keyboard** in `ProfileBar`, as in Wootility. Switching profiles is blocked while the draft has unsaved changes.
- **Selecting keys:** `KeyboardCanvas` draws a `PhysicalLayout`; keys are selected by clicking. A selection that covers every key edits the profile value and clears per-key values; a smaller selection gives those keys their own value. Turning Rapid Trigger off for some keys in a profile that has it on turns the profile setting off and enables the other keys one by one, because no per-key "off" format is known.
- **Pages:** `ProfilesPage`, `ActuationPage`, `RapidTriggerPage`, `LightingPage` (RGB Settings), `KeymapPage`, `DeviceSettingsPage`, `LiveKeysPage`, `DevicePage`, `InterfacePage` and `AboutPage`.
- **Pure helpers:** the editing logic lives in plain modules that are unit tested: `analog-draft.ts` (actuation, Rapid Trigger and per-key values), `effect-draft.ts` (single lighting effects), `lighting-draft.ts` (key colors, presets and layered effects), `history.ts` (undo and redo), `color-math.ts` (HSV) and `device-settings-draft.ts`.
- **Effect animation:** a `LayeredEffectCatalog` may carry a `LayeredEffectAnimator` (`keyboard/lighting-animation.ts`), a pure function from the draft effects, key colors, key centers, recent key presses and a time to one color per key. RGB Settings draws its keyboard with it at 30 frames per second (`use-effect-animation.ts`), so the picture runs the selected base effect and Fx layers before anything is saved. Static without Fx layers shows the key colors as they are. Key presses come from the analog stream when its interface is authorized, and from holding keys in the picture; `KeyPressTracker` keeps them for a few seconds after release so ripples and trails can fade. **Animate effects** turns the animation off (stored in `openkeyboard.lighting-animate-effects`, off by default with `prefers-reduced-motion`), and then the picture shows one still frame. The Wooting animator is `wooting-effect-animation.ts`.
- **Live key input:** `LiveKeysPage` keeps only the latest analog snapshot and renders once per animation frame, because the keyboard can send several hundred reports per second.
- **Themes:** `System`, `Light` and `Dark` under Settings, Interface, or on the connection screen. The choice is stored in `localStorage` (`openkeyboard.theme`); `System` follows `prefers-color-scheme`. Colors are CSS variables in `app/styles.css` that the `dark` class switches.
- **Branding:** `App` takes an `AppBranding` (tagline and footnote), so the desktop app can describe itself without changing the shared UI.
- **Display:** millimeters are rounded to 0.05 mm and shown with two decimals, as Wootility shows them.

All user-facing text is en-US.

## Testing

```
npm run check    # tsc --noEmit, vitest run, vite build
```

`vite.config.ts` holds the React and Tailwind plugins; `vitest.config.ts` holds the test settings, because Vitest 2 ships its own Vite types.

- **Fixtures come from hardware:** `tests/fakes/wooting-80he-captures.ts` holds replies and writes captured from the 80HE and from Wootility. Encoder tests assert byte-exact equality with what Wootility sent, so an encoding change cannot silently diverge from the vendor tool.
- **Razer fixtures:** `tests/fakes/razer-blackwidow-v3-mini-captures.ts` holds 90-byte replies captured from the BlackWidow V3 Mini and the effect arguments that were written and read back. Codec tests check both directions against them.
- **Fake devices:**
  - `FakeHidDevice` stands in for a Wooting interface. It answers feature reports through a `respond` callback and records output reports.
  - `FakeHid` stands in for `navigator.hid`.
  - `FakeRazerKeyboard` answers Razer feature reports, stores writes as the keyboard does, and can reply busy, prefix the report ID, ignore writes, or act as a receiver whose keyboard is off.
  - `FakeViaKeyboard` follows QMK's `via.c` and Vial's `vial.c`: it echoes commands, answers `0xFF` when unsupported, and serves a definition from an xz stream made with Python's `lzma.compress`.
- **Editor tests:** they use an in-memory keyboard that stores each part per slot and decodes the storage byte, as the firmware does. One test replays the exact hardware restore performed on the Typing Profile.

## Code conventions

- **No comments in code:** names carry the meaning. See `CLAUDE.md` and `~/.claude/clean-code-rules.md`.
- **Small functions and descriptive names:** errors are classes with en-US messages that say what to do next.
- **Short lines:** 120 characters at most, in `src` and `tests` alike.
- **Protocol notes live in `docs/`:** `README.md` stays an overview.
