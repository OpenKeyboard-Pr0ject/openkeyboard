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
  constructor(
    private readonly configDevice: HIDDevice,
    private readonly listAuthorizedDevices: AuthorizedDeviceLister,
  ) {}

  async start(listener: AnalogKeyListener): Promise<AnalogKeySubscription> {
    const analogDevice = await this.findAnalogInterface();
    if (!analogDevice.opened) await analogDevice.open();
    const onInputReport = (event: HIDInputReportEvent): void => {
      listener(decodeWootingAnalogReport(dataViewToBytes(event.data)));
    };
    analogDevice.addEventListener("inputreport", onInputReport);
    return {
      async stop() {
        analogDevice.removeEventListener("inputreport", onInputReport);
        if (analogDevice.opened) await analogDevice.close().catch(() => undefined);
      },
    };
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
