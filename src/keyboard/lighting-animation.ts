import type { RgbColor } from "./lighting";
import type { LayeredEffects } from "./lighting-effects";
import { layoutSize, matrixKeyId, type PhysicalLayout } from "./physical-layout";

const DEFAULT_RETENTION_SECONDS = 12;
const MAXIMUM_REMEMBERED_RELEASES = 96;

export interface AnimatedKey {
  readonly id: string;
  readonly centerX: number;
  readonly centerY: number;
}

export interface AnimatedBoard {
  readonly keys: readonly AnimatedKey[];
  readonly width: number;
  readonly height: number;
}

export interface KeyPress {
  readonly keyId: string;
  readonly sequence: number;
  readonly pressedAt: number;
  readonly releasedAt?: number;
  readonly depth: number;
}

export interface LightingFrameRequest {
  readonly board: AnimatedBoard;
  readonly effects: LayeredEffects;
  readonly keyColors: ReadonlyMap<string, RgbColor>;
  readonly presses: readonly KeyPress[];
  readonly timeSeconds: number;
}

export interface LayeredEffectAnimator {
  isAnimated(effects: LayeredEffects): boolean;
  respondsToKeyPresses(effects: LayeredEffects): boolean;
  frame(request: LightingFrameRequest): ReadonlyMap<string, RgbColor>;
}

export function animatedBoardOf(layout: PhysicalLayout): AnimatedBoard {
  const size = layoutSize(layout);
  return {
    keys: layout.keys.map((key) => ({
      id: matrixKeyId(key),
      centerX: key.x + key.width / 2,
      centerY: key.y + key.height / 2,
    })),
    width: size.width,
    height: size.height,
  };
}

export class KeyPressTracker {
  private readonly activePresses = new Map<string, KeyPress>();
  private releasedPresses: KeyPress[] = [];
  private streamedKeyIds: ReadonlySet<string> = new Set();
  private nextSequence = 0;

  constructor(private readonly retentionSeconds = DEFAULT_RETENTION_SECONDS) {}

  update(keyId: string, depth: number, timeSeconds: number): void {
    const active = this.activePresses.get(keyId);
    if (depth > 0) {
      this.activePresses.set(keyId, active
        ? { ...active, depth }
        : { keyId, depth, pressedAt: timeSeconds, sequence: this.nextSequence++ });
      return;
    }
    if (!active) return;
    this.activePresses.delete(keyId);
    this.releasedPresses.push({ ...active, releasedAt: timeSeconds });
    if (this.releasedPresses.length > MAXIMUM_REMEMBERED_RELEASES) {
      this.releasedPresses = this.releasedPresses.slice(-MAXIMUM_REMEMBERED_RELEASES);
    }
  }

  replaceStreamedKeys(depthsByKeyId: ReadonlyMap<string, number>, timeSeconds: number): void {
    for (const keyId of this.streamedKeyIds) {
      if (!depthsByKeyId.has(keyId)) this.update(keyId, 0, timeSeconds);
    }
    for (const [keyId, depth] of depthsByKeyId) this.update(keyId, depth, timeSeconds);
    this.streamedKeyIds = new Set([...depthsByKeyId].filter(([, depth]) => depth > 0).map(([keyId]) => keyId));
  }

  presses(timeSeconds: number): readonly KeyPress[] {
    this.releasedPresses = this.releasedPresses.filter(
      (press) => timeSeconds - (press.releasedAt ?? timeSeconds) <= this.retentionSeconds,
    );
    return [...this.releasedPresses, ...this.activePresses.values()];
  }
}
