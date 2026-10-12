import { ProtobufMessage } from "../protobuf/protobuf-message";
import { WootingProtocolError } from "./wooting-codec";

const PRECISE_ENTRY_POSITION_RANGE = 0x10000;
const PROFILE_SENSITIVITY_MARKER = 1;

const ActuationProfileField = { legacyPerKey: 2, precisePerKey: 4 } as const;
const ActuationListField = { entries: 1 } as const;
const RapidTriggerProfileField = { group: 1 } as const;
const RapidTriggerGroupField = { positions: 1, customSensitivity: 2, profileSensitivity: 3 } as const;
const CustomSensitivityField = { press: 1 } as const;

export class LegacyPerKeyActuationError extends WootingProtocolError {
  constructor() {
    super(
      "This profile stores per-key actuation in the older 8-bit format. "
      + "Save it once in Wootility before editing it here.",
    );
    this.name = "LegacyPerKeyActuationError";
  }
}

export type WootingKeyRapidTrigger =
  | { readonly kind: "follow-profile" }
  | { readonly kind: "profile-sensitivity" }
  | { readonly kind: "custom-sensitivity"; readonly sensitivityRaw: number };

type StoredKeyRapidTrigger = Exclude<WootingKeyRapidTrigger, { kind: "follow-profile" }>;

export interface WootingRapidTriggerKey {
  readonly matrixPosition: number;
  readonly setting: StoredKeyRapidTrigger;
}

export function decodeRapidTriggerKeys(payload: Uint8Array): WootingRapidTriggerKey[] {
  return ProtobufMessage.decode(payload)
    .repeatedMessages(RapidTriggerProfileField.group)
    .flatMap((group) => {
      const setting = groupSetting(group);
      return positionsOf(group).map((matrixPosition) => ({ matrixPosition, setting }));
    });
}

export function assignKeyRapidTrigger(
  payload: Uint8Array,
  matrixPosition: number,
  setting: WootingKeyRapidTrigger,
): Uint8Array<ArrayBuffer> {
  const profile = ProtobufMessage.decode(payload);
  const groups = profile.repeatedMessages(RapidTriggerProfileField.group)
    .map((group) => withPositions(group, positionsOf(group).filter((position) => position !== matrixPosition)))
    .filter((group) => positionsOf(group).length > 0);
  const updatedGroups = setting.kind === "follow-profile"
    ? groups
    : withPositionInGroup(groups, matrixPosition, setting);
  return profile.withRepeatedMessages(RapidTriggerProfileField.group, updatedGroups).encode();
}

export function hasLegacyPerKeyActuation(payload: Uint8Array): boolean {
  return ProtobufMessage.decode(payload).has(ActuationProfileField.legacyPerKey);
}

export function assignKeyActuation(
  payload: Uint8Array,
  matrixPosition: number,
  actuationRaw: number | undefined,
): Uint8Array<ArrayBuffer> {
  if (hasLegacyPerKeyActuation(payload)) throw new LegacyPerKeyActuationError();
  const profile = ProtobufMessage.decode(payload);
  const list = profile.message(ActuationProfileField.precisePerKey);
  const entries = replaceEntry(list.repeatedVarints(ActuationListField.entries), matrixPosition, actuationRaw);
  if (entries.length === 0) return profile.without(ActuationProfileField.precisePerKey).encode();
  const updatedList = list.withRepeatedVarints(ActuationListField.entries, entries);
  return profile.withMessage(ActuationProfileField.precisePerKey, updatedList).encode();
}

function replaceEntry(entries: readonly number[], matrixPosition: number, actuationRaw: number | undefined): number[] {
  const existingIndex = entries.findIndex((entry) => entry % PRECISE_ENTRY_POSITION_RANGE === matrixPosition);
  if (actuationRaw === undefined) return entries.filter((_, index) => index !== existingIndex);
  const entry = actuationRaw * PRECISE_ENTRY_POSITION_RANGE + matrixPosition;
  if (existingIndex < 0) return [...entries, entry];
  return entries.map((existing, index) => (index === existingIndex ? entry : existing));
}

function groupSetting(group: ProtobufMessage): StoredKeyRapidTrigger {
  if (!group.has(RapidTriggerGroupField.customSensitivity)) return { kind: "profile-sensitivity" };
  const customSensitivity = group.message(RapidTriggerGroupField.customSensitivity);
  return { kind: "custom-sensitivity", sensitivityRaw: customSensitivity.varint(CustomSensitivityField.press) };
}

function withPositionInGroup(
  groups: readonly ProtobufMessage[],
  matrixPosition: number,
  setting: StoredKeyRapidTrigger,
): ProtobufMessage[] {
  const configuration = groupConfiguration(setting);
  const signature = configurationSignature(configuration);
  const matchIndex = groups.findIndex((group) => configurationSignature(withoutPositions(group)) === signature);
  if (matchIndex < 0) return [...groups, withPositions(configuration, [matrixPosition])];
  return groups.map((group, index) => (index === matchIndex
    ? withPositions(group, [...positionsOf(group), matrixPosition])
    : group));
}

function groupConfiguration(setting: StoredKeyRapidTrigger): ProtobufMessage {
  if (setting.kind === "profile-sensitivity") {
    return ProtobufMessage.empty().withVarint(RapidTriggerGroupField.profileSensitivity, PROFILE_SENSITIVITY_MARKER);
  }
  const sensitivity = ProtobufMessage.empty().withVarint(CustomSensitivityField.press, setting.sensitivityRaw);
  return ProtobufMessage.empty().withMessage(RapidTriggerGroupField.customSensitivity, sensitivity);
}

function positionsOf(group: ProtobufMessage): number[] {
  return group.repeatedVarints(RapidTriggerGroupField.positions);
}

function withPositions(group: ProtobufMessage, positions: readonly number[]): ProtobufMessage {
  return group.withRepeatedVarints(RapidTriggerGroupField.positions, positions);
}

function withoutPositions(group: ProtobufMessage): ProtobufMessage {
  return group.without(RapidTriggerGroupField.positions);
}

function configurationSignature(configuration: ProtobufMessage): string {
  return [...configuration.encode()].join(",");
}
