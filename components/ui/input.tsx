import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-gray-400 selection:bg-latspace-dark selection:text-white border-gray-200 h-11 w-full min-w-0 border bg-white px-4 py-3 text-sm font-mono transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-50",
        "focus-visible:border-latspace-dark focus-visible:ring-0 focus-visible:shadow-sm",
        "hover:border-gray-300",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
