# Open questions and next steps

What is still unknown, what is implemented but untested, and what would come next. Each item says how it could be settled. Follow the safety rules in [reverse-engineering.md](reverse-engineering.md) before any experiment that writes.

## Wooting protocol unknowns

| Question | How to settle it |
|---|---|
| Settings fields 2, 5, 6, 9 | Poll `0x27` while toggling the remaining Wootility options one at a time (for example tachyon mode, gamepad mode, Rappy Snappy, release dynamics) |
| How a single key turns Rapid Trigger **off** in a profile where it is on | Wootility: select one key in TenZ Profile, switch Rapid Trigger off for it, log the `0x1D` report |
| Split press and release sensitivity in a per-key group | Wootility: enable "Split sensitivity" for one key, log `0x1D` and read `0x3D` |
| Whether Continuous Rapid Trigger can be set per key | Same experiment with the Continuous toggle on a single key |
| What `0x13`/`0x29`, `0x20`/`0x42`, `0x21`, `0x28`, `0x12`, `0x18`, `0x1B`, `0x07` hold | Change the matching Wootility pages (Gamepad, Advanced Keys, Light Indicator, Remap) one at a time and diff the save sequence |
| What feature commands `0x35` and `0x48` do in the save sequence | Find which data they follow. `0x35` is SAVE_AKC_PROFILE in libwootility and follows `0x18` |
| Read commands `0x3E`, `0x43`, `0x46`, `0x47`, `0x49`, `0x4A`, `0x51`–`0x53` | Read them with a probe that lists only these ids (Wootility already sends them) and look for patterns |
| Device config `0x13` payload `00 00 00 00 11 00 0c` | Compare with another Wooting model, or change keyboard-wide options |
| Global settings `0x33` (`5`, `10`, `1`) | Change the RGB idle timers in Wootility and poll `0x33` |
| How Wootility converts a legacy 8-bit per-key list | Save TenZ Ultra Profile once in Wootility and compare `0x31` before and after |
| Whether other Wooting models (60HE+, Two HE, UwU) share the 80HE layout | Needs those keyboards. The read path already accepts any `0xFF55` Wooting device but marks it unverified |
| RGB writes (`0x0E`, `0x0F`, `0x16`, feature `0x08`) | Read layout is known (see [wooting.md](wooting.md#rgb-lighting)). Capture Wootility changing one key color and the brightness on Typing Profile, replay the bytes, then compare `0x23`, `0x24`, `0x32` before and after |
| Effect layers in `0x32` field 4 | Change Typing Profile's Wave speed and direction in Wootility, one at a time, and read `0x32` after each |
| `0x32` fields 1.2 and 1.3 (`0xFFFF`) | Look for a Wootility setting that changes them |
| Whether per-key settings for the Spacebar need all three matrix positions (row 5, columns 4, 6, 8) | Set a per-key actuation on the Spacebar in Wootility and read `0x31`. OpenKeyboard edits column 6, the position the analog stream reports |
| Split press and release sensitivity | Wootility offers "Split sensitivity" on the Rapid Trigger page. OpenKeyboard does not offer it until its format is captured |

## Razer unknowns

| Question | How to settle it |
|---|---|
| The HyperSpeed receiver path (`0x0271`): transaction id, timing, battery while unplugged | Switch the keyboard to HyperSpeed mode with the cable out, connect the receiver in OpenKeyboard, and compare every read with the cable readings |
| What `00:87` (`02 03 01 00`) and the second layout byte (`82`) mean | Compare with another Razer keyboard or another layout |
| Why the low battery threshold reads `FF` | Read `07:82` in wireless mode |
| Which effect ids Razer Synapse writes, and whether it uses the custom frame (`0F:03`) | Capture Synapse with USBPcap while it applies a per-key effect, then read `0F:82` |
| Profiles in onboard memory | Capture Synapse while it switches profiles. No profile command is known yet |
| How Chrome on Linux or macOS handles MI_03 | Grant the keyboard there and check `getDevices()` for a `0x0C:0x01` collection with a 90-byte feature report |
| Whether other Razer keyboards share the layout | Needs those keyboards. The driver accepts only the two BlackWidow V3 Mini product ids |

## Implemented but not verified on hardware

- **VIA and Vial keymaps:** see the checklist at the end of [via.md](via.md).
- **Razer HyperSpeed receiver:** reads go through it, but the keyboard was on the cable, so every reply said "no response".
- **Razer in Chrome:** Chrome on Windows does not offer the control interface to web pages (see [razer.md](razer.md#chrome-on-windows)), so the browser app cannot change the keyboard there. Chrome on Linux and macOS has not been tried.
- **Linux:** udev rules for `hidraw` access have not been written or tested.
- **Wooting models other than the 80HE:** reads are shown as "Not yet verified on hardware", and editing is disabled.

## Feature ideas, in a sensible order

1. **Per-key Rapid Trigger off in an "on" profile, and split sensitivity:** after the experiments above.
2. **Profile switching from the app:** feature `0x17 <slot>`. It is a write with no data, but it changes the keyboard's behavior immediately. Ask the owner first.
3. **Wooting key remapping (`0x14`):** the mapping read is understood. The write needs four parts and a capture of a single remap in Wootility.
4. **Wooting RGB writes (`0x0E`, `0x0F`, `0x16`, feature `0x08`):** the read side is decoded and shown on RGB Settings. Capture one supervised write in Wootility before OpenKeyboard writes anything.
5. **VIA and Vial editing:** set keycode (`05`) is simple, but Vial keyboards may need the unlock flow. Implement only after the read path is verified on hardware.
6. **Layouts for more keyboards:** the 80HE has a built-in layout (`wooting-80he-layout.ts`). Other models fall back to a matrix grid until someone adds their layout next to their driver.
7. **Live analog view on the keyboard drawing:** color each key by travel.
8. **Razer per-key colors:** through the custom frame (`0F:03`) or the standard LampArray interface (MI_04, usage page `0x59`).
