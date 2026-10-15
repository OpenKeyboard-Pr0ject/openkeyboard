import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "small" | "large";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: ReactNode;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-on-accent hover:brightness-105 active:brightness-95",
  secondary: "bg-tint text-strong hover:bg-tint-strong",
  ghost: "text-muted hover:bg-tint hover:text-strong",
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  default: "h-10 px-4 text-base",
  small: "h-8 px-3 text-sm",
  large: "h-12 px-5 text-lg",
};

export const BUTTON_BASE_CLASSES = [
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-faint disabled:brightness-100",
].join(" ");

export function Button(
  { variant = "secondary", size = "default", icon, className = "", children, ...props }: ButtonProps,
) {
  return (
    <button
      type="button"
      className={[BUTTON_BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].join(" ")}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
