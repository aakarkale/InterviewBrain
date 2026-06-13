"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Interviews", match: ["/dashboard", "/applications", "/sessions"] },
  { href: "/stories", label: "Story bank", match: ["/stories"] },
  { href: "/brain", label: "Brain", match: ["/brain"] },
] as const;

// Primary nav with a real active state. Sessions and application detail pages
// highlight Applications — they're all vault territory.
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
