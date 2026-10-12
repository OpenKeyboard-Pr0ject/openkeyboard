import type { AnalogKeyReading, AnalogKeySource, AnalogKeySubscription } from "../keyboard/analog-keys";
import { keyLabel } from "../keyboard/hid-key-names";
import { describeError } from "../shared/describe-error";
import { actionButton, element } from "./dom";
import type { Panel } from "./panel";

const IDLE_MESSAGE = "Press any key to see how far it travels.";

export class LiveKeyPanel implements Panel {
  readonly element: HTMLElement;
  private readonly keyList: HTMLElement;
  private subscription: AnalogKeySubscription | undefined;
  private pressedKeys: readonly AnalogKeyReading[] = [];
  private frameRequested = false;
  private disposed = false;

  constructor(
    private readonly source: AnalogKeySource,
    private readonly requestAccess: () => void,
  ) {
    this.keyList = element("div", "live-keys__list", [idleMessage()]);
    const heading = element("div", "panel-heading", [element("h3", "panel-heading__title", ["Live key input"])]);
    this.element = element("section", "panel", [heading, this.keyList]);
    void this.start();
  }

  dispose(): void {
    this.disposed = true;
    void this.subscription?.stop();
  }

  private async start(): Promise<void> {
    try {
      const subscription = await this.source.start((pressedKeys) => this.scheduleRender(pressedKeys));
      if (this.disposed) await subscription.stop();
      else this.subscription = subscription;
    } catch (error) {
      this.showAccessProblem(describeError(error));
    }
  }

  private scheduleRender(pressedKeys: readonly AnalogKeyReading[]): void {
    this.pressedKeys = pressedKeys;
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      this.render();
    });
  }

  private render(): void {
    const visibleKeys = this.pressedKeys.filter((reading) => reading.depth > 0).sort(byMatrixPosition);
    this.keyList.replaceChildren(...(visibleKeys.length > 0 ? visibleKeys.map(keyMeter) : [idleMessage()]));
  }

  private showAccessProblem(reason: string): void {
    this.keyList.replaceChildren(
      element("p", "panel__message", [reason]),
      actionButton("Grant access", "primary", this.requestAccess),
    );
  }
}

function keyMeter(reading: AnalogKeyReading): HTMLElement {
  const percent = Math.round(reading.depth * 100);
  const fill = element("span", "key-meter__fill");
  fill.style.width = `${percent}%`;
  return element("div", "key-meter", [
    element("span", "key-meter__label", [keyLabel(reading)]),
    element("span", "key-meter__track", [fill]),
    element("span", "key-meter__value", [`${percent}%`]),
  ]);
}

function byMatrixPosition(first: AnalogKeyReading, second: AnalogKeyReading): number {
  return first.matrixRow - second.matrixRow || first.matrixColumn - second.matrixColumn;
}

function idleMessage(): HTMLElement {
  return element("p", "panel__message", [IDLE_MESSAGE]);
}
