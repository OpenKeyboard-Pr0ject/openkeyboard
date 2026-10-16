# Open questions and next steps

What is still unknown, what is implemented but untested, and what would come next. Each item says how it could be settled. Follow the safety rules in [reverse-engineering.md](reverse-engineering.md) before any experiment that writes.

## Wooting protocol unknowns

| Question | How to settle it |
|---|---|
| Settings fields 2 and 6 | Poll `0x27` while toggling the remaining Wootility options one at a time (for example gamepad mode, Rappy Snappy, release dynamics) |
| Which of settings fields 5 and 9 the firmware reads for Tachyon Mode, and whether field 9 holds a Tachyon sub-mode (Wootility knows "tachyon focus" and "non-focus" latencies) | Look for a Wootility option that changes only one of them |
| Whether Tachyon Mode also ignores previewed brightness | Preview a brightness change on a Tachyon profile and watch the keys (the `0x4A` frame may not include brightness) |
| How a single key turns Rapid Trigger **off** in a profile where it is on | Wootility: select one key in TenZ Profile, switch Rapid Trigger off for it, log the `0x1D` report |
| Split press and release sensitivity in a per-key group | Wootility: enable "Split sensitivity" for one key, log `0x1D` and read `0x3D` |
| Whether Continuous Rapid Trigger can be set per key | Same experiment with the Continuous toggle on a single key |
| What `0x13`/`0x29`, `0x20`/`0x42`, `0x21`, `0x28`, `0x12`, `0x18`, `0x1B`, `0x07` hold | Change the matching Wootility pages (Gamepad, Advanced Keys, Light Indicator, Remap) one at a time and diff the save sequence |
| What feature commands `0x35` and `0x48` do in the save sequence | Find which data they follow. `0x35` is SAVE_AKC_PROFILE in libwootility and follows `0x18` |
| Read commands `0x3E`, `0x43`, `0x46`, `0x47`, `0x49`, `0x51`–`0x53` | Read them with a probe that lists only these ids (Wootility already sends them) and look for patterns |
| Device config `0x13` payload `00 00 00 00 11 00 0c` | Compare with another Wooting model, or change keyboard-wide options |
| Global settings `0x33` (`5`, `10`, `1`) | Change the RGB idle timers in Wootility and poll `0x33` |
| How Wootility converts a legacy 8-bit per-key list | Save TenZ Ultra Profile once in Wootility and compare `0x31` before and after |
| Whether other Wooting models (60HE+, Two HE, UwU) share the 80HE layout | Needs those keyboards. The read path already accepts any `0xFF55` Wooting device but marks it unverified |
| Where Fn Layer 1 key colors are stored | Wootility saves no extra RGB report for them. Change one Fn layer color in Wootility and diff the whole save sequence, especially `0x1B` |
| Ripple flags bit 1, Breath field 2, Touch fields 3–5, Scan directions 1 and 2 | No Wootility control changes them. OpenKeyboard keeps them as stored |
| How closely the drawn RGB Settings animation matches the keyboard (look palettes, Wave span, Noise scale, Spiral shape, and Jelly, AOE and Mixing). It is only used when the lighting frame (`0x4A`) does not show the draft | Preview each effect with live preview on and record `0x4A` frames, then tune `wooting-effect-animation.ts` to reproduce them |
| Whether the `0x4A` frame includes global brightness, and what its 10 trailing values (`0xD020`) are | Lower the brightness in a live preview and read `0x4A`. Change the Fn layer or Mode key lighting and watch the trailing values |
| What ends a pending RGB preview besides `08` (replugging, switching profiles) | Replugging restarts the keyboard on TenZ Profile (experiment 18). Preview one change, close the tab, replug, and see what the keyboard shows |
| Whether writes before the report fix lost data | Every write went out on report 1 until experiment 19, so anything after byte 32 was cut. All 43 structures match the baseline now, and the profile writes verified on hardware were short, but a per-key write covering many keys may have been cut. Re-test per-key actuation for many keys |
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
- **Wooting live preview:** previews showed at once on the 80HE (experiment 18). Discard failed there because of the report bug, which is fixed and verified for Save in experiment 19. Run Discard once more on hardware and compare all 43 structures.
- **Wooting effects written by OpenKeyboard:** the codec rebuilds every Wootility preview byte for byte, but OpenKeyboard has not saved an effect on the keyboard yet. Do the first save with the owner watching and re-read all 43 structures afterwards.
- **Wooting models other than the 80HE:** reads are shown as "Not yet verified on hardware", and editing is disabled.

## Feature ideas, in a sensible order

1. **Per-key Rapid Trigger off in an "on" profile, and split sensitivity:** after the experiments above.
2. **Profile switching from the app:** feature `0x17 <slot>`. It is a write with no data, but it changes the keyboard's behavior immediately. Ask the owner first.
3. **Wooting key remapping (`0x14`):** the mapping read is understood. The write needs four parts and a capture of a single remap in Wootility.
4. **Wooting Fn layer colors:** see the unknowns above.
5. **VIA and Vial editing:** set keycode (`05`) is simple, but Vial keyboards may need the unlock flow. Implement only after the read path is verified on hardware.
6. **Layouts for more keyboards:** the 80HE has a built-in layout (`wooting-80he-layout.ts`). Other models fall back to a matrix grid until someone adds their layout next to their driver.
7. **Live analog view on the keyboard drawing:** color each key by travel.
8. **Razer per-key colors:** through the custom frame (`0F:03`) or the standard LampArray interface (MI_04, usage page `0x59`).
