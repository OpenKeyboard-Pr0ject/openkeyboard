export class LatestValueSender<Value> {
  private queued: { readonly value: Value } | undefined;
  private draining: Promise<void> | undefined;

  constructor(
    private readonly send: (value: Value) => Promise<void>,
    private readonly onError: (error: unknown) => void,
  ) {}

  submit(value: Value): void {
    this.queued = { value };
    this.draining ??= this.drain();
  }

  async settled(): Promise<void> {
    while (this.draining) await this.draining;
  }

  private async drain(): Promise<void> {
    await Promise.resolve();
    while (this.queued) {
      const { value } = this.queued;
      this.queued = undefined;
      try {
        await this.send(value);
      } catch (error) {
        this.onError(error);
      }
    }
    this.draining = undefined;
  }
}
