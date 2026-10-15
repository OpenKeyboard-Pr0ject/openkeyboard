import { describe, expect, it } from "vitest";
import {
  featureReportByteLength,
  hasCollection,
  NoFittingOutputReportError,
  smallestOutputReportHolding,
} from "../../src/hid/collections";
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

describe("smallestOutputReportHolding", () => {
  it("picks the smallest declared output report that fits", () => {
    expect(smallestOutputReportHolding(new FakeHidDevice().asHidDevice(), 40)).toEqual({ reportId: 2, byteLength: 62 });
  });

  it("ignores the constant padding the 80HE declares after the data of every output report", () => {
    const device = new FakeHidDevice().asHidDevice();

    expect(smallestOutputReportHolding(device, 31)).toEqual({ reportId: 1, byteLength: 32 });
    expect(smallestOutputReportHolding(device, 207)).toEqual({ reportId: 3, byteLength: 254 });
  });

  it("rejects data larger than every declared output report", () => {
    const device = new FakeHidDevice().asHidDevice();

    expect(() => smallestOutputReportHolding(device, 3000)).toThrow(NoFittingOutputReportError);
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
