import { formatHex } from "../shared/hex";
import type { KeyboardDriver } from "./keyboard-driver";
import { razerKeyboardDriver } from "./razer/razer-keyboard-driver";
import { viaKeyboardDriver } from "./via/via-keyboard-driver";
import { wootingKeyboardDriver } from "./wooting/wooting-keyboard-driver";

const keyboardDrivers: readonly KeyboardDriver[] = [wootingKeyboardDriver, razerKeyboardDriver, viaKeyboardDriver];

export class UnsupportedKeyboardError extends Error {
  constructor(device: HIDDevice) {
    const ids = `${formatHex(device.vendorId, 4)}:${formatHex(device.productId, 4)}`;
    super(`${device.productName} (${ids}) is not a supported keyboard.`);
    this.name = "UnsupportedKeyboardError";
  }
}

export function keyboardRequestFilters(): HIDDeviceFilter[] {
  return keyboardDrivers.flatMap((driver) => [...driver.requestFilters]);
}

export function isSupportedKeyboard(device: HIDDevice): boolean {
  return keyboardDrivers.some((driver) => driver.supports(device));
}

export interface UnusableKeyboardInterface {
  readonly device: HIDDevice;
  readonly reason: string;
}

export function findUnusableKeyboardInterface(devices: readonly HIDDevice[]): UnusableKeyboardInterface | undefined {
  for (const device of devices) {
    const reason = keyboardDrivers
      .map((driver) => driver.explainUnusableInterface?.(device))
      .find((explanation) => explanation !== undefined);
    if (reason) return { device, reason };
  }
  return undefined;
}

export function driverFor(device: HIDDevice): KeyboardDriver {
  const driver = keyboardDrivers.find((candidate) => candidate.supports(device));
  if (!driver) throw new UnsupportedKeyboardError(device);
  return driver;
}
