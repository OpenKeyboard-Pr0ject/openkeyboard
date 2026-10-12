import { describe, expect, it } from "vitest";
import { encodeWootingReport, storageForSavingToSlot } from "../../src/protocol/wooting/wooting-codec";
import { WootingReportType } from "../../src/protocol/wooting/wooting-constants";
import {
  assignKeyActuation,
  assignKeyRapidTrigger,
  decodeRapidTriggerKeys,
  LegacyPerKeyActuationError,
} from "../../src/protocol/wooting/wooting-per-key-codec";
import { decodeActuationOverrides } from "../../src/protocol/wooting/wooting-profile-codec";
import {
  actuationProfilePayload,
  emptyPayload,
  payloadOf,
  typingQAndWRapidTriggerReadPayload,
  typingQAndWRapidTriggerWritePayload,
  typingQKeyActuationReadPayload,
  typingQKeyActuationWritePayload,
  typingQKeyRapidTriggerWritePayload,
  ultraProfileActuationPayload,
} from "../fakes/wooting-80he-captures";

const Q_POSITION = 0x41;
const W_POSITION = 0x42;
const E_POSITION = 0x43;
const ONE_AND_A_HALF_MILLIMETERS = 0x5800;
const SIX_TENTHS_OF_A_MILLIMETER = 0x4999;

const bySortedPosition = <Entry extends { matrixPosition: number }>(entries: Entry[]) =>
  [...entries].sort((first, second) => first.matrixPosition - second.matrixPosition);

describe("decodeRapidTriggerKeys", () => {
  it("reads the packed groups the keyboard returns for 0x3D", () => {
    expect(decodeRapidTriggerKeys(typingQAndWRapidTriggerReadPayload)).toEqual([
      {
        matrixPosition: W_POSITION,
        setting: { kind: "custom-sensitivity", sensitivityRaw: SIX_TENTHS_OF_A_MILLIMETER },
      },
      { matrixPosition: Q_POSITION, setting: { kind: "profile-sensitivity" } },
    ]);
  });

  it("reads the unpacked groups Wootility writes with 0x1D the same way", () => {
    expect(decodeRapidTriggerKeys(typingQAndWRapidTriggerWritePayload))
      .toEqual(decodeRapidTriggerKeys(typingQAndWRapidTriggerReadPayload));
  });

  it("reads an empty payload as no keys", () => {
    expect(decodeRapidTriggerKeys(emptyPayload)).toEqual([]);
  });
});

describe("assignKeyRapidTrigger", () => {
  it("produces exactly the group Wootility wrote for Q with the profile sensitivity", () => {
    expect(assignKeyRapidTrigger(emptyPayload, Q_POSITION, { kind: "profile-sensitivity" }))
      .toEqual(typingQKeyRapidTriggerWritePayload);
  });

  it("adds a key with its own sensitivity as a new group with the same meaning Wootility stored", () => {
    const updated = assignKeyRapidTrigger(typingQKeyRapidTriggerWritePayload, W_POSITION, {
      kind: "custom-sensitivity",
      sensitivityRaw: SIX_TENTHS_OF_A_MILLIMETER,
    });

    expect(bySortedPosition(decodeRapidTriggerKeys(updated)))
      .toEqual(bySortedPosition(decodeRapidTriggerKeys(typingQAndWRapidTriggerWritePayload)));
  });

  it("joins a key to an existing group that has the same setting", () => {
    const updated = assignKeyRapidTrigger(
      typingQKeyRapidTriggerWritePayload,
      E_POSITION,
      { kind: "profile-sensitivity" },
    );

    expect(updated).toEqual(payloadOf("0a06084108431801"));
  });

  it("removes a key that should follow the profile again", () => {
    const updated = assignKeyRapidTrigger(typingQAndWRapidTriggerReadPayload, Q_POSITION, { kind: "follow-profile" });

    expect(decodeRapidTriggerKeys(updated).map((key) => key.matrixPosition)).toEqual([W_POSITION]);
  });

  it("drops a group once its last key is removed", () => {
    expect(assignKeyRapidTrigger(typingQKeyRapidTriggerWritePayload, Q_POSITION, { kind: "follow-profile" }))
      .toEqual(emptyPayload);
  });

  it("moves a key from one group to another when its setting changes", () => {
    const updated = assignKeyRapidTrigger(typingQAndWRapidTriggerReadPayload, Q_POSITION, {
      kind: "custom-sensitivity",
      sensitivityRaw: SIX_TENTHS_OF_A_MILLIMETER,
    });

    expect(decodeRapidTriggerKeys(updated).map((key) => key.setting.kind))
      .toEqual(["custom-sensitivity", "custom-sensitivity"]);
  });
});

describe("assignKeyActuation", () => {
  it("produces exactly the list Wootility wrote for Q at 1.50 mm", () => {
    expect(assignKeyActuation(emptyPayload, Q_POSITION, ONE_AND_A_HALF_MILLIMETERS))
      .toEqual(typingQKeyActuationWritePayload);
  });

  it("removes the profile list entirely when its last key is removed", () => {
    expect(assignKeyActuation(typingQKeyActuationReadPayload, Q_POSITION, undefined)).toEqual(emptyPayload);
  });

  it("changes an existing key in place and keeps the order of the others", () => {
    const updated = assignKeyActuation(actuationProfilePayload, W_POSITION, 0x4800);

    expect(decodeActuationOverrides(updated).map((entry) => entry.matrixPosition))
      .toEqual(decodeActuationOverrides(actuationProfilePayload).map((entry) => entry.matrixPosition));
  });

  it("stores the new value for the changed key", () => {
    const updated = assignKeyActuation(actuationProfilePayload, W_POSITION, 0x4800);

    const changedKey = decodeActuationOverrides(updated).find((entry) => entry.matrixPosition === W_POSITION);

    expect(changedKey?.actuationRaw).toBe(0x4800);
  });

  it("refuses to edit a profile that still uses the 8-bit list", () => {
    expect(() => assignKeyActuation(ultraProfileActuationPayload, Q_POSITION, 0x4800))
      .toThrow(LegacyPerKeyActuationError);
  });
});

describe("encodeWootingReport for empty per-key lists", () => {
  it("sends only the header, like Wootility does for a profile without per-key actuation", () => {
    const report = encodeWootingReport(WootingReportType.perKeyActuation, storageForSavingToSlot(1), emptyPayload);

    expect(report).toEqual(payloadOf("d1da1503"));
  });
});
