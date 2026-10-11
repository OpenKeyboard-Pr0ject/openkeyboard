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
  readIdentity(): Promise<KeyboardIdentity>;
  close(): Promise<void>;
}

export interface KeyboardDriver {
  readonly requestFilters: readonly HIDDeviceFilter[];
  supports(device: HIDDevice): boolean;
  open(device: HIDDevice): Promise<KeyboardSession>;
}
