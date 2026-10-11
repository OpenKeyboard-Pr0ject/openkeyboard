import { formatHex } from "../shared/hex";
import type { KeyboardDriver } from "./keyboard-driver";
import { wootingKeyboardDriver } from "./wooting/wooting-keyboard-driver";

const keyboardDrivers: readonly KeyboardDriver[] = [wootingKeyboardDriver];

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

export function driverFor(device: HIDDevice): KeyboardDriver {
  const driver = keyboardDrivers.find((candidate) => candidate.supports(device));
  if (!driver) throw new UnsupportedKeyboardError(device);
  return driver;
}
