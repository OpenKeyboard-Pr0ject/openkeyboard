import { describe, expect, it } from "vitest";
import { type ConnectionState, KeyboardConnection } from "../../src/connection/keyboard-connection";
import { FakeHid } from "../fakes/fake-hid";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import { firmwareVersionReply } from "../fakes/wooting-80he-captures";

function respondingKeyboard(): FakeHidDevice {
  return new FakeHidDevice({ respond: () => firmwareVersionReply });
}

function recordStates(connection: KeyboardConnection): ConnectionState[] {
  const states: ConnectionState[] = [];
  connection.subscribe((state) => states.push(state));
  return states;
}

describe("KeyboardConnection", () => {
  it("reports an unsupported browser when WebHID is missing", () => {
    const states = recordStates(new KeyboardConnection(undefined));

    expect(states).toEqual([{ kind: "unsupported-browser" }]);
  });

  it("connects on start to a keyboard the user authorized earlier", async () => {
    const keyboard = respondingKeyboard().asHidDevice();
    const connection = new KeyboardConnection(new FakeHid([keyboard]).asHid());
    const states = recordStates(connection);

    await connection.start();

    expect(states.at(-1)).toMatchObject({ kind: "connected", identity: { firmwareVersion: "2.14.0" } });
  });

  it("stays disconnected on start when no keyboard is authorized", async () => {
    const connection = new KeyboardConnection(new FakeHid().asHid());
    const states = recordStates(connection);

    await connection.start();

    expect(states).toEqual([{ kind: "disconnected" }]);
  });

  it("asks the browser only for interfaces a driver supports", async () => {
    const hid = new FakeHid([], [respondingKeyboard().asHidDevice()]);
    const connection = new KeyboardConnection(hid.asHid());

    await connection.requestKeyboard();

    expect(hid.requestedFilters).toEqual([{ vendorId: 0x31e3, usagePage: 0xff55, usage: 0x01 }]);
  });

  it("connects to the keyboard the user picked", async () => {
    const connection = new KeyboardConnection(new FakeHid([], [respondingKeyboard().asHidDevice()]).asHid());
    const states = recordStates(connection);

    await connection.requestKeyboard();

    expect(states.at(-1)?.kind).toBe("connected");
  });

  it("reports a failure when the keyboard does not accept commands", async () => {
    const broken = new FakeHidDevice({ failFeatureReports: true }).asHidDevice();
    const connection = new KeyboardConnection(new FakeHid([broken]).asHid());
    const states = recordStates(connection);

    await connection.start();

    expect(states.at(-1)).toMatchObject({ kind: "failed", deviceName: "Wooting 80HE TenZ" });
  });

  it("reports the unplugged keyboard as disconnected", async () => {
    const keyboard = respondingKeyboard().asHidDevice();
    const hid = new FakeHid([keyboard]);
    const connection = new KeyboardConnection(hid.asHid());
    const states = recordStates(connection);
    await connection.start();

    hid.emit("disconnect", keyboard);

    expect(states.at(-1)).toEqual({ kind: "disconnected", notice: "Wooting 80HE TenZ was unplugged." });
  });

  it("reconnects automatically when an authorized keyboard is plugged back in", async () => {
    const keyboard = respondingKeyboard().asHidDevice();
    const hid = new FakeHid([keyboard]);
    const connection = new KeyboardConnection(hid.asHid());
    const states = recordStates(connection);
    await connection.start();
    hid.emit("disconnect", keyboard);

    hid.emit("connect", keyboard);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(states.at(-1)?.kind).toBe("connected");
  });

  it("closes the device when the user disconnects", async () => {
    const keyboard = respondingKeyboard();
    const connection = new KeyboardConnection(new FakeHid([keyboard.asHidDevice()]).asHid());
    await connection.start();

    await connection.disconnect();

    expect(keyboard.opened).toBe(false);
  });
});
