import type { AnalogKeyReading } from "../../keyboard/analog-keys";
import { matrixColumnOf, matrixRowOf } from "./wooting-matrix";

const ENTRY_BYTES = 4;
const FULL_TRAVEL_VALUE = 0xffc1;

export function decodeWootingAnalogReport(report: Uint8Array): AnalogKeyReading[] {
  const view = new DataView(report.buffer, report.byteOffset, report.byteLength);
  const readings: AnalogKeyReading[] = [];
  for (let offset = 0; offset + ENTRY_BYTES <= report.length; offset += ENTRY_BYTES) {
    if (view.getUint32(offset) === 0) break;
    readings.push(decodeEntry(view, offset));
  }
  return readings;
}

function decodeEntry(view: DataView, offset: number): AnalogKeyReading {
  const matrixPosition = view.getUint8(offset);
  return {
    hidUsage: view.getUint8(offset + 1),
    matrixRow: matrixRowOf(matrixPosition),
    matrixColumn: matrixColumnOf(matrixPosition),
    depth: Math.min(view.getUint16(offset + 2, true) / FULL_TRAVEL_VALUE, 1),
  };
}
