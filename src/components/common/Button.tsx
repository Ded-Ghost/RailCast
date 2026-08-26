import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-container active:bg-primary",
  secondary:
    "bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container-high",
  danger: "bg-error text-on-error hover:bg-error/90",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-body-sm gap-1.5",
  md: "h-9 px-4 text-body-md gap-2",
};

/**
 * The three button variants defined in DESIGN.md, plus a `danger` variant
 * for destructive actions. Shape/height follow the "Inputs & Buttons"
 * spec (4px radius, compact 32px height available via `size="sm"`).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
