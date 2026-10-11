type ConnectionListener = (event: HIDConnectionEvent) => void;

export class FakeHid {
  requestedFilters: HIDDeviceFilter[] = [];
  private readonly listeners = { connect: new Set<ConnectionListener>(), disconnect: new Set<ConnectionListener>() };

  constructor(
    private authorizedDevices: HIDDevice[] = [],
    private readonly pickedDevices: HIDDevice[] = [],
  ) {}

  async getDevices(): Promise<HIDDevice[]> {
    return this.authorizedDevices;
  }

  async requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]> {
    this.requestedFilters = options.filters;
    this.authorizedDevices = [...this.authorizedDevices, ...this.pickedDevices];
    return this.pickedDevices;
  }

  addEventListener(type: "connect" | "disconnect", listener: ConnectionListener): void {
    this.listeners[type].add(listener);
  }

  emit(type: "connect" | "disconnect", device: HIDDevice): void {
    const event = { device } as HIDConnectionEvent;
    this.listeners[type].forEach((listener) => listener(event));
  }

  asHid(): HID {
    return this as unknown as HID;
  }
}
