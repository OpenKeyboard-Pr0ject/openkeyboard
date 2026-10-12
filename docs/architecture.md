# Architecture

OpenKeyboard is a single-page web app (Vite, TypeScript, no UI framework) that talks to keyboards through WebHID. Everything runs in the browser. The only runtime dependency is [xz-decompress](https://github.com/httptoolkit/xz-decompress), used to unpack Vial keyboard definitions.

## Layers

```
src/
  main.ts       creates KeyboardConnection(navigator.hid) and mounts the view
  hid/          WebHID helpers that know nothing about vendors
  shared/       hex formatting and error descriptions
  keyboard/     vendor-neutral model: profiles, keymaps, analog readings, key names
  protocol/     pure codecs and command channels, one folder per protocol family
    protobuf/     minimal protobuf reader and writer that preserves unknown fields
    wooting/      Wooting config protocol, analog stream, per-key formats
    via/          VIA and Vial commands, KLE layouts, QMK keycodes, xz
  drivers/      KeyboardDriver implementations that turn codecs into capabilities
    wooting/      reader, editor, analog source, driver
    via/          keymap reader, driver
  connection/   KeyboardConnection: authorization, reconnect, unplug, state
  ui/           DOM rendering: connection card and one panel per capability
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
}
```

- **Registry:** `keyboard-driver-registry.ts` lists the drivers in order: Wooting first, then VIA. The browser chooser uses the union of their `requestFilters`. The first driver whose `supports()` accepts a granted `HIDDevice` opens it.
- **One HIDDevice per collection:** a physical keyboard shows up as several `HIDDevice` objects, one per top-level collection. Drivers match exactly one of them, the config collection, so the keyboard is not listed twice. The Wooting analog source finds its sibling interface (`0xFF53`) at runtime through `listAuthorizedDevices`. See [webhid.md](webhid.md).
- **Capabilities are optional:** the UI renders one panel per capability that a session offers. A new vendor only adds a codec, a driver and a registry entry.
- **Editing is gated:** `profileEditor` exists only for product ids in `WOOTING_WRITE_VERIFIED_PRODUCT_IDS` (the 80HE, `0x1402`). Other Wooting boards stay read-only, even though the protocol is probably shared.

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
  - `writeReport(report)` sends an output report on the smallest declared output report that fits, zero-padded to its declared size.
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

## UI

- **Connection card:** `connection-view.ts` renders the card for the current state and creates panels for the session's capabilities. Panels implement `Panel { element; dispose() }` and are disposed when the state changes.
- **`ProfilePanel`:** shows a tab per stored profile, the selected profile's details, and an **Edit settings** form (`ProfileSettingsForm`). The form contains a `KeySettingsSection` with one row per key that has its own settings.
- **`LiveKeyPanel`:** subscribes to the analog stream. It keeps only the latest snapshot and renders once per animation frame, because the keyboard can send several hundred reports per second.
- **`KeymapPanel`:** draws the VIA or Vial keymap on the KLE layout with one tab per layer. It offers a file picker when a plain VIA keyboard needs its definition.
- **Display:** millimeters are rounded to 0.05 mm and shown with two decimals, as Wootility shows them.

All user-facing text is en-US.

## Testing

```
npm run check    # tsc --noEmit, vitest run, vite build
```

- **Fixtures come from hardware:** `tests/fakes/wooting-80he-captures.ts` holds replies and writes captured from the 80HE and from Wootility. Encoder tests assert byte-exact equality with what Wootility sent, so an encoding change cannot silently diverge from the vendor tool.
- **Fake devices:**
  - `FakeHidDevice` stands in for a Wooting interface. It answers feature reports through a `respond` callback and records output reports.
  - `FakeHid` stands in for `navigator.hid`.
  - `FakeViaKeyboard` follows QMK's `via.c` and Vial's `vial.c`: it echoes commands, answers `0xFF` when unsupported, and serves a definition from an xz stream made with Python's `lzma.compress`.
- **Editor tests:** they use an in-memory keyboard that stores each part per slot and decodes the storage byte, as the firmware does. One test replays the exact hardware restore performed on the Typing Profile.

## Code conventions

- **No comments in code:** names carry the meaning. See `CLAUDE.md` and `~/.claude/clean-code-rules.md`.
- **Small functions and descriptive names:** errors are classes with en-US messages that say what to do next.
- **Short lines:** 120 characters at most, in `src` and `tests` alike.
- **Protocol notes live in `docs/`:** `README.md` stays an overview.
