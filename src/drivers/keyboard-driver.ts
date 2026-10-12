import type { AnalogKeySource } from "../keyboard/analog-keys";
import type { KeyboardProfileEditor, KeyboardProfileReader } from "../keyboard/keyboard-profile";
import type { KeyboardDefinitionLoader, KeymapReader } from "../keyboard/keymap";

export interface KeyboardIdentity {
  readonly vendorName: string;
  readonly productName: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly firmwareVersion: string;
  readonly hardwareVerified: boolean;
}

export interface KeyboardCapabilities {
  readonly analogKeys?: AnalogKeySource;
  readonly profiles?: KeyboardProfileReader;
  readonly profileEditor?: KeyboardProfileEditor;
  readonly keymap?: KeymapReader;
  readonly definitionLoader?: KeyboardDefinitionLoader;
}

export interface KeyboardSession extends KeyboardCapabilities {
  readonly device: HIDDevice;
  readIdentity(): Promise<KeyboardIdentity>;
  close(): Promise<void>;
}

export type AuthorizedDeviceLister = () => Promise<HIDDevice[]>;

export interface KeyboardDriver {
  readonly requestFilters: readonly HIDDeviceFilter[];
  supports(device: HIDDevice): boolean;
  open(device: HIDDevice, listAuthorizedDevices: AuthorizedDeviceLister): Promise<KeyboardSession>;
}
