import type { AnalogKeySource } from "../keyboard/analog-keys";
import type { KeyboardProfileReader } from "../keyboard/keyboard-profile";

export interface KeyboardIdentity {
  readonly vendorName: string;
  readonly productName: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly firmwareVersion: string;
  readonly hardwareVerified: boolean;
}

export interface KeyboardSession {
  readonly device: HIDDevice;
  readonly analogKeys?: AnalogKeySource;
  readonly profiles?: KeyboardProfileReader;
  readIdentity(): Promise<KeyboardIdentity>;
  close(): Promise<void>;
}

export type AuthorizedDeviceLister = () => Promise<HIDDevice[]>;

export interface KeyboardDriver {
  readonly requestFilters: readonly HIDDeviceFilter[];
  supports(device: HIDDevice): boolean;
  open(device: HIDDevice, listAuthorizedDevices: AuthorizedDeviceLister): Promise<KeyboardSession>;
}
