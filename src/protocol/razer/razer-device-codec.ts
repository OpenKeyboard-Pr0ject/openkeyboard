import { formatHex } from "../../shared/hex";
import { RazerProtocolError } from "./razer-codec";
import { RazerPollingRateCode } from "./razer-constants";

const MAXIMUM_BATTERY_LEVEL = 0xff;
const PERCENT = 100;
const BATTERY_LEVEL_ARGUMENT = 1;
const CHARGING_ARGUMENT = 1;
const CHARGING = 0x01;
const IDLE_TIME_BYTES = 2;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;

export function decodePollingRateHz(replyArguments: Uint8Array): number {
  const code = replyArguments[0];
  const entry = [...RazerPollingRateCode].find(([, candidateCode]) => candidateCode === code);
  if (!entry) throw new RazerProtocolError(`The keyboard reported an unknown polling rate code ${formatHex(code, 2)}.`);
  return entry[0];
}

export function encodePollingRateArguments(pollingRateHz: number): number[] {
  const code = RazerPollingRateCode.get(pollingRateHz);
  if (code === undefined) throw new RazerProtocolError(`${pollingRateHz} Hz is not a Razer polling rate.`);
  return [code];
}

export function decodeBatteryLevelPercent(replyArguments: Uint8Array): number {
  if (replyArguments.length <= BATTERY_LEVEL_ARGUMENT) {
    throw new RazerProtocolError("The battery level reply is too short.");
  }
  return Math.round((replyArguments[BATTERY_LEVEL_ARGUMENT] / MAXIMUM_BATTERY_LEVEL) * PERCENT);
}

export function decodeCharging(replyArguments: Uint8Array): boolean {
  if (replyArguments.length <= CHARGING_ARGUMENT) {
    throw new RazerProtocolError("The charging status reply is too short.");
  }
  return replyArguments[CHARGING_ARGUMENT] === CHARGING;
}

export function decodeIdleTimeSeconds(replyArguments: Uint8Array): number {
  if (replyArguments.length < IDLE_TIME_BYTES) throw new RazerProtocolError("The idle time reply is too short.");
  return (replyArguments[0] << BITS_PER_BYTE) | replyArguments[1];
}

export function encodeIdleTimeArguments(seconds: number): number[] {
  return [(seconds >> BITS_PER_BYTE) & BYTE_MASK, seconds & BYTE_MASK];
}
