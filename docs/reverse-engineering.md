# Reverse engineering

How the Wooting protocol in [wooting.md](wooting.md) was learned, the tools used, the rules that kept the keyboard safe, and a log of every experiment that wrote to hardware.

## Safety rules

A wrong write can corrupt a profile or leave a keyboard in a bad state. These rules held through every experiment:

1. **Read before you write:** start from read commands that a published source or the vendor tool already uses.
2. **Use an allowlist:** probing scripts refuse any command id that is not explicitly listed. Neighbors of known commands are often destructive. For example, `0x2A` saves a profile and `0x2B` resets flash.
3. **Never guess a write format:** writes are learned by watching the vendor tool perform them. The first own write replays exactly the bytes the vendor tool sent.
4. **Ask before a new kind of write:** each new write type (first write, inactive slot, per-key) was approved by the keyboard's owner before it touched hardware.
5. **Make small, reversible changes:** change one value by one step, on a profile that is not used daily when possible (the Typing Profile).
6. **Restore and prove it:** after every experiment, read every slot and every known structure, and compare them byte for byte with the state before.
7. **Keep personal data out:** serial numbers (`0x03`) are never read, and captures avoid typing personal text.

## Tools

The scripts live outside the repository; copy them into a scratch folder with `npm install node-hid@3`. They were run on Windows 11 with Node 20.

### Enumerate interfaces

```js
const HID = require("node-hid");
for (const device of HID.devices().filter((candidate) => candidate.vendorId === 0x31e3)) {
  console.log(device.interface, device.usagePage.toString(16), device.usage.toString(16), device.product);
}
```

### Read-only probe with an allowlist

```js
const HID = require("node-hid");
const READ_ONLY_ALLOWLIST = new Map([[0x0b, "current profile"], [0x27, "keyboard profile"], [0x31, "actuation"]]);
const [command, slot = 0] = process.argv.slice(2).map(Number);
if (!READ_ONLY_ALLOWLIST.has(command)) throw new Error(`Refusing non-allowlisted command ${command}`);
const info = HID.devices().find((device) => device.vendorId === 0x31e3 && device.usagePage === 0xff55);
const device = new HID.HID(info.path);
device.sendFeatureReport([1, 0xd1, 0xda, command, slot, 0, 0, 0]);
const deadline = Date.now() + 400;
while (Date.now() < deadline) {
  const reply = Buffer.from(device.readTimeout(50));
  if (reply.length > 7 && reply[1] === 0xd1 && reply[3] === command) {
    console.log("status", reply[4].toString(16), reply.subarray(7, 7 + reply.readUInt16LE(5)).toString("hex"));
    break;
  }
}
device.close();
```

The reply starts with the report ID (byte 0), then `D1 DA`, the command, the status, and the length (u16 LE at offset 5).

### Capture the analog stream

```js
const HID = require("node-hid");
const fs = require("fs");
const info = HID.devices().find((device) => device.vendorId === 0x31e3 && device.usagePage === 0xff53);
const device = new HID.HID(info.path);
const startedAt = Date.now();
const lines = [];
let previous = "";
while (Date.now() - startedAt < 180000) {
  const report = device.readTimeout(50);
  if (report.length === 0) continue;
  const hex = Buffer.from(report).toString("hex");
  if (hex !== previous) lines.push(`${Date.now() - startedAt} ${hex}`);
  previous = hex;
}
device.close();
fs.writeFileSync("analog-capture.txt", lines.join("\n"));
```

Run it in the background, then ask the user to press keys in a known order, with pauses between steps. For example: nothing for 5 s, A slowly to the bottom, S three times, A and S together, Space, Esc. The pauses make the steps easy to find in the log.

### Watch a structure while the user changes it in Wootility

Poll one read command every second and print the payload only when it changes. This is how Rapid Trigger on/off, sensitivity and Continuous were mapped to settings fields 3, 4 and 7. Give the user a list of single changes, with a pause and a save after each, then ask them to confirm the order they followed.

### Log WebHID traffic of Wootility Web

Wootility Web (`https://wootility.io`) uses WebHID, so its traffic can be logged from inside the page. Inject this before clicking **Go to Wootility**:

```js
(() => {
  if (window.hidTrafficLog) return;
  const log = [];
  window.hidTrafficLog = log;
  window.hidMarks = {};
  const toHex = (data) => {
    const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
    let end = bytes.length;
    while (end > 0 && bytes[end - 1] === 0) end -= 1;
    return Array.from(bytes.subarray(0, end), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const record = (entry) => {
    if (/^d1da4[9a]/.test(entry.hex)) return;
    log.push({ t: Math.round(performance.now()), ...entry });
  };
  const prototype = HIDDevice.prototype;
  const sendReport = prototype.sendReport;
  const sendFeatureReport = prototype.sendFeatureReport;
  prototype.sendReport = function (reportId, data) {
    record({ kind: "output", reportId, hex: toHex(data) });
    return sendReport.call(this, reportId, data);
  };
  prototype.sendFeatureReport = function (reportId, data) {
    record({ kind: "feature", reportId, hex: toHex(data) });
    return sendFeatureReport.call(this, reportId, data);
  };
  window.hidSince = (mark) => log.filter((entry) => entry.t >= window.hidMarks[mark]);
})();
```

- **Logging only:** the hook forwards every call unchanged. It only observes.
- **Mark before each action:** set `window.hidMarks.name = performance.now()` before an action, then read `window.hidSince("name")`. Use timestamps, not array indexes. Wootility polls `0x4A` many times a second, and an index-based mark became wrong once a capped log started dropping old entries.
- **Input reports:** Wootility does not attach its input listener through `addEventListener` on the prototype. To log replies, add a listener directly to the opened devices from `navigator.hid.getDevices()`.
- **Onboarding:** Wootility Web locks its configuration pages until its onboarding wizard has run once. The wizard writes settings, so let the keyboard's owner run it and keep their settings.
- **Committing a value:** a value typed into a Wootility number field is committed when focus leaves the field (Tab), not on Enter.

### Decode protobuf by hand

The payloads are protobuf without a schema. A tag is a varint `field << 3 | wire type`: 0 = varint, 2 = length-delimited, 1 and 5 = fixed. A varint holds 7 bits per byte, least significant group first.

- **Use the decoder:** decode with `ProtobufMessage` from `src/protocol/protobuf/protobuf-message.ts`, or a 20-line script, rather than by eye. A hand-decoded `b3 86 01` was once read as `0x4353` instead of `0x4333`, and a unit test caught it.
- **Packed and unpacked lists:** packed lists (`0a <length> <varints>`) and unpacked lists (`08 <varint> 08 <varint>`) mean the same thing. The 80HE answers packed, and Wootility writes unpacked.

## How each finding was made

| Finding | Method |
|---|---|
| Command framing, report IDs, status codes | Probed `GET_VERSION` with report IDs 0 and 1, magics `D0 DA` and `D1 DA`, and lengths 8, 65 and 257 |
| Command ids | libwootility and the gist, then each id checked with a read-only probe |
| Analog stream layout | 3-minute capture while the user typed a known sequence. The decoder reproduced the typed text |
| Settings fields 3, 4, 7 | Polled `0x27` while the user toggled Rapid Trigger and Continuous and changed sensitivity in Wootility |
| Actuation units | Compared raw values with a screenshot of Wootility's actuation page, then refined with values Wootility wrote (2.95 → `0x6F32`, 3.00 → `0x6FFF`) |
| Legacy 8-bit encoding | Slot 2's values `0x3F` and `0x1A` matched the odd precise factory values in slot 0 (0.988 and 0.408 mm) |
| Slot parameter | Wootility's connect traffic read `27`, `27 01`, `27 02` |
| Write framing and storage byte | Logged Wootility's Save on slot 0 (`01`) and slot 1 (`03`) |
| Saving is immediate | Wrote `0x11` alone, unplugged the keyboard, and read the value back |
| Per-key formats | Logged Wootility saving Q and W in the Typing Profile, then read `0x31` and found `0x3D` among Wootility's reads |
| Mapping key codes | Compared each row of `0x30` with the physical 80HE layout and Wootility's keyboard picture |

## Experiment log

All experiments ran on 2026-10-12, on the owner's 80HE, with the owner's approval for each new kind of write.

| # | Change | Written by | Restored by | Result |
|---|---|---|---|---|
| 1 | Slot 0 Rapid Trigger: Continuous off, Rapid Trigger off and on, sensitivity 0.2 mm | Owner in Wootility | Owner | Mapped settings fields 3, 4, 7. Slot 0 sensitivity was rewritten from `0x4686` to the exact `0x4666` |
| 2 | Wootility Web onboarding | Owner | Not needed | Wrote `07`, `28`, `21`, `17` with unchanged values. All slots identical |
| 3 | Slot 0 sensitivity 0.4 → 0.5 → 0.4 mm | Wootility Web | Wootility Web | Captured the 27-message save sequence. Byte-identical afterwards |
| 4 | Slot 0 `0x11` alone with 0.5 mm, then 0.4 mm | Test script replaying Wootility's bytes | Same script | Value survived unplugging. No commit command needed. Byte-identical afterwards |
| 5 | Slot 0 sensitivity 0.40 → 0.45 → 0.40 mm | OpenKeyboard in Chrome | OpenKeyboard | First write by the app. Byte-identical afterwards |
| 6 | Slot 1 actuation 3.00 → 2.95 mm (Wootility activated slot 1, then slot 0 again) | Wootility Web | OpenKeyboard, with slot 0 active | Found the storage byte `slot << 1 \| 1` and the `0x3FFF` formula. Byte-identical afterwards |
| 7 | Slot 1: Q actuation 1.50 mm, Q Rapid Trigger with profile sensitivity 0.30 mm, W Rapid Trigger 0.60 mm | Wootility Web | OpenKeyboard, with slot 0 active | Found `0x15`, `0x1D` and `0x3D`. Byte-identical afterwards, including `0x29`, `0x34`, `0x42` |

Experiment 7 also revealed a bug. The app had been sending an empty `0x1D` before every settings write, believing it was a marker. An empty `0x1D` clears per-key Rapid Trigger. No profile had per-key Rapid Trigger at the time, so nothing was lost, and the app now sends only the parts that change.

## Lessons

- **Name things by evidence, not by guess:** `0x1D` was first called a "settings update marker" because it always preceded `0x11`. It turned out to be a full data report that was empty at the time.
- **Fit a formula to every observation:** the first actuation formula fitted three values to within 0.012 mm. Only values written by the vendor tool (2.95 and 3.00 mm) exposed the real scale.
- **Command ids and report types are separate namespaces:** feature `0x15` (keys off) and output report `0x15` (per-key actuation) are unrelated.
- **Compare by meaning, not bytes, after a write:** devices may normalize what they store, for example packed vs unpacked lists.
- **Firmware can change under you:** the keyboard went from 2.14.0 to 2.14.1 between sessions (updated in Wootility). Re-read the version before relying on old captures.
- **Browser automation tip:** clicks by accessibility reference sometimes did nothing after the page scrolled. Clicking by screen coordinates from a fresh screenshot worked.
