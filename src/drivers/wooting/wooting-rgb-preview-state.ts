export interface StoredRgbParts {
  readonly core: Uint8Array;
  readonly upperRows: Uint8Array;
  readonly lowerRows: Uint8Array;
}

interface PendingPreview {
  readonly slot: number;
  readonly stored: StoredRgbParts;
}

export class WootingRgbPreviewState {
  private pending: PendingPreview | undefined;

  markPending(slot: number, stored: StoredRgbParts): void {
    this.pending ??= { slot, stored };
  }

  clear(): void {
    this.pending = undefined;
  }

  forgetUnlessFor(activeSlot: number): void {
    if (this.pending && this.pending.slot !== activeSlot) this.pending = undefined;
  }

  isPending(slot: number): boolean {
    return this.pending?.slot === slot;
  }

  storedWhilePending(slot: number): StoredRgbParts | undefined {
    return this.isPending(slot) ? this.pending?.stored : undefined;
  }
}
