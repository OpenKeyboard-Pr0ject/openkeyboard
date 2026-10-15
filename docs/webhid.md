# WebHID and platform notes

Behavior of WebHID, Chrome and Windows HID that OpenKeyboard depends on. Most of it was observed while working with the Wooting 80HE in Chrome on Windows 11.

## Browser support

- **Chromium only:** WebHID exists only in Chromium browsers on desktop (Chrome, Edge). Firefox and Safari do not implement it. Without `navigator.hid`, OpenKeyboard shows the "WebHID is not available" state.
- **Secure origin:** pages must be served from a secure origin. `http://localhost` counts as secure, which is how `npm run dev` works.

## Devices, collections and permissions

- **One `HIDDevice` per top-level collection:** a single keyboard appears as several `HIDDevice` objects. For example, Wootility's page saw four for the 80HE: consumer control `0x0C`, `0xFF55`, `0xFF53` and `0xFF00`. The standard keyboard and mouse collections are never exposed to pages.
- **Chooser filters:** `navigator.hid.requestDevice({ filters })` lists devices whose collections match a filter. Filtering on usage page *and* usage avoids listing the same keyboard twice.
- **Permission scope:** the chooser shows the physical keyboard once. On the 80HE, the analog collection (`0xFF53`) was available next to the config collection without a second prompt. If it is not, the live key panel asks for access again; the second chooser lists the keyboard with both filters, and the user can grant it.
- **Remembered permission:** `navigator.hid.getDevices()` returns every previously granted `HIDDevice`. OpenKeyboard reconnects to the first supported one on load, without a prompt.
- **Connect and disconnect events:** `connect` and `disconnect` fire once per collection. Event handlers must check whether the device is the one in use. The sibling analog collection is therefore looked up when the stream starts, not when the config collection connects.
- **Revoking:** `HIDDevice.forget()` revokes the permission.

## Reports

- **Report IDs:**
  - `sendFeatureReport(reportId, data)` and `sendReport(reportId, data)` take the report ID separately; `data` excludes it.
  - `inputreport` events carry `reportId` and a `DataView` without the ID byte.
  - Devices without report IDs, such as VIA's raw HID or Wooting's analog stream, use report ID `0`.
- **Report size:** each report's size is declared in `HIDDevice.collections[].outputReports` and `.featureReports` as items (`reportSize` bits × `reportCount`). OpenKeyboard pads every report to its declared size and chooses the smallest output report that fits the data. Items marked `isConstant` are padding, not room for data: the 80HE's output reports are 32, 62, 254 … bytes of data plus a constant item up to 2046 bytes.
- **Several input report IDs:** one collection can answer on several input report IDs. Wooting answers small replies on ID 1 and large ones on IDs 2 and 3, so match replies by content.
- **Serialization:** WebHID does not serialize requests and replies. OpenKeyboard keeps one request in flight per channel with a promise queue, and waits for the matching input report with a timeout.
- **Several pages at once:** two pages, or a page and a native app, can open the same collection on Windows. Wootility Web and OpenKeyboard were connected to the 80HE at the same time without errors. Input reports are delivered to every opener, so a reply to another app's request can arrive. Matching on command id keeps that harmless for read commands.

## Windows and node-hid

The probing scripts in [reverse-engineering.md](reverse-engineering.md) use [node-hid](https://github.com/node-hid/node-hid) 3.x (hidapi):

- **Report ID first:** `device.sendFeatureReport([reportId, ...data])` takes the report ID as the first byte. Report ID `0` on the Wooting config collection fails with `HidD_SetFeature: (0x00000057) The parameter is incorrect`.
- **Padded writes:** `device.write([reportId, ...data])` pads to the collection's largest output report. On the 80HE it reported 2047 bytes written for a 32-byte report, and the keyboard accepted it.
- **Reads:** `device.readTimeout(ms)` returns an input report with the report ID as byte 0 when the device uses report IDs. It returns up to 2047 bytes for the 80HE's config collection.
- **Enumeration:** `HID.devices()` lists one entry per collection with `usagePage`, `usage`, `interface` and `release`. The 80HE reports `release 0x0250` and product `Wooting 80HE TenZ`.
- **No report descriptors:** node-hid 3.x on Windows has no `getReportDescriptor()`, so report sizes were inferred from behavior and from the descriptor published in libwootility.

## Linux

Not tested here. On Linux, a page can only open a `hidraw` node that the user can access. Projects in the same space (VIA, Vial, OpenMouse) ship udev rules that grant `uaccess` to every `hidraw` node of the device. OpenKeyboard will need the same for Wooting (`31e3`) and for VIA keyboards.
