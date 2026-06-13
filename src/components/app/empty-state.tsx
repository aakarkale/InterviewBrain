import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Shared empty state: icon in a tinted tile, one-line title, supporting copy,
// optional action. Dashed hairline marks "nothing here yet" everywhere.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed bg-surface-0/40 px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-md border bg-surface-1">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
