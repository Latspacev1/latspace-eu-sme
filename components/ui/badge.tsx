import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-latspace-dark bg-latspace-dark text-white [a&]:hover:bg-latspace-medium [a&]:hover:border-latspace-medium [a&]:hover:shadow-md",
        secondary:
          "border-gray-200 bg-gray-100 text-gray-700 [a&]:hover:bg-gray-200 [a&]:hover:border-gray-300",
        destructive:
          "border-destructive bg-destructive text-white [a&]:hover:bg-destructive/90 [a&]:hover:shadow-md",
        outline:
          "border-latspace-dark text-latspace-dark bg-white [a&]:hover:bg-latspace-dark [a&]:hover:text-white [a&]:hover:shadow-md",
        success:
          "border-emerald-600 bg-emerald-600 text-white [a&]:hover:bg-emerald-700 [a&]:hover:shadow-md",
        warning:
          "border-amber-500 bg-amber-500 text-white [a&]:hover:bg-amber-600 [a&]:hover:shadow-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
