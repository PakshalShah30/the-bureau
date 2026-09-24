import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
export const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50", {
  variants: { variant: {
    default: "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
    outline: "border border-border bg-card text-foreground hover:bg-muted",
    secondary: "bg-accent text-accent-foreground hover:brightness-95",
    ghost: "text-foreground hover:bg-muted",
    destructive: "bg-rose-600 text-white hover:bg-rose-700",
    link: "text-primary underline-offset-4 hover:underline",
  }, size: { default: "h-10 px-4 text-sm", sm: "h-9 px-3 text-[13px]", lg: "h-11 px-5 text-sm", icon: "h-10 w-10", "icon-sm": "h-8 w-8" } },
  defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
