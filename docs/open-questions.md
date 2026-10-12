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

## Implemented but not verified on hardware

- **VIA and Vial keymaps:** see the checklist at the end of [via.md](via.md).
- **Linux:** udev rules for `hidraw` access have not been written or tested.
- **Wooting models other than the 80HE:** reads are shown as "Not yet verified on hardware", and editing is disabled.

## Feature ideas, in a sensible order

1. **Per-key Rapid Trigger off in an "on" profile, and split sensitivity:** after the experiments above.
2. **Profile switching from the app:** feature `0x17 <slot>`. It is a write with no data, but it changes the keyboard's behavior immediately. Ask the owner first.
3. **Wooting key remapping (`0x14`):** the mapping read is understood. The write needs four parts and a capture of a single remap in Wootility.
4. **Wooting RGB (`0x0E`, `0x0F`, `0x16`, feature `0x08`):** formats are partly known from libwootility. Confirm by capture before writing.
5. **VIA and Vial editing:** set keycode (`05`) is simple, but Vial keyboards may need the unlock flow. Implement only after the read path is verified on hardware.
6. **Keyboard drawing for Wooting:** reuse the KLE renderer with a built-in 80HE layout, so per-key settings can be picked by clicking keys instead of a list.
7. **Live analog view on the keyboard drawing:** color each key by travel.
