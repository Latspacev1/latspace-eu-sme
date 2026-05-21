import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap text-sm font-semibold uppercase tracking-wider transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white hover:bg-secondary hover:shadow-lg shadow-primary/20",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 hover:shadow-lg shadow-destructive/20 focus-visible:outline-destructive",
        outline:
          "border-2 border-primary text-primary bg-white hover:bg-primary hover:text-white hover:shadow-md",
        secondary:
          "border-2 border-gray-300 text-gray-700 bg-white hover:border-secondary hover:text-secondary hover:bg-gray-50",
        ghost: "hover:bg-primary/5 hover:text-primary text-gray-700",
        link: "text-primary hover:text-secondary underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-11 px-8 py-4 has-[>svg]:px-7",
        sm: "h-9 gap-2 px-6 py-3 text-xs has-[>svg]:px-5",
        lg: "h-12 px-10 py-5 text-sm has-[>svg]:px-9",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
