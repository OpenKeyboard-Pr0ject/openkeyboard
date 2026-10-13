import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "small";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: ReactNode;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary: "border border-line bg-panel text-fg hover:bg-raised",
  ghost: "text-muted hover:bg-raised hover:text-fg",
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  default: "h-9 px-4 text-sm",
  small: "h-8 px-3 text-xs",
};

export function Button(
  { variant = "secondary", size = "default", icon, className = "", children, ...props }: ButtonProps,
) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
