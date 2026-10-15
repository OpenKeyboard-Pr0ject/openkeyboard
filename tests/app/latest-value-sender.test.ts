import { describe, expect, it } from "vitest";
import { LatestValueSender } from "../../src/app/hooks/latest-value-sender";

function controlledSender() {
  const sent: number[] = [];
  const errors: unknown[] = [];
  const releases: Array<() => void> = [];
  const sender = new LatestValueSender<number>(
    (value) => new Promise<void>((resolve, reject) => {
      sent.push(value);
      releases.push(() => (value < 0 ? reject(new Error(`bad ${value}`)) : resolve()));
    }),
    (error) => errors.push(error),
  );
  const releaseNext = async () => {
    await Promise.resolve();
    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { sender, sent, errors, releaseNext };
}

describe("LatestValueSender", () => {
  it("sends only the newest value submitted while a send is in flight", async () => {
    const { sender, sent, releaseNext } = controlledSender();

    sender.submit(1);
    await Promise.resolve();
    sender.submit(2);
    sender.submit(3);
    sender.submit(4);
    await releaseNext();
    await releaseNext();
    await sender.settled();

    expect(sent).toEqual([1, 4]);
  });

  it("settles once every submitted value was sent", async () => {
    const { sender, sent, releaseNext } = controlledSender();
    let settled = false;

    sender.submit(1);
    const waiting = sender.settled().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await releaseNext();
    await waiting;

    expect(settled).toBe(true);
    expect(sent).toEqual([1]);
  });

  it("reports a failed send and keeps sending later values", async () => {
    const { sender, sent, errors, releaseNext } = controlledSender();

    sender.submit(-1);
    await releaseNext();
    sender.submit(5);
    await releaseNext();
    await sender.settled();

    expect(sent).toEqual([-1, 5]);
    expect(errors).toHaveLength(1);
  });

  it("settles at once when nothing was submitted", async () => {
    const { sender } = controlledSender();

    await expect(sender.settled()).resolves.toBeUndefined();
  });
});
