import type { ReactNode } from "react";

type Tone = "neutral" | "positive" | "warning" | "negative";

const BADGE_TONE_CLASSES: Readonly<Record<Tone, string>> = {
  neutral: "bg-raised text-muted",
  positive: "bg-positive/15 text-positive",
  warning: "bg-warning/15 text-warning",
  negative: "bg-negative/15 text-negative",
};

const DOT_TONE_CLASSES: Readonly<Record<Tone, string>> = {
  neutral: "bg-muted",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
};

const BADGE_CLASSES = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold";

export function Badge({ tone = "neutral", children }: { readonly tone?: Tone; readonly children: ReactNode }) {
  return <span className={`${BADGE_CLASSES} ${BADGE_TONE_CLASSES[tone]}`}>{children}</span>;
}

export function StatusDot({ tone }: { readonly tone: Tone }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_TONE_CLASSES[tone]}`} />;
}

export function Message({ children }: { readonly children: ReactNode }) {
  return <p className="m-0 text-sm text-muted">{children}</p>;
}

export function Notice({ children }: { readonly children: ReactNode }) {
  return (
    <p className="m-0 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
      {children}
    </p>
  );
}

export function ColorSwatch({ color, title }: { readonly color: string; readonly title?: string }) {
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 rounded border border-line"
      style={{ background: color }}
      title={title}
    />
  );
}

export type { Tone };
