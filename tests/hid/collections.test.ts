import { describe, expect, it } from "vitest";
import { featureReportByteLength, hasCollection } from "../../src/hid/collections";
import { FakeHidDevice, wootingConfigCollection } from "../fakes/fake-hid-device";

const nestedCollections: HIDCollectionInfo[] = [
  { usagePage: 0x01, usage: 0x06, children: [wootingConfigCollection], featureReports: [] },
];

describe("hasCollection", () => {
  it("finds a collection nested inside another one", () => {
    const device = new FakeHidDevice({ collections: nestedCollections }).asHidDevice();

    expect(hasCollection(device, 0xff55, 0x01)).toBe(true);
  });
});

describe("featureReportByteLength", () => {
  it("sums the declared report items in bytes", () => {
    expect(featureReportByteLength(new FakeHidDevice().asHidDevice(), 1)).toBe(7);
  });

  it("returns zero for a report id the device does not declare", () => {
    expect(featureReportByteLength(new FakeHidDevice().asHidDevice(), 9)).toBe(0);
  });
});
