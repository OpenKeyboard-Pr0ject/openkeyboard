import { driverFor, isSupportedKeyboard, keyboardRequestFilters } from "../drivers/keyboard-driver-registry";
import type { KeyboardIdentity, KeyboardSession } from "../drivers/keyboard-driver";
import type { AnalogKeySource } from "../keyboard/analog-keys";
import type { KeyboardProfileReader } from "../keyboard/keyboard-profile";
import { describeError } from "../shared/describe-error";

export type ConnectionState =
  | { readonly kind: "unsupported-browser" }
  | { readonly kind: "disconnected"; readonly notice?: string }
  | { readonly kind: "connecting"; readonly deviceName: string }
  | {
    readonly kind: "connected";
    readonly identity: KeyboardIdentity;
    readonly analogKeys?: AnalogKeySource;
    readonly profiles?: KeyboardProfileReader;
  }
  | { readonly kind: "failed"; readonly deviceName: string; readonly reason: string };

export type ConnectionStateListener = (state: ConnectionState) => void;

const UNKNOWN_DEVICE_NAME = "keyboard";

export class KeyboardConnection {
  private session: KeyboardSession | undefined;
  private state: ConnectionState;
  private readonly listeners = new Set<ConnectionStateListener>();

  constructor(private readonly hid: HID | undefined) {
    this.state = hid ? { kind: "disconnected" } : { kind: "unsupported-browser" };
  }

  subscribe(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (!this.hid) return;
    this.hid.addEventListener("connect", (event) => void this.connectIfIdle(event.device));
    this.hid.addEventListener("disconnect", (event) => this.handleUnplugged(event.device));
    await this.connectAuthorizedKeyboard();
  }

  async connectAuthorizedKeyboard(): Promise<void> {
    await this.connectFirstSupported(() => this.requireHid().getDevices());
  }

  async requestKeyboard(): Promise<void> {
    const filters = keyboardRequestFilters();
    await this.connectFirstSupported(() => this.requireHid().requestDevice({ filters }));
  }

  async disconnect(): Promise<void> {
    await this.closeSession();
    this.publish({ kind: "disconnected" });
  }

  async forget(): Promise<void> {
    const device = this.session?.device;
    await this.closeSession();
    await device?.forget();
    this.publish({ kind: "disconnected" });
  }

  private async connectFirstSupported(listDevices: () => Promise<HIDDevice[]>): Promise<void> {
    try {
      const [keyboard] = (await listDevices()).filter(isSupportedKeyboard);
      if (keyboard) await this.connect(keyboard);
    } catch (error) {
      this.publish({ kind: "failed", deviceName: UNKNOWN_DEVICE_NAME, reason: describeError(error) });
    }
  }

  private async connectIfIdle(device: HIDDevice): Promise<void> {
    if (this.session || !isSupportedKeyboard(device)) return;
    await this.connect(device);
  }

  private async connect(device: HIDDevice): Promise<void> {
    await this.closeSession();
    this.publish({ kind: "connecting", deviceName: device.productName });
    try {
      const session = await driverFor(device).open(device, () => this.requireHid().getDevices());
      this.session = session;
      const identity = await session.readIdentity();
      this.publish({ kind: "connected", identity, analogKeys: session.analogKeys, profiles: session.profiles });
    } catch (error) {
      await this.closeSession();
      this.publish({ kind: "failed", deviceName: device.productName, reason: describeError(error) });
    }
  }

  private handleUnplugged(device: HIDDevice): void {
    if (device !== this.session?.device) return;
    this.session = undefined;
    this.publish({ kind: "disconnected", notice: `${device.productName} was unplugged.` });
  }

  private async closeSession(): Promise<void> {
    const session = this.session;
    this.session = undefined;
    await session?.close().catch(() => undefined);
  }

  private requireHid(): HID {
    if (!this.hid) throw new Error("This browser does not support WebHID.");
    return this.hid;
  }

  private publish(state: ConnectionState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}
