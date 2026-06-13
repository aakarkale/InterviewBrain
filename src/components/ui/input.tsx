import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border bg-surface-0/60 px-2.5 py-1 text-base transition-[color,border-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-text-3 hover:border-border-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:hover:border-ring",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
