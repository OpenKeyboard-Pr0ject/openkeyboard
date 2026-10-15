import { hasCollection } from "../../hid/collections";
import { dataViewToBytes } from "../../hid/input-report-waiter";
import type { AnalogKeyListener, AnalogKeySource, AnalogKeySubscription } from "../../keyboard/analog-keys";
import { decodeWootingAnalogReport } from "../../protocol/wooting/wooting-analog-codec";
import { WOOTING_ANALOG_USAGE, WOOTING_ANALOG_USAGE_PAGE } from "../../protocol/wooting/wooting-constants";
import type { AuthorizedDeviceLister } from "../keyboard-driver";

export class AnalogInterfaceNotAuthorizedError extends Error {
  constructor() {
    super("Live key input needs access to the keyboard's analog interface. Grant access to the keyboard again.");
    this.name = "AnalogInterfaceNotAuthorizedError";
  }
}

export class WootingAnalogKeySource implements AnalogKeySource {
  private activeSubscriptions = 0;
  private pendingOpen: Promise<void> | undefined;
  private pendingClose: Promise<void> | undefined;

  constructor(
    private readonly configDevice: HIDDevice,
    private readonly listAuthorizedDevices: AuthorizedDeviceLister,
  ) {}

  async start(listener: AnalogKeyListener): Promise<AnalogKeySubscription> {
    this.activeSubscriptions += 1;
    let analogDevice: HIDDevice;
    try {
      analogDevice = await this.findAnalogInterface();
      await this.openWhenClosed(analogDevice);
    } catch (error) {
      this.activeSubscriptions -= 1;
      throw error;
    }
    const onInputReport = (event: HIDInputReportEvent): void => {
      listener(decodeWootingAnalogReport(dataViewToBytes(event.data)));
    };
    analogDevice.addEventListener("inputreport", onInputReport);
    let stopped = false;
    return {
      stop: async () => {
        if (stopped) return;
        stopped = true;
        analogDevice.removeEventListener("inputreport", onInputReport);
        this.activeSubscriptions -= 1;
        await this.closeWhenUnused(analogDevice);
      },
    };
  }

  private async openWhenClosed(analogDevice: HIDDevice): Promise<void> {
    await this.pendingClose;
    if (analogDevice.opened) return;
    this.pendingOpen ??= analogDevice.open().finally(() => {
      this.pendingOpen = undefined;
    });
    await this.pendingOpen;
  }

  private async closeWhenUnused(analogDevice: HIDDevice): Promise<void> {
    await this.pendingOpen?.catch(() => undefined);
    if (this.activeSubscriptions > 0 || !analogDevice.opened) return;
    this.pendingClose ??= analogDevice.close().catch(() => undefined).finally(() => {
      this.pendingClose = undefined;
    });
    await this.pendingClose;
  }

  private async findAnalogInterface(): Promise<HIDDevice> {
    const analogDevice = (await this.listAuthorizedDevices()).find(
      (candidate) => this.isSameKeyboard(candidate)
        && hasCollection(candidate, WOOTING_ANALOG_USAGE_PAGE, WOOTING_ANALOG_USAGE),
    );
    if (!analogDevice) throw new AnalogInterfaceNotAuthorizedError();
    return analogDevice;
  }

  private isSameKeyboard(candidate: HIDDevice): boolean {
    return candidate.vendorId === this.configDevice.vendorId && candidate.productId === this.configDevice.productId;
  }
}
