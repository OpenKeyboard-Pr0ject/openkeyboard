import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

type Tone = "neutral" | "accent" | "positive" | "warning" | "negative";

const BADGE_TONE_CLASSES: Readonly<Record<Tone, string>> = {
  neutral: "bg-tint text-muted",
  accent: "bg-accent text-on-accent uppercase",
  positive: "bg-positive/15 text-positive",
  warning: "bg-warning/15 text-warning",
  negative: "bg-negative/15 text-negative",
};

const DOT_TONE_CLASSES: Readonly<Record<Tone, string>> = {
  neutral: "bg-faint",
  accent: "bg-accent",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
};

const CALLOUT_ICON_CLASSES: Readonly<Record<Tone, string>> = {
  neutral: "text-muted",
  accent: "text-accent-ink",
  positive: "text-positive",
  warning: "text-warning",
  negative: "text-negative",
};

const CALLOUT_ICONS: Readonly<Record<Tone, typeof AlertIcon>> = {
  neutral: InfoIcon,
  accent: InfoIcon,
  positive: CheckIcon,
  warning: AlertIcon,
  negative: AlertIcon,
};

const BADGE_CLASSES = "inline-flex items-center rounded-lg px-2 py-0.5 text-xs leading-4 font-bold whitespace-nowrap";

export function Badge({ tone = "neutral", children }: { readonly tone?: Tone; readonly children: ReactNode }) {
  return <span className={`${BADGE_CLASSES} ${BADGE_TONE_CLASSES[tone]}`}>{children}</span>;
}

export function StatusDot({ tone }: { readonly tone: Tone }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_TONE_CLASSES[tone]}`} />;
}

export function Message({ children }: { readonly children: ReactNode }) {
  return <p className="m-0 text-base text-muted">{children}</p>;
}

export function Hint({ children }: { readonly children: ReactNode }) {
  return <p className="m-0 text-sm font-bold tracking-wide text-muted uppercase">{children}</p>;
}

interface CalloutProps {
  readonly tone?: Tone;
  readonly title?: string;
  readonly children?: ReactNode;
}

export function Callout({ tone = "warning", title, children }: CalloutProps) {
  const CalloutIcon = CALLOUT_ICONS[tone];
  const role = tone === "negative" ? "alert" : "status";
  return (
    <div role={role} className="flex gap-3 rounded-lg bg-sunken px-4 py-3 text-left">
      <CalloutIcon className={`mt-0.5 shrink-0 ${CALLOUT_ICON_CLASSES[tone]}`} width={20} height={20} />
      <div className="min-w-0 text-base text-fg">
        {title && <p className="m-0 font-bold text-strong">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Notice({ children }: { readonly children: ReactNode }) {
  return <Callout tone="positive">{children}</Callout>;
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
