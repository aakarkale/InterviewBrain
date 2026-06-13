import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// A lightweight native <select> styled to match Input. Native keeps it fully
// keyboard-accessible and dependency-free; reach for a Radix Select later only
// if a richer popover is needed.
function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "flex h-9 w-full appearance-none rounded-md border bg-surface-0/60 px-2.5 py-1 pr-8 text-base transition-[color,border-color,box-shadow] outline-none hover:border-border-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:hover:border-ring",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-text-3"
        aria-hidden
      />
    </div>
  );
}

export { Select };
