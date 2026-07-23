"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/vault", label: "Company Vault", match: ["/vault"] },
  { href: "/interviews", label: "Interviews", match: ["/interviews", "/sessions"] },
  { href: "/stories", label: "Story bank", match: ["/stories"] },
  { href: "/brain", label: "Brain", match: ["/brain"] },
] as const;

// Primary nav with a real active state. Practice sessions highlight Interviews —
// that's where they live in the hierarchy.
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex items-center gap-0.5">
      {LINKS.map((link) => {
        const active = link.match.some(
          (m) => pathname === m || pathname.startsWith(`${m}/`)
        );
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
